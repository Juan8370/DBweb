"""
SQL Dialects — Abstraction layer for database-specific syntax.
"""

from __future__ import annotations
from typing import Any, List, Optional
from sqlalchemy import text

class BaseDialect:
    """Base class for all database dialects."""
    
    def quote(self, name: str) -> str:
        return f'"{name}"'

    def table_ref(self, schema: str, table: str) -> str:
        # Default to "schema"."table"
        s = schema or self.default_schema
        if s == "public" and self.default_schema == "dbo":
            s = "dbo"
        return f'{self.quote(s)}.{self.quote(table)}'

    @property
    def default_schema(self) -> str:
        return "public"

    def get_columns_sql(self) -> str:
        raise NotImplementedError

    def get_fks_sql(self) -> str:
        raise NotImplementedError

    def get_table_data_sql(self, table_ref: str, where_sql: str, order: str, order_dir: str, offset: int, limit: int) -> str:
        # Check if order is numeric (positional)
        order_clause = order
        if order.isdigit():
            order_clause = order
        else:
            order_clause = self.quote(order)
            
        return f"SELECT * FROM {table_ref} {where_sql} ORDER BY {order_clause} {order_dir} LIMIT {limit} OFFSET {offset}"

    def get_order_by_fallback(self) -> str:
        return "1"

    def get_rename_table_sql(self, schema: str, table: str, new_name: str) -> str:
        tref = self.table_ref(schema, table)
        return f"ALTER TABLE {tref} RENAME TO {self.quote(new_name)}"

    def get_modify_column_sql(self, schema: str, table: str, column: str, new_type: Optional[str], new_nullable: Optional[bool], is_primary: bool = False, is_unique: bool = False, is_autoincrement: bool = False) -> List[str]:
        tref = self.table_ref(schema, table)
        colq = self.quote(column)
        statements = []
        if new_type:
            statements.append(f"ALTER TABLE {tref} ALTER COLUMN {colq} TYPE {new_type}")
        if new_nullable is not None:
            action = "DROP NOT NULL" if new_nullable else "SET NOT NULL"
            statements.append(f"ALTER TABLE {tref} ALTER COLUMN {colq} {action}")
        
        if is_primary:
            statements.append(f"ALTER TABLE {tref} ADD PRIMARY KEY ({colq})")
        if is_unique:
            statements.append(f"ALTER TABLE {tref} ADD UNIQUE ({colq})")
        return statements

    def get_rename_column_sql(self, schema: str, table: str, column: str, new_name: str) -> str:
        tref = self.table_ref(schema, table)
        return f"ALTER TABLE {tref} RENAME COLUMN {self.quote(column)} TO {self.quote(new_name)}"

    def get_drop_table_sql(self, schema: str, table: str) -> str:
        return f"DROP TABLE {self.table_ref(schema, table)}"

    def get_create_table_sql(self, schema: str, table: str, columns: List[Any]) -> str:
        tref = self.table_ref(schema, table)
        col_defs = []
        pk_cols = []
        for c in columns:
            parts = [self.quote(c.name), c.data_type]
            
            # Identity / Autoincrement
            if getattr(c, 'is_autoincrement', False):
                parts.append(self.get_autoincrement_str(c.data_type))

            if not getattr(c, 'is_nullable', True):
                parts.append("NOT NULL")
                
            if getattr(c, 'is_unique', False):
                parts.append("UNIQUE")

            if getattr(c, 'default_value', None) is not None:
                parts.append(f"DEFAULT {c.default_value}")
                
            if getattr(c, 'is_primary', False):
                pk_cols.append(self.quote(c.name))
                
            col_defs.append(" ".join(parts))

        if pk_cols:
            col_defs.append(f"PRIMARY KEY ({', '.join(pk_cols)})")

        return f"CREATE TABLE {tref} (\n  {', '.join(col_defs)}\n)"

    def get_autoincrement_str(self, data_type: str) -> str:
        return ""

    def get_add_column_sql(self, schema: str, table: str, column: Any) -> str:
        tref = self.table_ref(schema, table)
        parts = [self.quote(column.name), column.data_type]
        if not getattr(column, 'is_nullable', True):
            parts.append("NOT NULL")
        if getattr(column, 'default_value', None) is not None:
            parts.append(f"DEFAULT {column.default_value}")
        return f"ALTER TABLE {tref} ADD COLUMN {' '.join(parts)}"

    def get_drop_column_sql(self, schema: str, table: str, column: str) -> str:
        tref = self.table_ref(schema, table)
        return f"ALTER TABLE {tref} DROP COLUMN {self.quote(column)}"

    def get_create_foreign_key_sql(self, source_schema: str, source_table: str, source_column: str, target_schema: str, target_table: str, target_column: str) -> str:
        t_src = self.table_ref(source_schema, source_table)
        t_tgt = self.table_ref(target_schema, target_table)
        c_src = self.quote(source_column)
        c_tgt = self.quote(target_column)

        constraint_name = f"fk_{source_table}_{source_column}_{target_table}"
        cq = self.quote(constraint_name)

        return (
            f"ALTER TABLE {t_src} ADD CONSTRAINT {cq} "
            f"FOREIGN KEY ({c_src}) REFERENCES {t_tgt} ({c_tgt})"
        )

    def get_drop_foreign_key_sql(self, table_ref: str, constraint_name: str) -> str:
        return f"ALTER TABLE {table_ref} DROP CONSTRAINT {self.quote(constraint_name)}"


