from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import users, rooms, members, messages, connections, sse, ws, search, uploads

app = FastAPI(
    title="Chat Room API",
    description="Real-time chat room backend — CRUD for Users, Rooms, Members, Messages, Connections",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    from datetime import datetime, timezone

    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


# ─── Mount route modules ─────────────────────────────────────────────────────
app.include_router(users.router)
app.include_router(rooms.router)
app.include_router(members.router)
app.include_router(messages.router)
app.include_router(connections.router)
app.include_router(sse.router)
app.include_router(ws.router)
app.include_router(search.router)
app.include_router(uploads.router)
