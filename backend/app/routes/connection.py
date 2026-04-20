"""Connection management routes."""

from fastapi import APIRouter, HTTPException

from app.engine_factory import EngineFactory
from app.schemas import ConnectionRequest, ConnectionResponse

router = APIRouter(prefix="/api/connection", tags=["connection"])


@router.post("/connect", response_model=ConnectionResponse)
async def connect(req: ConnectionRequest):
    """Test connection and return a session_id."""
    try:
        session_id = EngineFactory.connect(
            db_type=req.db_type.value,
            host=req.host,
            port=req.port,
            username=req.username,
            password=req.password,
            database=req.database,
            connection_string=req.connection_string,
            use_ssl=req.use_ssl,
        )
    except Exception as exc:
        print(f"DEBUG: Connection error -> {exc}")
        raise HTTPException(status_code=400, detail=str(exc))

    entry = EngineFactory.get_session(session_id)
    real_db_name = req.database
    if not real_db_name and entry:
        # Extract DB name from the actual engine URL
        real_db_name = entry.engine.url.database or "database"

    return ConnectionResponse(
        session_id=session_id,
        db_type=req.db_type.value,
        database=real_db_name,
    )


@router.post("/disconnect/{session_id}")
async def disconnect(session_id: str):
    """Dispose engine and remove session."""
    entry = EngineFactory.get_session(session_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Session not found")
    EngineFactory.dispose(session_id)
    return {"message": "Disconnected"}


@router.get("/sessions")
async def list_sessions():
    """List all active session IDs."""
    return {"sessions": EngineFactory.list_sessions()}
