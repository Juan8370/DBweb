"""Pydantic models for request / response validation."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------
class DBType(str, Enum):
    postgresql = "postgresql"
    mysql = "mysql"
    sqlserver = "sqlserver"


# ---------------------------------------------------------------------------
# Connection
# ---------------------------------------------------------------------------
class ConnectionRequest(BaseModel):
    db_type: DBType
    host: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    password: Optional[str] = None
    database: Optional[str] = None
    connection_string: Optional[str] = None
    use_ssl: bool = False


class ConnectionResponse(BaseModel):
    session_id: str
    db_type: str
    database: str
    message: str = "Connected successfully"


# ---------------------------------------------------------------------------
# Schema / ER
# ---------------------------------------------------------------------------
class ColumnInfo(BaseModel):
    name: str
    data_type: str
    is_nullable: bool = True
    is_primary: bool = False
    is_unique: bool = False
    is_autoincrement: bool = False
    default_value: Optional[str] = None
    character_maximum_length: Optional[int] = None


class TableInfo(BaseModel):
    name: str
    schema_name: str = "public"
    columns: List[ColumnInfo] = []
    row_count: Optional[int] = None


class ForeignKeyInfo(BaseModel):
    constraint_name: str
    source_table: str
    source_column: str
    target_table: str
    target_column: str


class SchemaResponse(BaseModel):
    tables: List[TableInfo]
    foreign_keys: List[ForeignKeyInfo]


# ---------------------------------------------------------------------------
# Query
# ---------------------------------------------------------------------------
class QueryRequest(BaseModel):
    session_id: str
    sql: str = Field(..., min_length=1)
    params: Optional[Dict[str, Any]] = None


class QueryResponse(BaseModel):
    columns: List[str] = []
    rows: List[List[Any]] = []
    row_count: int = 0
    execution_time_ms: float = 0.0
    message: str = ""


# ---------------------------------------------------------------------------
# Table data
# ---------------------------------------------------------------------------
class TableDataRequest(BaseModel):
    session_id: str
    table: str
    schema_name: str = "public"
    page: int = Field(1, ge=1)
    page_size: int = Field(50, ge=1, le=500)
    order_by: Optional[str] = None
    order_dir: str = Field("asc", pattern="^(asc|desc)$")
    filters: Optional[Dict[str, Any]] = None
    case_sensitive: bool = False


class CellUpdateRequest(BaseModel):
    session_id: str
    table: str
    schema_name: str = "public"
    primary_key_column: str
    primary_key_value: Any
    column: str
    value: Any


# ---------------------------------------------------------------------------
# DDL — Tables
# ---------------------------------------------------------------------------
class ColumnDefinition(BaseModel):
    name: str = Field(..., min_length=1)
    data_type: str = Field(..., min_length=1)
    is_nullable: bool = True
    is_primary: bool = False
    is_unique: bool = False
    is_autoincrement: bool = False
    default_value: Optional[str] = None


class CreateTableRequest(BaseModel):
    session_id: str
    table: str = Field(..., min_length=1)
    schema_name: str = "dbo"
    columns: List[ColumnDefinition] = Field(..., min_length=1)


class DropTableRequest(BaseModel):
    session_id: str
    table: str
    schema_name: str = "dbo"


class RenameTableRequest(BaseModel):
    session_id: str
    table: str
    schema_name: str = "dbo"
    new_name: str = Field(..., min_length=1)


# ---------------------------------------------------------------------------
# DDL — Columns
# ---------------------------------------------------------------------------
class AddColumnRequest(BaseModel):
    session_id: str
    table: str
    schema_name: str = "dbo"
    column: ColumnDefinition


class ModifyColumnRequest(BaseModel):
    session_id: str
    table: str
    schema_name: str = "dbo"
    column_name: str
    new_data_type: Optional[str] = None
    new_nullable: Optional[bool] = None
    is_primary: Optional[bool] = None
    is_unique: Optional[bool] = None
    is_autoincrement: Optional[bool] = None


class DropColumnRequest(BaseModel):
    session_id: str
    table: str
    schema_name: str = "dbo"
    column_name: str


class RenameColumnRequest(BaseModel):
    session_id: str
    table: str
    schema_name: str = "dbo"
    column_name: str
    new_name: str = Field(..., min_length=1)


# ---------------------------------------------------------------------------
# Records
# ---------------------------------------------------------------------------
class InsertRecordRequest(BaseModel):
    session_id: str
    table: str
    schema_name: str = "dbo"
    data: Dict[str, Any]


class BulkInsertRequest(BaseModel):
    session_id: str
    table: str
    schema_name: str = "dbo"
    data: List[Dict[str, Any]]


class DeleteRecordsRequest(BaseModel):
    session_id: str
    table: str
    schema_name: str = "dbo"
    primary_key_column: str
    primary_key_values: List[Any]


# ---------------------------------------------------------------------------
# DDL — Relationships
# ---------------------------------------------------------------------------
class CreateForeignKeyRequest(BaseModel):
    session_id: str
    source_table: str
    source_schema: str = "dbo"
    source_column: str
    target_table: str
    target_schema: str = "dbo"
    target_column: str


class DropForeignKeyRequest(BaseModel):
    session_id: str
    table: str
    schema_name: str = "dbo"
    constraint_name: str


# ---------------------------------------------------------------------------
# Internal Data (App persistence)
# ---------------------------------------------------------------------------
class SnippetSchema(BaseModel):
    id: Optional[str] = None
    name: str
    type: str
    content: str
    db_type: Optional[str] = None
    host: Optional[str] = None
    db_name: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class DocumentSchema(BaseModel):
    id: Optional[str] = None
    title: str
    content: str
    type: str  # 'custom' | 'system'
    db_type: Optional[str] = None
    host: Optional[str] = None
    db_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class SaveSnippetRequest(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    content: Optional[str] = None
    db_type: Optional[str] = None
    host: Optional[str] = None
    db_name: Optional[str] = None

class SaveDocumentRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    type: Optional[str] = "custom"
    db_type: Optional[str] = None
    host: Optional[str] = None
    db_name: Optional[str] = None

class NodePositionSchema(BaseModel):
    table_name: str
    x: str
    y: str
    db_type: Optional[str] = None
    host: Optional[str] = None
    db_name: Optional[str] = None

    class Config:
        from_attributes = True

class SaveNodePositionsRequest(BaseModel):
    positions: List[NodePositionSchema]
    db_type: Optional[str] = None
    host: Optional[str] = None
    db_name: Optional[str] = None
