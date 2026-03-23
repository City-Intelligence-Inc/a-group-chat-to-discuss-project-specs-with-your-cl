"""
Clerk JWT verification middleware for FastAPI.

Verifies RS256 JWTs using Clerk's JWKS endpoint.
If CLERK_JWKS_URL is not set, auth is bypassed (development mode).
"""

import os
import time
from typing import Optional

import httpx
from fastapi import Depends, HTTPException, Request
from jose import JWTError, jwt

_JWKS_URL = os.getenv("CLERK_JWKS_URL")  # e.g. https://<instance>.clerk.accounts.dev/.well-known/jwks.json
_JWKS_CACHE: dict = {"keys": [], "fetched_at": 0}
_JWKS_TTL = 3600  # Cache JWKS for 1 hour


def _get_jwks() -> list:
    """Fetch and cache JWKS keys from Clerk."""
    now = time.time()
    if _JWKS_CACHE["keys"] and now - _JWKS_CACHE["fetched_at"] < _JWKS_TTL:
        return _JWKS_CACHE["keys"]

    if not _JWKS_URL:
        return []

    try:
        resp = httpx.get(_JWKS_URL, timeout=5)
        resp.raise_for_status()
        keys = resp.json().get("keys", [])
        _JWKS_CACHE["keys"] = keys
        _JWKS_CACHE["fetched_at"] = now
        return keys
    except Exception:
        return _JWKS_CACHE["keys"]  # Return stale cache on failure


def _extract_token(request: Request) -> Optional[str]:
    """Extract Bearer token from Authorization header."""
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return None


def verify_clerk_token(token: str) -> dict:
    """Verify a Clerk JWT and return the claims."""
    keys = _get_jwks()
    if not keys:
        raise HTTPException(status_code=500, detail="JWKS not available")

    try:
        # Decode without verification first to get the key ID
        unverified = jwt.get_unverified_header(token)
        kid = unverified.get("kid")

        # Find the matching key
        rsa_key = {}
        for key in keys:
            if key.get("kid") == kid:
                rsa_key = key
                break

        if not rsa_key:
            raise HTTPException(status_code=401, detail="Token signing key not found")

        claims = jwt.decode(
            token,
            rsa_key,
            algorithms=["RS256"],
            options={"verify_aud": False},  # Clerk tokens don't always have aud
        )
        return claims
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")


async def get_current_user(request: Request) -> dict:
    """
    FastAPI dependency: extract and verify Clerk JWT.

    Returns the JWT claims dict with at minimum {"sub": "<clerk_user_id>"}.
    If CLERK_JWKS_URL is not configured, falls back to trusting the
    X-User-Id header (development mode only).
    """
    if not _JWKS_URL:
        # Development mode: trust header or body
        user_id = request.headers.get("X-User-Id")
        if user_id:
            return {"sub": user_id}
        return {"sub": "anonymous"}

    token = _extract_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Missing authorization token")

    return verify_clerk_token(token)


async def get_optional_user(request: Request) -> Optional[dict]:
    """
    Like get_current_user but returns None instead of raising if no token.
    Useful for endpoints that work with or without auth.
    """
    if not _JWKS_URL:
        user_id = request.headers.get("X-User-Id")
        if user_id:
            return {"sub": user_id}
        return None

    token = _extract_token(request)
    if not token:
        return None

    try:
        return verify_clerk_token(token)
    except HTTPException:
        return None
