import os
import uuid

import boto3
from fastapi import APIRouter, HTTPException, UploadFile, File

router = APIRouter(prefix="/api/uploads", tags=["Uploads"])

_region = os.getenv("AWS_REGION", "us-west-2")
_bucket = os.getenv("S3_UPLOADS_BUCKET", "chatroom-dev-uploads")

s3 = boto3.client("s3", region_name=_region)


# ─── POST /api/uploads ── Upload a file to S3 ────────────────────────────────
@router.post("", status_code=201)
async def upload_file(file: UploadFile = File(...)):
    file_id = str(uuid.uuid4())
    key = f"uploads/{file_id}/{file.filename}"
    content_type = file.content_type or "application/octet-stream"

    try:
        s3.upload_fileobj(
            file.file,
            _bucket,
            key,
            ExtraArgs={"ContentType": content_type},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"S3 upload failed: {e}")

    presigned_url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": _bucket, "Key": key},
        ExpiresIn=3600,
    )

    return {"key": key, "url": presigned_url}


# ─── GET /api/uploads/{key} ── Get a presigned download URL ──────────────────
@router.get("/{key:path}")
def get_upload_url(key: str):
    try:
        s3.head_object(Bucket=_bucket, Key=key)
    except s3.exceptions.NoSuchKey:
        raise HTTPException(status_code=404, detail="Object not found")
    except Exception:
        raise HTTPException(status_code=404, detail="Object not found")

    presigned_url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": _bucket, "Key": key},
        ExpiresIn=3600,
    )

    return {"key": key, "url": presigned_url}
