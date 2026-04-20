"""
Engine Factory — Dynamic SQLAlchemy engine creation via Factory Pattern.
Supports PostgreSQL, MySQL and SQL Server.
"""

from __future__ import annotations

import json
import urllib.parse
import uuid
from typing import Dict, Optional

from cryptography.fernet import Fernet
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from app.dialects import BaseDialect, get_dialect

# ---------------------------------------------------------------------------
# Encryption helper (Fernet symmetric — key rotated per process lifetime)
# ---------------------------------------------------------------------------
_FERNET_KEY: bytes = Fernet.generate_key()
_fernet = Fernet(_FERNET_KEY)


def encrypt(value: str) -> str:
    return _fernet.encrypt(value.encode()).decode()


def decrypt(value: str) -> str:
    return _fernet.decrypt(value.encode()).decode()


# ---------------------------------------------------------------------------
# Driver mapping
# ---------------------------------------------------------------------------
_DRIVER_MAP = {
    "postgresql": "postgresql+psycopg2",
    "mysql": "mysql+pymysql",
    "sqlserver": "mssql+pyodbc",
}


def _get_best_sql_driver() -> str:
    """Detect the best installed ODBC driver for SQL Server."""
    try:
        import pyodbc
        available = pyodbc.drivers()
        # Order of preference
        for driver in ["ODBC Driver 18 for SQL Server", "ODBC Driver 17 for SQL Server", "ODBC Driver 13 for SQL Server", "SQL Server"]:
            if driver in available:
                return driver
        return "ODBC Driver 18 for SQL Server" # Fallback if list empty
    except ImportError:
        return "ODBC Driver 18 for SQL Server"

def _build_url(
    db_type: str,
    host: Optional[str] = None,
    port: Optional[int] = None,
    username: Optional[str] = None,
    password: Optional[str] = None,
    database: Optional[str] = None,
    connection_string: Optional[str] = None,
    use_ssl: bool = False
) -> str:
    """Build a SQLAlchemy connection URL or return the raw string if provided."""
    if connection_string:
        return connection_string

    scheme = _DRIVER_MAP.get(db_type)
    if scheme is None:
        raise ValueError(f"Unsupported database type: {db_type}. Use one of {list(_DRIVER_MAP.keys())}")

    user_enc = urllib.parse.quote_plus(username or "")
    pass_enc = urllib.parse.quote_plus(password or "")

    host_port = f"{host}:{port}" if port else host

    params = {}
    if db_type == "sqlserver":
        params["driver"] = _get_best_sql_driver()
        # Driver 18 requires TrustServerCertificate=yes if not using a real CA
        if "18" in params["driver"]:
            params["TrustServerCertificate"] = "yes"
            params["Encrypt"] = "yes" if use_ssl else "no"
        
        # For named instances (e.g. localhost\MyDB), we must NOT include the port
        if host and "\\" in host:
            host_port = host
    elif db_type == "postgresql":
        params["sslmode"] = "require" if use_ssl else "disable"
    elif db_type == "mysql":
        if use_ssl:
            params["ssl_disabled"] = "0" # Some drivers use this
            params["ssl"] = "true"       # Others use this
        else:
            params["ssl_disabled"] = "1"

    query_str = ""
    if params:
        query_str = "?" + urllib.parse.urlencode(params)

    return f"{scheme}://{user_enc}:{pass_enc}@{host_port}/{database}{query_str}"


# ---------------------------------------------------------------------------
# Session store  (in-memory for MVP — swap for Redis in production)
# ---------------------------------------------------------------------------
class SessionEntry:
    """Holds a live engine and encrypted credentials."""

    def __init__(self, engine: Engine, db_type: str, credentials_blob: str, dialect: BaseDialect):
        self.engine = engine
        self.db_type = db_type
        self.credentials_blob = credentials_blob  # Fernet-encrypted JSON
        self.dialect = dialect


_sessions: Dict[str, SessionEntry] = {}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
class EngineFactory:
    """Factory that creates, tests and caches SQLAlchemy engines."""

    @staticmethod
    def connect(
        db_type: str,
        host: Optional[str] = None,
        port: Optional[int] = None,
        username: Optional[str] = None,
        password: Optional[str] = None,
        database: Optional[str] = None,
        connection_string: Optional[str] = None,
        use_ssl: bool = False,
    ) -> str:
        """
        Create an engine, verify the connection and return a session_id.

        Raises
        ------
        ConnectionError  if the test query fails.
        ValueError       if *db_type* is unsupported.
        """
        try:
            url = _build_url(db_type, host, port, username, password, database, connection_string, use_ssl)
            engine = create_engine(
                url,
                pool_size=5,
                max_overflow=10,
                pool_pre_ping=True,
                pool_recycle=3600,
            )

            # Test the connection
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
        except Exception as exc:
            if 'engine' in locals():
                engine.dispose()
            raise ConnectionError(f"Cannot reach {db_type}://{host or 'custom_url'} — {exc}") from exc

        # Persist
        creds = json.dumps(
            {
                "db_type": db_type,
                "host": host,
                "port": port,
                "username": username,
                "password": password,
                "database": database,
                "connection_string": connection_string,
                "use_ssl": use_ssl,
            }
        )
        session_id = uuid.uuid4().hex
        _sessions[session_id] = SessionEntry(
            engine=engine,
            db_type=db_type,
            credentials_blob=encrypt(creds),
            dialect=get_dialect(db_type)
        )
        return session_id

    @staticmethod
    def get_session(session_id: str) -> Optional[SessionEntry]:
        return _sessions.get(session_id)

    @staticmethod
    def dispose(session_id: str) -> None:
        entry = _sessions.pop(session_id, None)
        if entry:
            entry.engine.dispose()

    @staticmethod
    def list_sessions() -> list[str]:
        return list(_sessions.keys())
