"""Artifact CRUD + uploads. Mutations require CSRF + admin/editor + ownership."""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..core.database import get_db
from ..core.rate_limit import limiter
from ..deps import ensure_resource_owner_or_admin, get_current_active_user, require_roles, verify_csrf_token
from ..models import Artifact, User
from ..schemas import (
    ArtifactCreate,
    ArtifactOut,
    ArtifactUpdate,
    LlmApplyRequest,
    LlmSuggestOut,
    TagOut,
    UserRole,
)
from ..services.artifact_tags import (
    add_llm_tags,
    collect_tags,
    collect_tags_by_artifact_ids,
    replace_artifact_tags,
    set_manual_tags,
    sync_auto_tags,
)
from ..services.facet_hints import apply_facet_hints_if_empty
from ..services.id_codes import normalize_id_code
from ..services.llm_assist import llm_configured, suggest_from_description
from ..services.model_uploads import delete_local_model_if_managed, save_artifact_model
from ..services.photo_uploads import delete_local_photo_if_managed, photo_path_for_media_key, save_artifact_photo

router = APIRouter(prefix="/artifacts", tags=["artifacts"])
settings = get_settings()


def _year_value(artifact: Artifact) -> str:
    return (getattr(artifact, "year_acquired", None) or getattr(artifact, "year", None) or "") or ""


def _to_out(
    db: Session,
    artifact: Artifact,
    *,
    tags_by_id: dict[int, list[dict[str, str]]] | None = None,
) -> ArtifactOut:
    if tags_by_id is not None:
        tag_rows = tags_by_id.get(artifact.id, [])
    else:
        tag_rows = collect_tags(db, artifact)
    tags = [TagOut(**t) for t in tag_rows]
    return ArtifactOut(
        id=artifact.id,
        owner_id=artifact.owner_id,
        title=artifact.title,
        description=artifact.description,
        image_url=artifact.image_url,
        model_url=getattr(artifact, "model_url", "") or "",
        id_code=normalize_id_code(getattr(artifact, "id_code", None) or getattr(artifact, "rd_code", None)),
        owner_name=artifact.owner_name,
        year_acquired=_year_value(artifact),
        country_of_origin=getattr(artifact, "country_of_origin", "") or "",
        artifact_type=getattr(artifact, "artifact_type", "") or "",
        subtitle=artifact.subtitle,
        icon=artifact.icon,
        remarks=getattr(artifact, "remarks", "") or "",
        llm_assist_enabled=bool(getattr(artifact, "llm_assist_enabled", False)),
        president_id=getattr(artifact, "president_id", None),
        published=artifact.published,
        created_at=artifact.created_at,
        tags=tags,
    )


@router.get("/", response_model=list[ArtifactOut])
@limiter.limit(settings.rate_limit_search)
def list_artifacts(
    request: Request,
    search: str = Query(default="", min_length=0, max_length=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> list[ArtifactOut]:
    del request
    query = select(Artifact)
    if user.role != UserRole.admin.value:
        query = query.where(Artifact.owner_id == user.id)
    if search:
        like_term = f"%{search.lower()}%"
        query = query.where(
            or_(
                Artifact.title.ilike(like_term),
                Artifact.id_code.ilike(like_term),
                Artifact.owner_name.ilike(like_term),
                Artifact.subtitle.ilike(like_term),
            )
        )
    artifacts = list(db.scalars(query.order_by(Artifact.id.desc()).limit(500)).all())
    tags_by_id = collect_tags_by_artifact_ids(db, [a.id for a in artifacts])
    return [_to_out(db, artifact, tags_by_id=tags_by_id) for artifact in artifacts]


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
    return _to_out(db, artifact)


@router.post("/", response_model=ArtifactOut, status_code=status.HTTP_201_CREATED)
def create_artifact(
    payload: ArtifactCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin, UserRole.editor)),
    csrf_checked_user: User = Depends(verify_csrf_token),
) -> ArtifactOut:
    del csrf_checked_user
    image = str(payload.image_url or "").strip() or "https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png"
    code = normalize_id_code(payload.id_code)
    artifact = Artifact(
        owner_id=user.id,
        title=(payload.title or "").strip() or (code and f"Memorabilia {code}") or "Untitled",
        description=payload.description,
        image_url=image,
        id_code=code,
        owner_name=payload.owner_name.strip(),
        year_acquired=payload.year_acquired.strip(),
        year=payload.year_acquired.strip(),
        country_of_origin=payload.country_of_origin.strip(),
        artifact_type=payload.artifact_type.strip(),
        subtitle=payload.subtitle.strip(),
        icon=payload.icon,
        remarks=payload.remarks,
        president_id=payload.president_id,
        llm_assist_enabled=payload.llm_assist_enabled,
        published=payload.published,
    )
    db.add(artifact)
    db.flush()
    apply_facet_hints_if_empty(artifact)
    sync_auto_tags(db, artifact)
    if payload.manual_tags:
        set_manual_tags(db, artifact, payload.manual_tags)
    db.commit()
    db.refresh(artifact)
    return _to_out(db, artifact)


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

    # exclude_unset keeps explicit nulls (e.g. clearing president_id) while
    # omitting fields the client did not send.
    updates = payload.model_dump(exclude_unset=True)
    # Curator Desk sends the full editable tag list (auto + manual + llm chips).
    tag_labels = updates.pop("tags", None)
    if tag_labels is None:
        tag_labels = updates.pop("manual_tags", None)
    else:
        updates.pop("manual_tags", None)
    if "id_code" in updates and isinstance(updates["id_code"], str):
        updates["id_code"] = normalize_id_code(updates["id_code"])
    if "year_acquired" in updates:
        updates["year"] = updates["year_acquired"]
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
    if "image_url" in updates:
        updates["image_url"] = str(updates["image_url"])

    for field, value in updates.items():
        setattr(artifact, field, value)

    apply_facet_hints_if_empty(artifact)
    if tag_labels is not None:
        replace_artifact_tags(db, artifact, tag_labels)
    else:
        sync_auto_tags(db, artifact)
    db.commit()
    db.refresh(artifact)
    return _to_out(db, artifact)


