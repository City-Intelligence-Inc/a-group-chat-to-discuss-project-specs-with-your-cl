from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid

from app.db import chat_rooms_table, room_members_table
from app.auth import get_current_user

router = APIRouter(prefix="/api/rooms", tags=["Chat Rooms"])


class RoomCreate(BaseModel):
    name: str
    description: Optional[str] = None
    created_by: str


class RoomUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


# ─── GET /api/rooms ── List all rooms ────────────────────────────────────────
@router.get("/")
def list_rooms():
    result = chat_rooms_table.scan()
    return {"rooms": result.get("Items", [])}


# ─── GET /api/rooms/{room_id} ── Get room by ID ─────────────────────────────
@router.get("/{room_id}")
def get_room(room_id: str):
    result = chat_rooms_table.get_item(Key={"roomId": room_id})
    item = result.get("Item")
    if not item:
        raise HTTPException(status_code=404, detail="Room not found")
    return {"room": item}


# ─── POST /api/rooms ── Create a room ───────────────────────────────────────
@router.post("/", status_code=201)
def create_room(body: RoomCreate, user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    room_id = str(uuid.uuid4())

    room = {
        "roomId": room_id,
        "name": body.name,
        "description": body.description,
        "createdBy": body.created_by,
        "createdAt": now,
        "updatedAt": now,
    }
    chat_rooms_table.put_item(Item=room)

    # Auto-join creator as admin
    room_members_table.put_item(
        Item={
            "roomId": room_id,
            "userId": body.created_by,
            "role": "admin",
            "joinedAt": now,
            "lastReadAt": now,
        }
    )

    return {"room": room}


# ─── PUT /api/rooms/{room_id} ── Update room ────────────────────────────────
@router.put("/{room_id}")
def update_room(room_id: str, body: RoomUpdate):
    now = datetime.now(timezone.utc).isoformat()
    update_parts = ["updatedAt = :now"]
    values: dict = {":now": now}
    names: dict = {}

    if body.name is not None:
        update_parts.append("#n = :name")
        values[":name"] = body.name
        names["#n"] = "name"
    if body.description is not None:
        update_parts.append("description = :desc")
        values[":desc"] = body.description

    result = chat_rooms_table.update_item(
        Key={"roomId": room_id},
        UpdateExpression="SET " + ", ".join(update_parts),
        ExpressionAttributeValues=values,
        ExpressionAttributeNames=names if names else None,
        ReturnValues="ALL_NEW",
    )
    return {"room": result["Attributes"]}


# ─── DELETE /api/rooms/{room_id} ── Delete room ─────────────────────────────
@router.delete("/{room_id}")
def delete_room(room_id: str, user: dict = Depends(get_current_user)):
    chat_rooms_table.delete_item(Key={"roomId": room_id})
    return {"message": "Room deleted"}


# ─── GET /api/rooms/by-creator/{user_id} ── Rooms by creator (GSI) ──────────
@router.get("/by-creator/{user_id}")
def rooms_by_creator(user_id: str):
    result = chat_rooms_table.query(
        IndexName="createdBy-index",
        KeyConditionExpression="createdBy = :uid",
        ExpressionAttributeValues={":uid": user_id},
    )
    return {"rooms": result.get("Items", [])}
