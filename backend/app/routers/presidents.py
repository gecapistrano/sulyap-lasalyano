"""Authenticated CRUD for DLSU Presidents catalog."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..deps import get_current_active_user, require_roles, verify_csrf_token
from ..models import President, User
from ..schemas import PresidentCreate, PresidentOut, PresidentUpdate, UserRole

router = APIRouter(prefix="/presidents", tags=["presidents"])


def _to_out(row: President) -> PresidentOut:
    return PresidentOut(
        id=row.id,
        name=row.name,
        service=row.service,
        icon=row.icon,
        biography=getattr(row, "biography", "") or "",
        photo_url=getattr(row, "photo_url", "") or "",
        published=bool(getattr(row, "published", True)),
    )


@router.get("/", response_model=list[PresidentOut])
def list_presidents_admin(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> list[PresidentOut]:
    del user
    rows = db.scalars(select(President).order_by(President.id.asc())).all()
    return [_to_out(r) for r in rows]


@router.post("/", response_model=PresidentOut, status_code=status.HTTP_201_CREATED)
def create_president(
    payload: PresidentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin, UserRole.editor)),
    csrf_checked_user: User = Depends(verify_csrf_token),
) -> PresidentOut:
    del user, csrf_checked_user
    exists = db.scalar(select(President).where(President.name == payload.name.strip()))
    if exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="President already exists")
    row = President(
        name=payload.name.strip(),
        service=payload.service.strip(),
        icon=payload.icon,
        biography=payload.biography,
        photo_url=payload.photo_url.strip(),
        published=payload.published,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_out(row)


@router.patch("/{president_id}", response_model=PresidentOut)
def update_president(
    president_id: int,
    payload: PresidentUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin, UserRole.editor)),
    csrf_checked_user: User = Depends(verify_csrf_token),
) -> PresidentOut:
    del user, csrf_checked_user
    row = db.scalar(select(President).where(President.id == president_id))
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="President not found")
    updates = payload.model_dump(exclude_none=True)
    for field, value in updates.items():
        setattr(row, field, value.strip() if isinstance(value, str) and field != "biography" else value)
    db.commit()
    db.refresh(row)
    return _to_out(row)


@router.delete("/{president_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_president(
    president_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin)),
    csrf_checked_user: User = Depends(verify_csrf_token),
) -> None:
    del user, csrf_checked_user
    row = db.scalar(select(President).where(President.id == president_id))
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="President not found")
    db.delete(row)
    db.commit()
