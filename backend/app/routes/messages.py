from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from urllib.parse import unquote
import uuid

from app.db import messages_table
from app.auth import get_current_user, get_optional_user

router = APIRouter(prefix="/api/messages", tags=["Messages"])


class MessageCreate(BaseModel):
    sender_id: str
    content: str
    sender_name: Optional[str] = None
    type: str = "text"


class MessageEdit(BaseModel):
    content: str


# ─── GET /api/messages/{room_id} ── Get messages (paginated, newest first) ──
@router.get("/{room_id}")
def get_messages(room_id: str, limit: int = 50, cursor: Optional[str] = None):
    import json

    params: dict = {
        "KeyConditionExpression": "roomId = :rid",
        "ExpressionAttributeValues": {":rid": room_id},
        "ScanIndexForward": False,
        "Limit": limit,
    }
    if cursor:
        params["ExclusiveStartKey"] = json.loads(unquote(cursor))

    result = messages_table.query(**params)
    items = result.get("Items", [])

    next_cursor = None
    if "LastEvaluatedKey" in result:
        from urllib.parse import quote

        next_cursor = quote(json.dumps(result["LastEvaluatedKey"]))

    return {
        "messages": items,
        "cursor": next_cursor,
        "has_more": "LastEvaluatedKey" in result,
    }


# ─── POST /api/messages/{room_id} ── Send a message ─────────────────────────
@router.post("/{room_id}", status_code=201)
def send_message(room_id: str, body: MessageCreate, user: dict = Depends(get_current_user)):
    # Use authenticated user ID if available, fall back to body.sender_id
    sender_id = user.get("sub") if user.get("sub") != "anonymous" else body.sender_id
    message_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    sort_key = f"{now}#{message_id}"

    item = {
        "roomId": room_id,
        "sortKey": sort_key,
        "messageId": message_id,
        "senderId": sender_id,
        "senderName": body.sender_name,
        "content": body.content,
        "type": body.type,
        "createdAt": now,
        "editedAt": None,
    }
    messages_table.put_item(Item=item)

    # Publish to SSE subscribers
    from app.routes.sse import publish
    publish(room_id, "new_message", item)

    return {"message": item}


# ─── PUT /api/messages/{room_id}/{sort_key} ── Edit a message ────────────────
@router.put("/{room_id}/{sort_key}")
def edit_message(room_id: str, sort_key: str, body: MessageEdit):
    decoded_key = unquote(sort_key)
    now = datetime.now(timezone.utc).isoformat()

    try:
        result = messages_table.update_item(
            Key={"roomId": room_id, "sortKey": decoded_key},
            UpdateExpression="SET content = :content, editedAt = :now",
            ExpressionAttributeValues={":content": body.content, ":now": now},
            ReturnValues="ALL_NEW",
        )
        return {"message": result["Attributes"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── DELETE /api/messages/{room_id}/{sort_key} ── Delete a message ───────────
@router.delete("/{room_id}/{sort_key}")
def delete_message(room_id: str, sort_key: str, user: dict = Depends(get_current_user)):
    decoded_key = unquote(sort_key)
    messages_table.delete_item(Key={"roomId": room_id, "sortKey": decoded_key})

    # Broadcast deletion via SSE so all clients remove the message
    from app.routes.sse import publish
    publish(room_id, "message_deleted", {"roomId": room_id, "sortKey": decoded_key})

    return {"message": "Message deleted"}


# ─── GET /api/messages/by-sender/{sender_id} ── Messages by user (GSI) ──────
@router.get("/by-sender/{sender_id}")
def messages_by_sender(sender_id: str, limit: int = 50):
    result = messages_table.query(
        IndexName="senderId-index",
        KeyConditionExpression="senderId = :sid",
        ExpressionAttributeValues={":sid": sender_id},
        ScanIndexForward=False,
        Limit=limit,
    )
    return {"messages": result.get("Items", [])}
