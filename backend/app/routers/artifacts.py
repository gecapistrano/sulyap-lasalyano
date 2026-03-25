"""
Artifact CRUD + search. List/get are scoped by owner for non-admins; mutations require CSRF + role checks.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..core.database import get_db
from ..core.rate_limit import limiter
from ..deps import ensure_resource_owner_or_admin, get_current_active_user, require_roles, verify_csrf_token
from ..models import Artifact, User
from ..schemas import ArtifactCreate, ArtifactOut, ArtifactUpdate, UserRole

router = APIRouter(prefix="/artifacts", tags=["artifacts"])
settings = get_settings()


@router.get("/", response_model=list[ArtifactOut])
@limiter.limit(settings.rate_limit_search)
def list_artifacts(
    request: Request,
    search: str = Query(default="", min_length=0, max_length=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> list[ArtifactOut]:
    query = select(Artifact)
    if user.role != UserRole.admin.value:
        query = query.where(Artifact.owner_id == user.id)

    if search:
        like_term = f"%{search.lower()}%"
        query = query.where(Artifact.title.ilike(like_term))

    artifacts = db.scalars(query.order_by(Artifact.id.desc())).all()
    return [
        ArtifactOut(
            id=artifact.id,
            owner_id=artifact.owner_id,
            title=artifact.title,
            description=artifact.description,
            image_url=artifact.image_url,
            created_at=artifact.created_at,
        )
        for artifact in artifacts
    ]


@router.get("/{artifact_id}", response_model=ArtifactOut)
def get_artifact(
    artifact_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> ArtifactOut:
    artifact = db.scalar(select(Artifact).where(Artifact.id == artifact_id))
    if not artifact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact not found")

    ensure_resource_owner_or_admin(owner_id=artifact.owner_id, user=user)

    return ArtifactOut(
        id=artifact.id,
        owner_id=artifact.owner_id,
        title=artifact.title,
        description=artifact.description,
        image_url=artifact.image_url,
        created_at=artifact.created_at,
    )


@router.post("/", response_model=ArtifactOut, status_code=status.HTTP_201_CREATED)
def create_artifact(
    payload: ArtifactCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin, UserRole.editor)),
    csrf_checked_user: User = Depends(verify_csrf_token),
) -> ArtifactOut:
    del csrf_checked_user
    artifact = Artifact(
        owner_id=user.id,
        title=payload.title,
        description=payload.description,
        image_url=str(payload.image_url),
    )
    db.add(artifact)
    db.commit()
    db.refresh(artifact)
    return ArtifactOut(
        id=artifact.id,
        owner_id=artifact.owner_id,
        title=artifact.title,
        description=artifact.description,
        image_url=artifact.image_url,
        created_at=artifact.created_at,
    )


@router.patch("/{artifact_id}", response_model=ArtifactOut)
def update_artifact(
    artifact_id: int,
    payload: ArtifactUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin, UserRole.editor)),
    csrf_checked_user: User = Depends(verify_csrf_token),
) -> ArtifactOut:
    del csrf_checked_user
    artifact = db.scalar(select(Artifact).where(Artifact.id == artifact_id))
    if not artifact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact not found")

    ensure_resource_owner_or_admin(owner_id=artifact.owner_id, user=user)

    updates = payload.model_dump(exclude_none=True)
    for field, value in updates.items():
        setattr(artifact, field, str(value) if field == "image_url" else value)

    db.commit()
    db.refresh(artifact)
    return ArtifactOut(
        id=artifact.id,
        owner_id=artifact.owner_id,
        title=artifact.title,
        description=artifact.description,
        image_url=artifact.image_url,
        created_at=artifact.created_at,
    )


@router.delete("/{artifact_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_artifact(
    artifact_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin, UserRole.editor)),
    csrf_checked_user: User = Depends(verify_csrf_token),
) -> None:
    del csrf_checked_user
    artifact = db.scalar(select(Artifact).where(Artifact.id == artifact_id))
    if not artifact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact not found")

    ensure_resource_owner_or_admin(owner_id=artifact.owner_id, user=user)
    db.delete(artifact)
    db.commit()
