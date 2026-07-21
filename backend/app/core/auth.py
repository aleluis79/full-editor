"""Keycloak OIDC authentication — JWKS validation, auto-provision, get_current_user dependency."""
import json
import time
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwk, jwt, JWTError
from jose.constants import Algorithms
from sqlalchemy.orm import Session

from ..config import KEYCLOAK_JWKS_URL, KEYCLOAK_ISSUER, KEYCLOAK_CLIENT_ID
from ..core.database import get_db
from ..models.user import UserModel

security = HTTPBearer()

# ── JWKS Cache ────────────────────────────────────────────────────

_JWKS_CACHE: dict = {}
_JWKS_CACHE_TIME: float = 0
_JWKS_CACHE_TTL: float = 3600  # 1 hour


def _fetch_jwks() -> dict:
    """Fetch JWKS from Keycloak, with 1h in-memory cache."""
    global _JWKS_CACHE, _JWKS_CACHE_TIME
    now = time.time()
    if _JWKS_CACHE and (now - _JWKS_CACHE_TIME) < _JWKS_CACHE_TTL:
        return _JWKS_CACHE

    resp = httpx.get(KEYCLOAK_JWKS_URL, timeout=10)
    resp.raise_for_status()
    _JWKS_CACHE = resp.json()
    _JWKS_CACHE_TIME = now
    return _JWKS_CACHE


def _get_public_key(kid: str) -> Optional[dict]:
    """Find a JWK by key ID."""
    jwks = _fetch_jwks()
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            return key
    return None


def _validate_token(token: str) -> dict:
    """Validate a Keycloak JWT and return the decoded claims."""
    try:
        headers = jwt.get_unverified_headers(token)
        kid = headers.get("kid")
        if not kid:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing key ID in token header")

        public_key = _get_public_key(kid)
        if not public_key:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Public key not found")

        algorithm = public_key.get("alg", Algorithms.RS256)
        rsa_key = jwk.RSAKey(public_key, algorithm=algorithm)

        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=[Algorithms.RS256],
            audience=KEYCLOAK_CLIENT_ID,
            issuer=KEYCLOAK_ISSUER,
        )
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token validation failed",
        )


def _auto_provision_user(db: Session, claims: dict) -> UserModel:
    """Create a User record if it doesn't exist (INSERT ... ON CONFLICT DO NOTHING pattern).

    Uses keycloak_id as the unique identifier. If the user already exists,
    returns the existing record.
    """
    keycloak_id = claims.get("sub", "")
    email = claims.get("email", "")
    display_name = claims.get("name", claims.get("preferred_username", email))

    # Check if user exists
    user = db.query(UserModel).filter(UserModel.keycloak_id == keycloak_id).first()
    if user:
        return user

    # Create new user
    from ..models.user import _generate_id, _utcnow
    user = UserModel(
        id=_generate_id(),
        keycloak_id=keycloak_id,
        email=email,
        display_name=display_name,
        created_at=_utcnow(),
    )
    db.add(user)
    try:
        db.commit()
        db.refresh(user)
    except Exception:
        db.rollback()
        # Race condition: another request created the user first
        user = db.query(UserModel).filter(UserModel.keycloak_id == keycloak_id).first()
    return user


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> UserModel:
    """FastAPI dependency — validates Bearer JWT, auto-provisions user, returns UserModel.

    Usage:
        @router.get("/protected")
        def protected(user: UserModel = Depends(get_current_user)):
            ...
    """
    token = credentials.credentials
    claims = _validate_token(token)
    user = _auto_provision_user(db, claims)
    return user
