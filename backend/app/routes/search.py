from fastapi import APIRouter
from typing import Optional
from boto3.dynamodb.conditions import Attr

from app.db import messages_table

router = APIRouter(prefix="/api/search", tags=["Search"])


# ─── GET /api/search ── Search messages ──────────────────────────────────────
@router.get("/")
def search_messages(q: str, room_id: Optional[str] = None, limit: int = 20):
    """
    Search messages by content. Uses DynamoDB scan with contains() filter.
    Fine for small-scale; production would use OpenSearch.
    """
    if not q.strip():
        return {"results": [], "count": 0}

    filter_expr = Attr("content").contains(q)
    if room_id:
        filter_expr = filter_expr & Attr("roomId").eq(room_id)

    params = {
        "FilterExpression": filter_expr,
        "Limit": 500,  # Scan limit (not result limit)
    }

    result = messages_table.scan(**params)
    items = result.get("Items", [])

    # Sort by createdAt descending and limit
    items.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    items = items[:limit]

    return {
        "results": items,
        "count": len(items),
        "query": q,
    }
