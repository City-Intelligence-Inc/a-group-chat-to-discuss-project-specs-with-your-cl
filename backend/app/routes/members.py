from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta

from app.db import room_members_table, chat_rooms_table, users_table

router = APIRouter(prefix="/api/members", tags=["Room Members"])


class JoinRoom(BaseModel):
    user_id: str


class KickMember(BaseModel):
    admin_user_id: str


# ─── GET /api/members/{room_id} ── List members of a room (enriched) ────────
@router.get("/{room_id}")
def list_members(room_id: str):
    result = room_members_table.query(
        KeyConditionExpression="roomId = :rid",
        ExpressionAttributeValues={":rid": room_id},
    )
    members = result.get("Items", [])

    # Enrich with user data
    for m in members:
        user = users_table.get_item(Key={"userId": m["userId"]}).get("Item")
        if user:
            m["username"] = user.get("username", m["userId"])
            m["avatarUrl"] = user.get("avatarUrl")
        else:
            m["username"] = m["userId"]

    return {"members": members}


# ─── GET /api/members/user/{user_id} ── Rooms a user belongs to (GSI) ───────
@router.get("/user/{user_id}")
def user_rooms(user_id: str):
    result = room_members_table.query(
        IndexName="userId-index",
        KeyConditionExpression="userId = :uid",
        ExpressionAttributeValues={":uid": user_id},
    )
    return {"memberships": result.get("Items", [])}


# ─── POST /api/members/{room_id}/join ── Join a room ────────────────────────
@router.post("/{room_id}/join", status_code=201)
def join_room(room_id: str, body: JoinRoom):
    # Check room exists
    room = chat_rooms_table.get_item(Key={"roomId": room_id})
    if not room.get("Item"):
        raise HTTPException(status_code=404, detail="Room not found")

    # Check not already member
    existing = room_members_table.get_item(
        Key={"roomId": room_id, "userId": body.user_id}
    )
    if existing.get("Item"):
        raise HTTPException(status_code=409, detail="Already a member")

    now = datetime.now(timezone.utc).isoformat()
    member = {
        "roomId": room_id,
        "userId": body.user_id,
        "role": "member",
        "joinedAt": now,
        "lastReadAt": now,
    }
    room_members_table.put_item(Item=member)
    return {"member": member}


# ─── DELETE /api/members/{room_id}/leave/{user_id} ── Leave a room ──────────
@router.delete("/{room_id}/leave/{user_id}")
def leave_room(room_id: str, user_id: str):
    room_members_table.delete_item(Key={"roomId": room_id, "userId": user_id})
    return {"message": "Left room"}


# ─── PATCH /api/members/{room_id}/read/{user_id} ── Mark room as read ───────
@router.patch("/{room_id}/read/{user_id}")
def mark_read(room_id: str, user_id: str):
    now = datetime.now(timezone.utc).isoformat()
    try:
        room_members_table.update_item(
            Key={"roomId": room_id, "userId": user_id},
            UpdateExpression="SET lastReadAt = :now",
            ExpressionAttributeValues={":now": now},
        )
    except Exception:
        pass
    return {"lastReadAt": now}


# ─── GET /api/members/{room_id}/read/{user_id} ── Get last read timestamp ───
@router.get("/{room_id}/read/{user_id}")
def get_read(room_id: str, user_id: str):
    result = room_members_table.get_item(Key={"roomId": room_id, "userId": user_id})
    item = result.get("Item", {})
    return {"lastReadAt": item.get("lastReadAt")}


# ─── DELETE /api/members/{room_id}/kick/{user_id} ── Kick member (admin) ────
@router.delete("/{room_id}/kick/{user_id}")
def kick_member(room_id: str, user_id: str, admin_user_id: str):
    # Verify admin
    admin = room_members_table.get_item(
        Key={"roomId": room_id, "userId": admin_user_id}
    )
    if not admin.get("Item") or admin["Item"].get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can kick members")

    room_members_table.delete_item(Key={"roomId": room_id, "userId": user_id})
    return {"message": "Member kicked"}
