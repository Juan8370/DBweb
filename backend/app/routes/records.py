"""Record routes — INSERT / DELETE rows."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from app.engine_factory import EngineFactory
from app.error_normalizer import normalize_db_error
from app.schemas import DeleteRecordsRequest, InsertRecordRequest, BulkInsertRequest

router = APIRouter(prefix="/api/records", tags=["records"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _get_engine(session_id: str):
    entry = EngineFactory.get_session(session_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Session not found")
    return entry


# ---------------------------------------------------------------------------
# Insert
# ---------------------------------------------------------------------------
@router.post("/insert")
async def insert_record(req: InsertRecordRequest):
    """Insert a single row."""
    entry = _get_engine(req.session_id)
    dialect = entry.dialect
    tref = dialect.table_ref(req.schema_name, req.table)

    cols = list(req.data.keys())
    col_refs = ", ".join(dialect.quote(c) for c in cols)
    placeholders = ", ".join(f":{c}" for c in cols)

    sql = f"INSERT INTO {tref} ({col_refs}) VALUES ({placeholders})"

    try:
        with entry.engine.connect() as conn:
            conn.execute(text(sql), req.data)
            conn.commit()
        return {"message": f"1 row inserted into {req.table}"}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=normalize_db_error(exc))


@router.post("/bulk-insert")
async def bulk_insert(req: BulkInsertRequest):
    """Insert multiple rows in one transaction."""
    if not req.data:
        return {"message": "No data provided", "count": 0}

    entry = _get_engine(req.session_id)
    dialect = entry.dialect
    tref = dialect.table_ref(req.schema_name, req.table)

    # Sanitize keys to ensure they are valid for SQLAlchemy placeholders
    raw_cols = list(req.data[0].keys())
    clean_cols = [c.replace('"', '').replace("'", "").strip() for c in raw_cols]
    
    # Re-map data with clean keys
    clean_data = []
    for row in req.data:
        new_row = {}
        for i, val in enumerate(row.values()):
            new_row[clean_cols[i]] = val
        clean_data.append(new_row)

    col_refs = ", ".join(dialect.quote(c) for c in clean_cols)
    placeholders = ", ".join(f":{c}" for c in clean_cols)

    sql = f"INSERT INTO {tref} ({col_refs}) VALUES ({placeholders})"

    try:
        with entry.engine.connect() as conn:
            conn.execute(text(sql), clean_data)
            conn.commit()
        return {"message": f"{len(req.data)} rows inserted into {req.table}", "count": len(req.data)}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=normalize_db_error(exc))


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------
@router.post("/delete")
async def delete_records(req: DeleteRecordsRequest):
    """Delete rows by primary key values."""
    entry = _get_engine(req.session_id)
    dialect = entry.dialect
    tref = dialect.table_ref(req.schema_name, req.table)
    pkq = dialect.quote(req.primary_key_column)

    deleted = 0
    try:
        with entry.engine.connect() as conn:
            for pk_val in req.primary_key_values:
                sql = f"DELETE FROM {tref} WHERE {pkq} = :pk"
                result = conn.execute(text(sql), {"pk": pk_val})
                deleted += result.rowcount
            conn.commit()
        return {"message": f"{deleted} row(s) deleted from {req.table}"}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
