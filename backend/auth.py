"""
Supabase JWT verification.

Frontend attaches the user's Supabase access token in the Authorization header.
This dependency validates the HS256 JWT with the project's JWT secret and
returns the user id (sub claim) for use in DB writes.

Routes that need auth:
    from backend.auth import verify_jwt
    @router.post("/run")
    def run(..., user_id: str = Depends(verify_jwt)):
        ...
"""
from __future__ import annotations

from typing import Optional

import jwt
from fastapi import Depends, Header, HTTPException, status

from backend.core.config import get_settings


def verify_jwt(authorization: Optional[str] = Header(default=None)) -> str:
    """Return Supabase user id (uuid string) from a valid Bearer token."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header (expected 'Bearer <token>').",
        )

    token = authorization.split(" ", 1)[1].strip()
    settings = get_settings()
    if not settings.supabase_jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server missing SUPABASE_JWT_SECRET — cannot verify tokens.",
        )

    try:
        decoded = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
            options={"require": ["sub", "exp"]},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidAudienceError:
        raise HTTPException(status_code=401, detail="Invalid token audience")
    except jwt.PyJWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid JWT: {e}")

    user_id = decoded.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing 'sub' claim")
    return user_id


def optional_verify_jwt(authorization: Optional[str] = Header(default=None)) -> Optional[str]:
    """Same as verify_jwt but returns None instead of 401 when header is absent."""
    if not authorization:
        return None
    return verify_jwt(authorization)