@router.post("/{artifact_id}/model", response_model=ArtifactOut)
async def upload_artifact_model(
    artifact_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin, UserRole.editor)),
    csrf_checked_user: User = Depends(verify_csrf_token),
) -> ArtifactOut:
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
    return _to_out(db, artifact)


@router.post("/{artifact_id}/photo", response_model=ArtifactOut)
async def upload_artifact_photo(
    artifact_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin, UserRole.editor)),
    csrf_checked_user: User = Depends(verify_csrf_token),
) -> ArtifactOut:
    del csrf_checked_user
    artifact = db.scalar(select(Artifact).where(Artifact.id == artifact_id))
    if not artifact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact not found")
    ensure_resource_owner_or_admin(owner_id=artifact.owner_id, user=user)
    previous = artifact.image_url or ""
    media_path = await save_artifact_photo(artifact.id, file)
    artifact.image_url = media_path
    db.commit()
    db.refresh(artifact)
    if previous.startswith("/curator-media/artifacts/"):
        delete_local_photo_if_managed(previous)
    return _to_out(db, artifact)


@router.get("/{artifact_id}/photo")
def get_artifact_photo(
    artifact_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    artifact = db.scalar(select(Artifact).where(Artifact.id == artifact_id))
    if not artifact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact not found")
    ensure_resource_owner_or_admin(owner_id=artifact.owner_id, user=user)
    path = photo_path_for_media_key(artifact.image_url)
    if not path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Photo not found")
    return FileResponse(path)


@router.post("/{artifact_id}/llm-suggest", response_model=LlmSuggestOut)
@limiter.limit("10/minute")
def llm_suggest(
    request: Request,
    artifact_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin, UserRole.editor)),
    csrf_checked_user: User = Depends(verify_csrf_token),
) -> LlmSuggestOut:
    del request, csrf_checked_user
    artifact = db.scalar(select(Artifact).where(Artifact.id == artifact_id))
    if not artifact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact not found")
    ensure_resource_owner_or_admin(owner_id=artifact.owner_id, user=user)
    if not getattr(artifact, "llm_assist_enabled", False):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="AI assist is off for this item")
    if not llm_configured():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="AI assist not configured")
    data = suggest_from_description(
        id_code=normalize_id_code(getattr(artifact, "id_code", "")),
        title=artifact.title or "",
        description=artifact.description or "",
        owner_name=artifact.owner_name or "",
    )
    return LlmSuggestOut(**data)


@router.post("/{artifact_id}/llm-apply", response_model=ArtifactOut)
def llm_apply(
    artifact_id: int,
    payload: LlmApplyRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin, UserRole.editor)),
    csrf_checked_user: User = Depends(verify_csrf_token),
) -> ArtifactOut:
    del csrf_checked_user
    artifact = db.scalar(select(Artifact).where(Artifact.id == artifact_id))
    if not artifact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact not found")
    ensure_resource_owner_or_admin(owner_id=artifact.owner_id, user=user)
    if not getattr(artifact, "llm_assist_enabled", False):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="AI assist is off for this item")

    def _set(field: str, value: str | None) -> None:
        if value is None:
            return
        current = (getattr(artifact, field, "") or "").strip()
        if payload.replace_existing or not current:
            setattr(artifact, field, value.strip())

    _set("title", payload.title)
    _set("year_acquired", payload.year_acquired)
    if payload.year_acquired and (payload.replace_existing or not (artifact.year or "").strip()):
        artifact.year = payload.year_acquired.strip()
    _set("country_of_origin", payload.country_of_origin)
    _set("artifact_type", payload.artifact_type)
    if payload.tags:
        add_llm_tags(db, artifact, payload.tags)
    sync_auto_tags(db, artifact)
    db.commit()
    db.refresh(artifact)
    return _to_out(db, artifact)


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
    delete_local_photo_if_managed(artifact.image_url or "")
    db.delete(artifact)
    db.commit()
