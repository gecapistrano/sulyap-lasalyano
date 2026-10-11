"""
Password hashing (bcrypt), JWT access/refresh creation, decode, and refresh-token fingerprinting.

Tokens are signed with `JWT_SECRET_KEY` from settings — never log raw tokens.
Uses the `bcrypt` package directly (passlib 1.7.4 is incompatible with bcrypt>=4.1).
"""
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from secrets import token_urlsafe

import bcrypt
import jwt
from jwt import InvalidTokenError

from .config import get_settings

settings = get_settings()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except (ValueError, TypeError):
        return False


def create_access_token(*, subject: str, role: str, expires_delta: timedelta | None = None) -> str:
    expire = datetime.now(UTC) + (expires_delta or timedelta(minutes=settings.access_token_exp_minutes))
    payload = {"sub": subject, "role": role, "type": "access", "exp": expire}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(*, subject: str, role: str, token_id: str, expires_delta: timedelta | None = None) -> str:
    expire = datetime.now(UTC) + (expires_delta or timedelta(days=settings.refresh_token_exp_days))
    payload = {"sub": subject, "role": role, "jti": token_id, "type": "refresh", "exp": expire}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])


def token_fingerprint(token: str) -> str:
    return sha256(token.encode("utf-8")).hexdigest()


def new_token_id() -> str:
    return token_urlsafe(32)


def ensure_refresh_token(payload: dict) -> None:
    if payload.get("type") != "refresh" or "jti" not in payload:
        raise InvalidTokenError("Invalid refresh token")
