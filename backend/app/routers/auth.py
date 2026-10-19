"""
Authentication routes: login sets HttpOnly JWT cookies + CSRF cookie; refresh rotates refresh tokens; logout clears cookies.

Cookie flags (secure, samesite) come from `Settings` — do not bypass when adding new auth flows.
"""
from datetime import UTC, datetime, timedelta
from secrets import token_urlsafe

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..core.database import get_db
from ..core.rate_limit import limiter
from ..core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    ensure_refresh_token,
    new_token_id,
    token_fingerprint,
    verify_password,
)
from ..models import RefreshToken, User
from ..schemas import LoginRequest, UserPublic
from ..deps import get_current_active_user, verify_csrf_token

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str, csrf_token: str) -> None:
    base_cookie = {
        "httponly": True,
        "secure": settings.cookie_secure,
        "samesite": settings.cookie_samesite,
        "domain": settings.cookie_domain,
    }
    response.set_cookie(
        key="access_token",
        value=access_token,
        max_age=settings.access_token_exp_minutes * 60,
        **base_cookie,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        max_age=settings.refresh_token_exp_days * 24 * 60 * 60,
        **base_cookie,
    )
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        max_age=settings.refresh_token_exp_days * 24 * 60 * 60,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        domain=settings.cookie_domain,
        httponly=False,
    )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie("access_token", domain=settings.cookie_domain)
    response.delete_cookie("refresh_token", domain=settings.cookie_domain)
    response.delete_cookie("csrf_token", domain=settings.cookie_domain)


def _rotate_refresh_token(db: Session, user: User, incoming_refresh_token: str) -> tuple[str, str]:
    payload = decode_token(incoming_refresh_token)
    ensure_refresh_token(payload)

    token_id = payload["jti"]
    persisted = db.scalar(select(RefreshToken).where(RefreshToken.token_id == token_id))
    if not persisted:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token not found")

    now = datetime.now(UTC)
    if persisted.revoked or persisted.expires_at <= now:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired")
    if persisted.token_hash != token_fingerprint(incoming_refresh_token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token mismatch")

    next_token_id = new_token_id()
    access_token = create_access_token(subject=str(user.id), role=user.role)
    next_refresh_token = create_refresh_token(subject=str(user.id), role=user.role, token_id=next_token_id)

    persisted.revoked = True
    persisted.replaced_by = next_token_id

    db.add(
        RefreshToken(
            user_id=user.id,
            token_id=next_token_id,
            token_hash=token_fingerprint(next_refresh_token),
            expires_at=now + timedelta(days=settings.refresh_token_exp_days),
        )
    )
    db.commit()
    return access_token, next_refresh_token


@router.post("/login", response_model=UserPublic)
@limiter.limit(settings.rate_limit_login)
def login(
    request: Request,
    payload: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> UserPublic:
    del request
    identifier = payload.email.strip().lower()
    # Local/dev convenience: username `admin` maps to the seeded curator account.
    if identifier == "admin":
        identifier = "curator@example.com"
    user = db.scalar(select(User).where(User.email == identifier))
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive account")

    refresh_id = new_token_id()
    csrf_token = token_urlsafe(24)
    access_token = create_access_token(subject=str(user.id), role=user.role)
    refresh_token = create_refresh_token(subject=str(user.id), role=user.role, token_id=refresh_id)

    db.add(
        RefreshToken(
            user_id=user.id,
            token_id=refresh_id,
            token_hash=token_fingerprint(refresh_token),
            expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_exp_days),
        )
    )
    db.commit()

    _set_auth_cookies(response, access_token, refresh_token, csrf_token)
    return UserPublic(
        id=user.id,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        csrf_token=csrf_token,
    )


@router.post("/refresh", response_model=UserPublic)
def refresh_session(request: Request, response: Response, db: Session = Depends(get_db)) -> UserPublic:
    incoming_refresh = request.cookies.get("refresh_token")
    if not incoming_refresh:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing refresh token")

    try:
        payload = decode_token(incoming_refresh)
        ensure_refresh_token(payload)
        user_id = int(payload["sub"])
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token") from exc

    user = db.scalar(select(User).where(User.id == user_id))
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User unavailable")

    access_token, next_refresh = _rotate_refresh_token(db, user, incoming_refresh)
    csrf_token = token_urlsafe(24)
    _set_auth_cookies(response, access_token, next_refresh, csrf_token)
    return UserPublic(
        id=user.id,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        csrf_token=csrf_token,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    user: User = Depends(verify_csrf_token),
) -> None:
    del user
    refresh_token = request.cookies.get("refresh_token")
    if refresh_token:
        try:
            payload = decode_token(refresh_token)
            if payload.get("type") == "refresh":
                db_token = db.scalar(select(RefreshToken).where(RefreshToken.token_id == payload.get("jti")))
                if db_token:
                    db_token.revoked = True
                    db.commit()
        except Exception:  # noqa: BLE001
            pass
    _clear_auth_cookies(response)


@router.get("/me", response_model=UserPublic)
def get_me(request: Request, user: User = Depends(get_current_active_user)) -> UserPublic:
    return UserPublic(
        id=user.id,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        csrf_token=request.cookies.get("csrf_token"),
    )
