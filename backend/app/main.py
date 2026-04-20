"""
Universal Database Manager — FastAPI entry point.
"""

from __future__ import annotations

import asyncio
import json
import os
from datetime import datetime
from typing import List

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.routes import connection, query, schema, ddl, records, internal
from app.error_normalizer import normalize_db_error
from app.internal_db import init_db

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Universal Database Manager",
    version="2.0.0",
    description="Agnostic database management API supporting PostgreSQL, MySQL and SQL Server",
)

# Initialize Internal SQLite DB
init_db()

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Log the full error to stdout
    import traceback
    print(traceback.format_exc())
    
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal Server Error: {normalize_db_error(str(exc))}"},
    )

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(connection.router)
app.include_router(schema.router)
app.include_router(query.router)
app.include_router(ddl.router)
app.include_router(records.router)
app.include_router(internal.router)


# ---------------------------------------------------------------------------
# WebSocket — real-time log broadcast
# ---------------------------------------------------------------------------
class LogBroadcaster:
    """Simple in-memory pub/sub for WebSocket log streaming."""

    def __init__(self):
        self._connections: List[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self._connections.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self._connections:
            self._connections.remove(ws)

    async def broadcast(self, message: dict):
        dead: list[WebSocket] = []
        for ws in self._connections:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


log_broadcaster = LogBroadcaster()


@app.websocket("/ws/logs")
async def ws_logs(websocket: WebSocket):
    await log_broadcaster.connect(websocket)
    try:
        while True:
            # Keep alive — client can send pings
            await websocket.receive_text()
    except WebSocketDisconnect:
        log_broadcaster.disconnect(websocket)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@app.get("/api/health")
async def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}
