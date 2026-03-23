import asyncio
import json
import time
from datetime import datetime, timezone
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Dict, Set

router = APIRouter(prefix="/api/sse", tags=["SSE - Real-time"])

# In-memory channel subscribers: room_id -> set of asyncio.Queue
_channels: Dict[str, Set[asyncio.Queue]] = {}

# In-memory typing state: room_id -> {user_id: (username, expire_time)}
_typing: Dict[str, Dict[str, tuple]] = {}


def publish(room_id: str, event_type: str, data: dict):
    """Publish an event to all subscribers in a room."""
    if room_id not in _channels:
        return
    payload = f"event: {event_type}\ndata: {json.dumps(data, default=str)}\n\n"
    dead = set()
    for q in _channels[room_id]:
        try:
            q.put_nowait(payload)
        except asyncio.QueueFull:
            dead.add(q)
    _channels[room_id] -= dead


class TypingEvent(BaseModel):
    user_id: str
    username: str = ""


# ─── POST /api/sse/{room_id}/typing ── Signal typing (broadcasts via SSE) ───
@router.post("/{room_id}/typing")
def start_typing(room_id: str, body: TypingEvent):
    if room_id not in _typing:
        _typing[room_id] = {}
    _typing[room_id][body.user_id] = (body.username, time.time() + 5)  # 5s expiry

    # Clean expired entries
    now = time.time()
    _typing[room_id] = {uid: v for uid, v in _typing[room_id].items() if v[1] > now}

    # Broadcast current typers (excluding the sender)
    typers = [
        {"user_id": uid, "username": name}
        for uid, (name, exp) in _typing[room_id].items()
        if uid != body.user_id and exp > now
    ]
    publish(room_id, "typing", {
        "user_id": body.user_id,
        "username": body.username,
        "typers": typers,
    })
    return {"ok": True}


# ─── POST /api/sse/{room_id}/stop_typing ── Stop typing ─────────────────────
@router.post("/{room_id}/stop_typing")
def stop_typing(room_id: str, body: TypingEvent):
    if room_id in _typing:
        _typing[room_id].pop(body.user_id, None)
    publish(room_id, "stop_typing", {"user_id": body.user_id})
    return {"ok": True}


# ─── GET /api/sse/{room_id} ── Subscribe to room events ─────────────────────
@router.get("/{room_id}")
async def subscribe(room_id: str, request: Request):
    queue: asyncio.Queue = asyncio.Queue(maxsize=100)

    if room_id not in _channels:
        _channels[room_id] = set()
    _channels[room_id].add(queue)

    async def event_stream():
        try:
            # Send initial connected event
            yield f"event: connected\ndata: {json.dumps({'room_id': room_id, 'timestamp': datetime.now(timezone.utc).isoformat()})}\n\n"

            while True:
                if await request.is_disconnected():
                    break
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield payload
                except asyncio.TimeoutError:
                    # Send keepalive
                    yield f": keepalive\n\n"
        finally:
            _channels.get(room_id, set()).discard(queue)
            if room_id in _channels and not _channels[room_id]:
                del _channels[room_id]

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