class PostgresDialect(BaseDialect):
    def get_autoincrement_str(self, data_type: str) -> str:
        if "SERIAL" not in data_type.upper():
            return "GENERATED BY DEFAULT AS IDENTITY"
        return ""

    def get_columns_sql(self) -> str:
        return """
            SELECT
                c.table_schema,
                c.table_name,
                c.column_name,
                c.data_type,
                c.is_nullable,
                c.column_default,
                c.character_maximum_length,
                CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END AS is_primary
            FROM information_schema.columns c
            LEFT JOIN (
                SELECT ku.table_schema, ku.table_name, ku.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage ku
                    ON tc.constraint_name = ku.constraint_name
                    AND tc.table_schema = ku.table_schema
                WHERE tc.constraint_type = 'PRIMARY KEY'
            ) pk ON c.table_schema = pk.table_schema
                AND c.table_name = pk.table_name
                AND c.column_name = pk.column_name
            WHERE c.table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY c.table_schema, c.table_name, c.ordinal_position
        """

    def get_fks_sql(self) -> str:
        return """
            SELECT
                tc.constraint_name,
                kcu.table_name AS source_table,
                kcu.column_name AS source_column,
                ccu.table_name AS target_table,
                ccu.column_name AS target_column
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage ccu
                ON tc.constraint_name = ccu.constraint_name
                AND tc.table_schema = ccu.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
                AND tc.table_schema NOT IN ('pg_catalog', 'information_schema')
        """
        
    def get_modify_column_sql(self, schema: str, table: str, column: str, new_type: Optional[str], new_nullable: Optional[bool]) -> List[str]:
        tref = self.table_ref(schema, table)
        colq = self.quote(column)
        statements = []
        if new_type:
            # Postgres often requires an explicit USING clause for type conversion
            statements.append(f"ALTER TABLE {tref} ALTER COLUMN {colq} TYPE {new_type} USING {colq}::{new_type}")
        if new_nullable is not None:
            action = "DROP NOT NULL" if new_nullable else "SET NOT NULL"
            statements.append(f"ALTER TABLE {tref} ALTER COLUMN {colq} {action}")
        return statements


