"""Query execution routes with safe-mode enforcement."""

from __future__ import annotations

import re
import time
from typing import Any, List

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import text

from app.engine_factory import EngineFactory
from app.error_normalizer import normalize_db_error
from app.schemas import (
    CellUpdateRequest,
    QueryRequest,
    QueryResponse,
    TableDataRequest,
)

router = APIRouter(prefix="/api/query", tags=["query"])


# ---------------------------------------------------------------------------
# Safe-mode patterns
# ---------------------------------------------------------------------------
_DANGEROUS_PATTERN = re.compile(
    r"\b(DROP|TRUNCATE|DELETE\s+FROM)\b",
    re.IGNORECASE,
)


def _enforce_safe_mode(request: Request, sql: str, allow_in_body: bool = False) -> None:
    """Raise 403 if destructive SQL is detected without explicit opt-in."""
    if _DANGEROUS_PATTERN.search(sql):
        allow_header = request.headers.get("X-Allow-Destructive", "false").lower() == "true"
        if not (allow_header or allow_in_body):
            raise HTTPException(
                status_code=403,
                detail=(
                    "Destructive query blocked by Safe Mode. "
                    "Confirm with 'allow_destructive: true' in the request body "
                    "or send header 'X-Allow-Destructive: true' to proceed."
                ),
            )


# ---------------------------------------------------------------------------
# Execute arbitrary SQL
# ---------------------------------------------------------------------------
@router.post("/execute", response_model=QueryResponse)
async def execute_query(req: QueryRequest, request: Request):
    entry = EngineFactory.get_session(req.session_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Session not found")

    _enforce_safe_mode(request, req.sql, allow_in_body=req.allow_destructive)

    t0 = time.perf_counter()
    try:
        with entry.engine.connect() as conn:
            result = conn.execute(text(req.sql), req.params or {})

            # DML (INSERT/UPDATE/DELETE) — commit and return rowcount
            if result.returns_rows:
                cols = list(result.keys())
                rows: List[List[Any]] = [list(r) for r in result.fetchall()]
                elapsed = (time.perf_counter() - t0) * 1000
                return QueryResponse(
                    columns=cols,
                    rows=rows,
                    row_count=len(rows),
                    execution_time_ms=round(elapsed, 2),
                )
            else:
                conn.commit()
                elapsed = (time.perf_counter() - t0) * 1000
                return QueryResponse(
                    row_count=result.rowcount,
                    execution_time_ms=round(elapsed, 2),
                    message=f"{result.rowcount} row(s) affected",
                )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=normalize_db_error(exc))


# ---------------------------------------------------------------------------
# Paginated table data
# ---------------------------------------------------------------------------
@router.post("/table-data", response_model=QueryResponse)
async def get_table_data(req: TableDataRequest):
    entry = EngineFactory.get_session(req.session_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Session not found")

    dialect = entry.dialect
    
    # Ordering
    order = dialect.quote(req.order_by) if req.order_by else "1"
    offset = (req.page - 1) * req.page_size

    # Table reference
    table_ref = dialect.table_ref(req.schema_name, req.table)

    # Dynamic Filters
    query_params = {"lim": req.page_size, "off": offset}
    where_clauses = []
    if req.filters:
        for col, val in req.filters.items():
            if val:
                param_name = f"f_{col}"
                col_ref = dialect.quote(col)
                
                # Postgres requires explicit CAST to TEXT for numeric columns when using LIKE/ILIKE
                if entry.db_type == "postgresql":
                    col_ref = f"CAST({col_ref} AS TEXT)"
                
                if req.case_sensitive:
                    where_clauses.append(f"{col_ref} LIKE :{param_name}")
                    query_params[param_name] = f"%{val}%"
                else:
                    if entry.db_type == "postgresql":
                        where_clauses.append(f"{col_ref} ILIKE :{param_name}")
                        query_params[param_name] = f"%{val}%"
                    else:
                        where_clauses.append(f"LOWER({col_ref}) LIKE LOWER(:{param_name})")
                        query_params[param_name] = f"%{val}%"

    where_sql = ""
    if where_clauses:
        where_sql = "WHERE " + " AND ".join(where_clauses)

    # Ordering
    order = req.order_by if req.order_by else dialect.get_order_by_fallback()

    # Table reference
    table_ref = dialect.table_ref(req.schema_name, req.table)

    sql = dialect.get_table_data_sql(
        table_ref=table_ref,
        where_sql=where_sql,
        order=order,
        order_dir=req.order_dir,
        offset=offset,
        limit=req.page_size
    )

    try:
        with entry.engine.connect() as conn:
            t0 = time.perf_counter()
            result = conn.execute(text(sql), query_params)
            cols = list(result.keys())
            rows = [list(r) for r in result.fetchall()]
            elapsed = (time.perf_counter() - t0) * 1000
            return QueryResponse(
                columns=cols,
                rows=rows,
                row_count=len(rows),
                execution_time_ms=round(elapsed, 2),
            )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=normalize_db_error(exc))


# ---------------------------------------------------------------------------
# Inline cell update
# ---------------------------------------------------------------------------
@router.post("/update-cell")
async def update_cell(req: CellUpdateRequest, request: Request):
    entry = EngineFactory.get_session(req.session_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Session not found")

    dialect = entry.dialect
    table_ref = dialect.table_ref(req.schema_name, req.table)
    colq = dialect.quote(req.column)
    pkq = dialect.quote(req.primary_key_column)

    sql = f'UPDATE {table_ref} SET {colq} = :val WHERE {pkq} = :pk'
    _enforce_safe_mode(request, sql, allow_in_body=req.allow_destructive)

    try:
        with entry.engine.connect() as conn:
            conn.execute(text(sql), {"val": req.value, "pk": req.primary_key_value})
            conn.commit()
        return {"message": "Cell updated"}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
