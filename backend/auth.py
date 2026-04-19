"""
Supabase JWT verification.

Handles both:
  1. Legacy HS256 tokens signed with SUPABASE_JWT_SECRET
  2. Newer ES256 / EdDSA / RS256 asymmetric tokens (Supabase default since 2025)

Strategy: read the JWT header, pick a verification path:
  - HS256              → symmetric secret
  - ES256/EdDSA/RS256  → fetch signing key from {supabase_url}/auth/v1/.well-known/jwks.json

Public keys are cached in-process via PyJWKClient.
"""
from __future__ import annotations

import logging
from functools import lru_cache
from typing import Optional

import jwt
from fastapi import Depends, Header, HTTPException, status
from jwt import PyJWKClient

from backend.core.config import get_settings

logger = logging.getLogger(__name__)

ASYMMETRIC_ALGS = {"ES256", "RS256", "EdDSA", "ES384", "RS384", "RS512"}


@lru_cache
def _jwks_client() -> Optional[PyJWKClient]:
    """One shared JWKS client per process. Caches public keys."""
    url = get_settings().supabase_url
    if not url:
        return None
    jwks_url = url.rstrip("/") + "/auth/v1/.well-known/jwks.json"
    return PyJWKClient(jwks_url, cache_keys=True, lifespan=3600)


def _verify_token(token: str) -> dict:
    """Decode & verify the JWT. Picks the right key path based on header.alg."""
    try:
        header = jwt.get_unverified_header(token)
    except jwt.DecodeError as e:
        raise HTTPException(status_code=401, detail=f"Malformed JWT header: {e}")

    alg = header.get("alg", "HS256")
    settings = get_settings()

    if alg == "HS256":
        secret = settings.supabase_jwt_secret
        if not secret:
            raise HTTPException(
                status_code=500,
                detail="HS256 token but SUPABASE_JWT_SECRET not configured.",
            )
        try:
            return jwt.decode(
                token,
                secret,
                algorithms=["HS256"],
                audience="authenticated",
                options={"require": ["sub", "exp"]},
            )
        except jwt.PyJWTError as e:
            raise HTTPException(status_code=401, detail=f"Invalid JWT: {e}")

    if alg in ASYMMETRIC_ALGS:
        jwks = _jwks_client()
        if jwks is None:
            raise HTTPException(
                status_code=500,
                detail="Asymmetric JWT but SUPABASE_URL not configured (needed to fetch JWKS).",
            )
        try:
            signing_key = jwks.get_signing_key_from_jwt(token).key
            return jwt.decode(
                token,
                signing_key,
                algorithms=list(ASYMMETRIC_ALGS),
                audience="authenticated",
                options={"require": ["sub", "exp"]},
            )
        except jwt.PyJWTError as e:
            raise HTTPException(status_code=401, detail=f"Invalid JWT (asymmetric): {e}")
        except Exception as e:
            raise HTTPException(status_code=401, detail=f"JWKS key resolution failed: {e}")

    raise HTTPException(status_code=401, detail=f"Unsupported JWT alg: {alg!r}")


def verify_jwt(authorization: Optional[str] = Header(default=None)) -> str:
    """Return Supabase user id (uuid string) from a valid Bearer token."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header (expected 'Bearer <token>').",
        )
    token = authorization.split(" ", 1)[1].strip()
    decoded = _verify_token(token)
    user_id = decoded.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing 'sub' claim")
    return user_id


def optional_verify_jwt(authorization: Optional[str] = Header(default=None)) -> Optional[str]:
    if not authorization:
        return None
    return verify_jwt(authorization)
