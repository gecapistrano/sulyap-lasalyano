"""
FastAPI dependencies: session user resolution from HttpOnly JWT cookie, RBAC, CSRF double-submit, resource ownership.

Import these into routers with `Depends(...)` — keep auth logic centralized here for audits.
"""
from collections.abc import Callable

from fastapi import Cookie, Depends, Header, HTTPException, status
from jwt import InvalidTokenError
from sqlalchemy import select
from sqlalchemy.orm import Session

from .core.database import get_db
from .core.security import decode_token
from .models import User
from .schemas import UserRole


def get_current_user(
    access_token: str | None = Cookie(default=None, alias="access_token"),
    db: Session = Depends(get_db),
) -> User:
    """Resolve the current user from the `access_token` HttpOnly cookie (JWT)."""
    if not access_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    try:
        payload = decode_token(access_token)
        if payload.get("type") != "access":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
        user_id = int(payload["sub"])
    except (InvalidTokenError, KeyError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    user = db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def get_current_active_user(user: User = Depends(get_current_user)) -> User:
    """Rejects disabled accounts after JWT validation."""
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive account")
    return user


def require_roles(*roles: UserRole) -> Callable[[User], User]:
    """Returns a FastAPI dependency factory that enforces one of the given roles."""
    allowed = {role.value for role in roles}

    def role_dependency(user: User = Depends(get_current_active_user)) -> User:
        if user.role not in allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user

    return role_dependency


def ensure_resource_owner_or_admin(*, owner_id: int, user: User) -> None:
    """IDOR guard: editors only touch their rows unless they are admin."""
    if user.role == UserRole.admin.value:
        return
    if owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Resource access denied")


def verify_csrf_token(
    csrf_cookie: str | None = Cookie(default=None, alias="csrf_token"),
    csrf_header: str | None = Header(default=None, alias="X-CSRF-Token"),
    user: User = Depends(get_current_active_user),
) -> User:
    """Double-submit cookie pattern: readable `csrf_token` cookie must match `X-CSRF-Token` header."""
    if not csrf_cookie or not csrf_header or csrf_cookie != csrf_header:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF token validation failed")
    return user
