"""
Artifact CRUD + search. List/get are scoped by owner for non-admins; mutations require CSRF + role checks.
"""
from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..core.database import get_db
from ..core.rate_limit import limiter
from ..deps import ensure_resource_owner_or_admin, get_current_active_user, require_roles, verify_csrf_token
from ..models import Artifact, User
from ..schemas import ArtifactCreate, ArtifactOut, ArtifactUpdate, UserRole
from ..services.model_uploads import delete_local_model_if_managed, save_artifact_model

router = APIRouter(prefix="/artifacts", tags=["artifacts"])
settings = get_settings()


def _to_out(artifact: Artifact) -> ArtifactOut:
    return ArtifactOut(
        id=artifact.id,
        owner_id=artifact.owner_id,
        title=artifact.title,
        description=artifact.description,
        image_url=artifact.image_url,
        model_url=getattr(artifact, "model_url", "") or "",
        rd_code=artifact.rd_code,
        owner_name=artifact.owner_name,
        year=artifact.year,
        subtitle=artifact.subtitle,
        icon=artifact.icon,
        published=artifact.published,
        created_at=artifact.created_at,
    )


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
    return [_to_out(artifact) for artifact in artifacts]


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

    return _to_out(artifact)


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
        rd_code=payload.rd_code.strip().upper(),
        owner_name=payload.owner_name.strip(),
        year=payload.year.strip(),
        subtitle=payload.subtitle.strip(),
        icon=payload.icon,
        published=payload.published,
    )
    db.add(artifact)
    db.commit()
    db.refresh(artifact)
    return _to_out(artifact)


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
    if "rd_code" in updates and isinstance(updates["rd_code"], str):
        updates["rd_code"] = updates["rd_code"].strip().upper()
    if "model_url" in updates and isinstance(updates["model_url"], str):
        next_model = updates["model_url"].strip()
        if next_model and not next_model.startswith("/media/models/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="model_url must be empty or a managed /media/models path",
            )
        prev = getattr(artifact, "model_url", "") or ""
        if next_model != prev:
            delete_local_model_if_managed(prev)
        updates["model_url"] = next_model
    for field, value in updates.items():
        setattr(artifact, field, str(value) if field in {"image_url", "model_url"} else value)

    db.commit()
    db.refresh(artifact)
    return _to_out(artifact)


@router.post("/{artifact_id}/model", response_model=ArtifactOut)
async def upload_artifact_model(
    artifact_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin, UserRole.editor)),
    csrf_checked_user: User = Depends(verify_csrf_token),
) -> ArtifactOut:
    """Upload a .glb 3D model for an artifact (auth + CSRF required)."""
    del csrf_checked_user
    artifact = db.scalar(select(Artifact).where(Artifact.id == artifact_id))
    if not artifact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact not found")

    ensure_resource_owner_or_admin(owner_id=artifact.owner_id, user=user)

    previous = getattr(artifact, "model_url", "") or ""
    media_path = await save_artifact_model(artifact.id, file)
    artifact.model_url = media_path
    db.commit()
    db.refresh(artifact)
    if previous and previous != media_path:
        delete_local_model_if_managed(previous)
    return _to_out(artifact)


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
    delete_local_model_if_managed(getattr(artifact, "model_url", "") or "")
    db.delete(artifact)
    db.commit()
