"""DDL routes — CREATE/ALTER/DROP tables and columns."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, Body
from sqlalchemy import text

from app.engine_factory import EngineFactory
from app.schemas import (
    AddColumnRequest,
    CreateTableRequest,
    DropColumnRequest,
    DropTableRequest,
    ModifyColumnRequest,
    RenameColumnRequest,
    RenameTableRequest,
    CreateForeignKeyRequest,
    DropForeignKeyRequest,
)

from app.error_normalizer import normalize_db_error

router = APIRouter(prefix="/api/ddl", tags=["ddl"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _get_engine(session_id: str):
    entry = EngineFactory.get_session(session_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Session not found")
    return entry


# ---------------------------------------------------------------------------
# Tables
# ---------------------------------------------------------------------------
@router.post("/tables")
async def create_table(req: CreateTableRequest):
    """Create a new table with the specified columns."""
    entry = _get_engine(req.session_id)
    dialect = entry.dialect
    
    sql = dialect.get_create_table_sql(req.schema_name, req.table, req.columns)

    try:
        with entry.engine.connect() as conn:
            conn.execute(text(sql))
            conn.commit()
        return {"message": f"Table {req.table} created", "sql": sql}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=normalize_db_error(exc))


@router.delete("/tables")
async def drop_table(req: DropTableRequest):
    """Drop a table (destructive)."""
    entry = _get_engine(req.session_id)
    dialect = entry.dialect
    sql = dialect.get_drop_table_sql(req.schema_name, req.table)

    try:
        with entry.engine.connect() as conn:
            conn.execute(text(sql))
            conn.commit()
        return {"message": f"Table {req.table} dropped"}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=normalize_db_error(exc))


@router.put("/tables/rename")
async def rename_table(req: RenameTableRequest):
    """Rename a table."""
    entry = _get_engine(req.session_id)
    dialect = entry.dialect
    sql = dialect.get_rename_table_sql(req.schema_name, req.table, req.new_name)

    try:
        with entry.engine.connect() as conn:
            conn.execute(text(sql))
            conn.commit()
        return {"message": f"Table renamed to {req.new_name}"}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=normalize_db_error(exc))


# ---------------------------------------------------------------------------
# Columns
# ---------------------------------------------------------------------------
@router.post("/columns/add")
async def add_column(req: AddColumnRequest):
    """Add a column to a table."""
    entry = _get_engine(req.session_id)
    dialect = entry.dialect
    sql = dialect.get_add_column_sql(req.schema_name, req.table, req.column)

    try:
        with entry.engine.connect() as conn:
            conn.execute(text(sql))
            conn.commit()
        return {"message": f"Column {req.column.name} added to {req.table}"}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=normalize_db_error(exc))


@router.put("/columns/modify")
async def modify_column(req: ModifyColumnRequest):
    """Modify a column type or nullability."""
    entry = _get_engine(req.session_id)
    dialect = entry.dialect

    if not req.new_data_type and req.new_nullable is None:
        raise HTTPException(status_code=400, detail="Nothing to modify")

    statements = dialect.get_modify_column_sql(
        req.schema_name, req.table, req.column_name, req.new_data_type, req.new_nullable,
        is_primary=req.is_primary, is_unique=req.is_unique, is_autoincrement=req.is_autoincrement
    )

    try:
        with entry.engine.connect() as conn:
            for stmt in statements:
                conn.execute(text(stmt))
            conn.commit()
        return {"message": f"Column {req.column_name} modified"}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=normalize_db_error(exc))


@router.delete("/columns/drop")
async def drop_column(req: DropColumnRequest):
    """Drop a column (destructive)."""
    entry = _get_engine(req.session_id)
    dialect = entry.dialect
    sql = dialect.get_drop_column_sql(req.schema_name, req.table, req.column_name)

    try:
        with entry.engine.connect() as conn:
            conn.execute(text(sql))
            conn.commit()
        return {"message": f"Column {req.column_name} dropped"}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=normalize_db_error(exc))


@router.put("/columns/rename")
async def rename_column(req: RenameColumnRequest):
    """Rename a column."""
    entry = _get_engine(req.session_id)
    dialect = entry.dialect
    sql = dialect.get_rename_column_sql(req.schema_name, req.table, req.column_name, req.new_name)

    try:
        with entry.engine.connect() as conn:
            conn.execute(text(sql))
            conn.commit()
        return {"message": f"Column renamed to {req.new_name}"}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=normalize_db_error(exc))


# ---------------------------------------------------------------------------
# Relationships
# ---------------------------------------------------------------------------
@router.post("/foreign-keys")
async def create_foreign_key(req: CreateForeignKeyRequest):
    """Create a foreign key between two tables."""
    entry = _get_engine(req.session_id)
    dialect = entry.dialect

    sql = dialect.get_create_foreign_key_sql(
        req.source_schema, req.source_table, req.source_column,
        req.target_schema, req.target_table, req.target_column
    )

    try:
        with entry.engine.connect() as conn:
            conn.execute(text(sql))
            conn.commit()
        return {"message": "Relationship created", "sql": sql}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=normalize_db_error(exc))


@router.delete("/foreign-keys")
async def drop_foreign_key(req: DropForeignKeyRequest = Body(...)):
    """Drop a foreign key constraint."""
    entry = _get_engine(req.session_id)
    dialect = entry.dialect
    tref = dialect.table_ref(req.schema_name, req.table)
    sql = dialect.get_drop_foreign_key_sql(tref, req.constraint_name)

    try:
        with entry.engine.connect() as conn:
            conn.execute(text(sql))
            conn.commit()
        return {"message": f"Relationship {req.constraint_name} dropped"}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