class MySQLDialect(BaseDialect):
    def quote(self, name: str) -> str:
        return f"`{name}`"

    def get_autoincrement_str(self, data_type: str) -> str:
        return "AUTO_INCREMENT"

    def table_ref(self, schema: str, table: str) -> str:
        # MySQL doesn't use schemas in the same way as Postgres/SQLServer
        # unless it's a cross-database query.
        if schema and schema != "public":
            return f"`{schema}`.`{table}`"
        return f"`{table}`"

    def get_columns_sql(self) -> str:
        return """
            SELECT
                c.table_schema,
                c.table_name,
                c.column_name,
                c.data_type,
                c.is_nullable,
                c.column_default,
                c.character_maximum_length,
                CASE WHEN pk.column_name IS NOT NULL THEN 1 ELSE 0 END AS is_primary
            FROM information_schema.columns c
            LEFT JOIN (
                SELECT ku.table_schema, ku.table_name, ku.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage ku
                    ON tc.constraint_name = ku.constraint_name
                    AND tc.table_schema = ku.table_schema
                WHERE tc.constraint_type = 'PRIMARY KEY'
            ) pk ON c.table_schema = pk.table_schema
                AND c.table_name = pk.table_name
                AND c.column_name = pk.column_name
            WHERE c.table_schema = DATABASE()
            ORDER BY c.table_name, c.ordinal_position
        """

    def get_fks_sql(self) -> str:
        return """
            SELECT
                rc.CONSTRAINT_NAME AS constraint_name,
                kcu.TABLE_NAME AS source_table,
                kcu.COLUMN_NAME AS source_column,
                kcu.REFERENCED_TABLE_NAME AS target_table,
                kcu.REFERENCED_COLUMN_NAME AS target_column
            FROM information_schema.REFERENTIAL_CONSTRAINTS rc
            JOIN information_schema.KEY_COLUMN_USAGE kcu
                ON rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
                AND rc.CONSTRAINT_SCHEMA = kcu.TABLE_SCHEMA
            WHERE rc.CONSTRAINT_SCHEMA = DATABASE()
        """

    def get_rename_table_sql(self, schema: str, table: str, new_name: str) -> str:
        return f"ALTER TABLE `{table}` RENAME TO `{new_name}`"

    def get_modify_column_sql(self, schema: str, table: str, column: str, new_type: Optional[str], new_nullable: Optional[bool], is_primary: bool = False, is_unique: bool = False, is_autoincrement: bool = False) -> List[str]:
        colq = self.quote(column)
        dtype = new_type or "VARCHAR(255)"
        null_str = "NULL" if new_nullable else "NOT NULL"
        auto_str = "AUTO_INCREMENT" if is_autoincrement else ""
        
        statements = [f"ALTER TABLE `{table}` MODIFY COLUMN {colq} {dtype} {null_str} {auto_str}"]
        
        if is_primary:
            statements.append(f"ALTER TABLE `{table}` ADD PRIMARY KEY ({colq})")
        elif is_unique:
            statements.append(f"ALTER TABLE `{table}` ADD UNIQUE ({colq})")
        return statements

    def get_rename_column_sql(self, schema: str, table: str, column: str, new_name: str) -> str:
        return f"ALTER TABLE `{table}` RENAME COLUMN `{column}` TO `{new_name}`"

    def get_drop_foreign_key_sql(self, table_ref: str, constraint_name: str) -> str:
        return f"ALTER TABLE {table_ref} DROP FOREIGN KEY {self.quote(constraint_name)}"


