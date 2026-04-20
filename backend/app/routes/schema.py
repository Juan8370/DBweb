"""Schema introspection — extracts tables, columns and foreign keys."""

from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from app.engine_factory import EngineFactory
from app.schemas import (
    ColumnInfo,
    ForeignKeyInfo,
    SchemaResponse,
    TableInfo,
)

router = APIRouter(prefix="/api/schema", tags=["schema"])

# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------
@router.get("/{session_id}", response_model=SchemaResponse)
async def get_schema(session_id: str):
    """Return full schema (tables + FKs) for the connected database."""
    entry = EngineFactory.get_session(session_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Session not found")

    dialect = entry.dialect
    tables_dict: dict[str, TableInfo] = {}

    with entry.engine.connect() as conn:
        # --- columns ---
        try:
            rows = conn.execute(text(dialect.get_columns_sql())).fetchall()
            for r in rows:
                key = f"{r.table_schema}.{r.table_name}"
                if key not in tables_dict:
                    tables_dict[key] = TableInfo(name=r.table_name, schema_name=r.table_schema)
                tables_dict[key].columns.append(
                    ColumnInfo(
                        name=r.column_name,
                        data_type=r.data_type,
                        is_nullable=str(r.is_nullable).upper() == "YES" if isinstance(r.is_nullable, str) else bool(r.is_nullable),
                        is_primary=bool(r.is_primary),
                        is_unique=bool(getattr(r, "is_unique", False)),
                        default_value=str(r.column_default) if r.column_default else None,
                        character_maximum_length=r.character_maximum_length,
                    )
                )

            # --- foreign keys ---
            fk_rows = conn.execute(text(dialect.get_fks_sql())).fetchall()
            fks = [
                ForeignKeyInfo(
                    constraint_name=r.constraint_name,
                    source_table=r.source_table,
                    source_column=r.source_column,
                    target_table=r.target_table,
                    target_column=r.target_column,
                )
                for r in fk_rows
            ]
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Schema introspection error: {exc}")

    return SchemaResponse(tables=list(tables_dict.values()), foreign_keys=fks)