class SQLServerDialect(BaseDialect):
    def quote(self, name: str) -> str:
        return f"[{name}]"

    def get_autoincrement_str(self, data_type: str) -> str:
        return "IDENTITY(1,1)"

    @property
    def default_schema(self) -> str:
        return "dbo"

    def table_ref(self, schema: str, table: str) -> str:
        s = schema or self.default_schema
        # Correction: if user sends 'public' (default in frontend) for SQL Server, use 'dbo'
        if s == "public":
            s = "dbo"
        return f"[{s}].[{table}]"

    def get_columns_sql(self) -> str:
        return """
            SELECT 
                SCHEMA_NAME(t.schema_id) AS table_schema,
                t.name AS table_name,
                c.name AS column_name,
                TYPE_NAME(c.user_type_id) AS data_type,
                c.is_nullable AS is_nullable,
                OBJECT_DEFINITION(c.default_object_id) AS column_default,
                CASE WHEN pk.column_id IS NOT NULL THEN 1 ELSE 0 END AS is_primary,
                CASE WHEN un.column_id IS NOT NULL THEN 1 ELSE 0 END AS is_unique,
                c.max_length AS character_maximum_length
            FROM sys.tables t
            INNER JOIN sys.columns c ON t.object_id = c.object_id
            LEFT JOIN (
                SELECT ic.object_id, ic.column_id
                FROM sys.index_columns ic
                INNER JOIN sys.indexes i ON ic.object_id = i.object_id AND ic.index_id = i.index_id
                WHERE i.is_primary_key = 1
            ) pk ON t.object_id = pk.object_id AND c.column_id = pk.column_id
            LEFT JOIN (
                SELECT DISTINCT ic.object_id, ic.column_id
                FROM sys.index_columns ic
                INNER JOIN sys.indexes i ON ic.object_id = i.object_id AND ic.index_id = i.index_id
                WHERE i.is_unique = 1 OR i.is_unique_constraint = 1
            ) un ON t.object_id = un.object_id AND c.column_id = un.column_id
            WHERE t.is_ms_shipped = 0
            ORDER BY t.name, c.column_id
        """

    def get_fks_sql(self) -> str:
        return """
            SELECT
                fk.name AS constraint_name,
                tp.name AS source_table,
                cp.name AS source_column,
                tr.name AS target_table,
                cr.name AS target_column
            FROM sys.foreign_keys fk
            JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
            JOIN sys.tables tp ON fkc.parent_object_id = tp.object_id
            JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
            JOIN sys.tables tr ON fkc.referenced_object_id = tr.object_id
            JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
        """

    def get_table_data_sql(self, table_ref: str, where_sql: str, order: str, order_dir: str, offset: int, limit: int) -> str:
        # Check if order is numeric (positional)
        order_clause = order
        if order.isdigit() or "(" in order: # Handle 1 or (SELECT NULL)
            order_clause = order
        else:
            order_clause = self.quote(order)

        # SQL Server requires OFFSET/FETCH for pagination with ORDER BY
        return f"SELECT * FROM {table_ref} {where_sql} ORDER BY {order_clause} {order_dir} OFFSET {offset} ROWS FETCH NEXT {limit} ROWS ONLY"

    def get_order_by_fallback(self) -> str:
        return "(SELECT NULL)"

    def get_rename_table_sql(self, schema: str, table: str, new_name: str) -> str:
        s = schema or self.default_schema
        if s == "public":
            s = "dbo"
        old_ref = f"{s}.{table}"
        return f"EXEC sp_rename '{old_ref}', '{new_name}'"

    def get_modify_column_sql(self, schema: str, table: str, column: str, new_type: Optional[str], new_nullable: Optional[bool], is_primary: bool = False, is_unique: bool = False, is_autoincrement: bool = False) -> List[str]:
        tref = self.table_ref(schema, table)
        colq = self.quote(column)
        dtype = new_type or "NVARCHAR(255)"
        null_str = "NULL" if new_nullable else "NOT NULL"
        
        # SQL Server: Only Basic Type/Nullable can be done in one ALTER COLUMN
        stmts = [f"ALTER TABLE {tref} ALTER COLUMN {colq} {dtype} {null_str}"]
        
        # Constraints must be added separately
        if is_primary:
            # We use a naming convention to make it easier to drop later if needed
            constraint_name = f"PK_{table}_{column}"
            stmts.append(f"ALTER TABLE {tref} ADD CONSTRAINT {constraint_name} PRIMARY KEY ({colq})")
        
        if is_unique:
            constraint_name = f"UQ_{table}_{column}"
            stmts.append(f"ALTER TABLE {tref} ADD CONSTRAINT {constraint_name} UNIQUE ({colq})")
            
        # Note: IDENTITY (Autoincrement) cannot be added to an existing column in SQL Server 
        # without recreating the table or complex maneuvers. We log it or ignore for now.
        return stmts

    def get_rename_column_sql(self, schema: str, table: str, column: str, new_name: str) -> str:
        s = schema or self.default_schema
        if s == "public":
            s = "dbo"
        old_ref = f"{s}.{table}.{column}"
        return f"EXEC sp_rename '{old_ref}', '{new_name}', 'COLUMN'"


def get_dialect(db_type: str) -> BaseDialect:
    if db_type == "postgresql":
        return PostgresDialect()
    if db_type == "mysql":
        return MySQLDialect()
    if db_type == "sqlserver":
        return SQLServerDialect()
    raise ValueError(f"Unsupported database type for dialect: {db_type}")
