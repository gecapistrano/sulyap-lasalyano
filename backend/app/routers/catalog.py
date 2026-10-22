"""Public published-collection reads for museum visitors."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..core.database import get_db
from ..core.rate_limit import limiter
from ..models import Artifact, ArtifactTag, President, Tag
from ..schemas import CatalogArtifactOut, CatalogPresidentOut, TagOut
from ..services.artifact_tags import collect_tags, collect_tags_by_artifact_ids
from ..services.id_codes import normalize_id_code
from ..services.media_urls import passthrough_media_url, public_model_url
from ..services.model_uploads import local_model_media_url
from ..services.photo_uploads import find_local_photo, photo_file_or_redirect

router = APIRouter(prefix="/catalog", tags=["catalog"])
settings = get_settings()


def _year_value(artifact: Artifact) -> str:
    return (getattr(artifact, "year_acquired", None) or getattr(artifact, "year", None) or "") or ""


def _catalog_id_code(artifact: Artifact) -> str:
    return normalize_id_code(getattr(artifact, "id_code", None) or getattr(artifact, "rd_code", None))


def _catalog_image_url(artifact: Artifact) -> str:
    stored = passthrough_media_url(getattr(artifact, "image_url", "") or "")
    if not settings.catalog_prefer_local_media:
        return stored
    code = _catalog_id_code(artifact)
    if find_local_photo(stored, id_code=code, artifact_id=getattr(artifact, "id", None)):
        if code:
            return f"/catalog/artifacts/id/{code}/photo"
    return stored


def _catalog_model_url(artifact: Artifact) -> str:
    stored = getattr(artifact, "model_url", "") or ""
    if settings.catalog_prefer_local_media:
        local = local_model_media_url(stored, id_code=_catalog_id_code(artifact))
        if local:
            return local
    return public_model_url(
        stored,
        public_base=settings.public_model_base_url,
        omit_storage=settings.catalog_omit_storage_models,
    )


def _to_catalog(
    db: Session,
    artifact: Artifact,
    *,
    tags_by_id: dict[int, list[dict[str, str]]] | None = None,
) -> CatalogArtifactOut:
    if tags_by_id is not None:
        tag_rows = tags_by_id.get(artifact.id, [])
    else:
        tag_rows = collect_tags(db, artifact)
    return CatalogArtifactOut(
        id=artifact.id,
        id_code=_catalog_id_code(artifact),
        title=artifact.title,
        description=artifact.description,
        image_url=_catalog_image_url(artifact),
        model_url=_catalog_model_url(artifact),
        owner_name=artifact.owner_name,
        year_acquired=_year_value(artifact),
        country_of_origin=getattr(artifact, "country_of_origin", "") or "",
        artifact_type=getattr(artifact, "artifact_type", "") or "",
        subtitle=artifact.subtitle,
        icon=artifact.icon,
        president_id=getattr(artifact, "president_id", None),
        tags=[TagOut(**t) for t in tag_rows],
    )


@router.get("/presidents", response_model=list[CatalogPresidentOut])
def list_presidents(response: Response, db: Session = Depends(get_db)) -> list[CatalogPresidentOut]:
    response.headers["Cache-Control"] = "no-store"
    rows = db.scalars(
        select(President).where(President.published.is_(True)).order_by(President.id.asc())
    ).all()
    return [
        CatalogPresidentOut(
            id=row.id,
            name=row.name,
            service=row.service,
            icon=row.icon,
            biography=getattr(row, "biography", "") or "",
            photo_url=passthrough_media_url(getattr(row, "photo_url", "") or ""),
        )
        for row in rows
    ]


@router.get("/tags", response_model=list[TagOut])
def list_tags(db: Session = Depends(get_db)) -> list[TagOut]:
    rows = db.scalars(select(Tag).order_by(Tag.label.asc()).limit(500)).all()
    return [TagOut(slug=r.slug, label=r.label, kind=r.kind, source="auto") for r in rows]


@router.get("/artifacts", response_model=list[CatalogArtifactOut])
@limiter.limit(settings.rate_limit_search)
def list_catalog_artifacts(
    request: Request,
    response: Response,
    search: str = Query(default="", min_length=0, max_length=100),
    owner_name: str = Query(default="", min_length=0, max_length=200),
    president_id: int | None = Query(default=None),
    year_acquired: str = Query(default="", min_length=0, max_length=32),
    country_of_origin: str = Query(default="", min_length=0, max_length=120),
    artifact_type: str = Query(default="", min_length=0, max_length=120),
    tag: str = Query(default="", min_length=0, max_length=120),
    sort: str = Query(default="id", min_length=1, max_length=40),
    limit: int = Query(default=2000, ge=1, le=2000),
    db: Session = Depends(get_db),
) -> list[CatalogArtifactOut]:
    del request
    response.headers["Cache-Control"] = "no-store"
    query = select(Artifact).where(Artifact.published.is_(True))
    if owner_name.strip():
        query = query.where(Artifact.owner_name == owner_name.strip())
    if president_id is not None:
        query = query.where(Artifact.president_id == president_id)
    if year_acquired.strip():
        query = query.where(Artifact.year_acquired == year_acquired.strip())
    if country_of_origin.strip():
        query = query.where(Artifact.country_of_origin == country_of_origin.strip())
    if artifact_type.strip():
        query = query.where(Artifact.artifact_type == artifact_type.strip())
    if tag.strip():
        slug = tag.strip().lower().replace(" ", "-")
        query = (
            query.join(ArtifactTag, ArtifactTag.artifact_id == Artifact.id)
            .join(Tag, Tag.id == ArtifactTag.tag_id)
            .where(or_(Tag.slug == slug, Tag.label.ilike(tag.strip())))
        )
    if search.strip():
        term = f"%{search.strip().lower()}%"
        query = query.where(
            or_(
                Artifact.title.ilike(term),
                Artifact.id_code.ilike(term),
                Artifact.subtitle.ilike(term),
                Artifact.year_acquired.ilike(term),
                Artifact.owner_name.ilike(term),
                Artifact.description.ilike(term),
            )
        )
    order = {
        "id": Artifact.id.asc(),
        "id_desc": Artifact.id.desc(),
        "title": Artifact.title.asc(),
        "year": Artifact.year_acquired.asc(),
        "owner": Artifact.owner_name.asc(),
    }.get(sort, Artifact.id.asc())
    artifacts = db.scalars(query.order_by(order).limit(limit)).all()
    tags_by_id = collect_tags_by_artifact_ids(db, [row.id for row in artifacts])
    return [_to_catalog(db, row, tags_by_id=tags_by_id) for row in artifacts]


def _find_published(db: Session, id_code: str) -> Artifact | None:
    code = normalize_id_code(id_code)
    if not code or len(code) > 32:
        return None
    artifact = db.scalar(
        select(Artifact).where(Artifact.published.is_(True), Artifact.id_code == code)
    )
    if artifact:
        return artifact
    candidates = db.scalars(select(Artifact).where(Artifact.published.is_(True)).limit(500)).all()
    return next(
        (
            a
            for a in candidates
            if normalize_id_code(getattr(a, "id_code", "") or getattr(a, "rd_code", "")) == code
        ),
        None,
    )


@router.get("/artifacts/id/{id_code}", response_model=CatalogArtifactOut)
def get_catalog_artifact_by_id(id_code: str, db: Session = Depends(get_db)) -> CatalogArtifactOut:
    artifact = _find_published(db, id_code)
    if not artifact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact not found")
    return _to_catalog(db, artifact)


@router.get("/artifacts/id/{id_code}/photo")
@limiter.limit(settings.rate_limit_search)
def get_catalog_artifact_photo(request: Request, id_code: str, db: Session = Depends(get_db)):
    """Serve a published artifact photo (local file) or redirect to a stored http(s) URL."""
    del request
    artifact = _find_published(db, id_code)
    if not artifact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact not found")
    served = photo_file_or_redirect(
        getattr(artifact, "image_url", "") or "",
        id_code=_catalog_id_code(artifact),
        artifact_id=artifact.id,
        prefer_local=settings.catalog_prefer_local_media,
    )
    if not served:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Photo not found")
    return served


@router.get("/artifacts/rd/{rd_code}", response_model=CatalogArtifactOut)
def get_catalog_artifact_by_rd_alias(rd_code: str, db: Session = Depends(get_db)) -> CatalogArtifactOut:
    """Deprecated alias → id_code lookup."""
    return get_catalog_artifact_by_id(rd_code, db)


@router.get("/artifacts/related", response_model=list[CatalogArtifactOut])
@limiter.limit(settings.rate_limit_search)
def related_artifacts(
    request: Request,
    tag: str = Query(default="", max_length=120),
    id_code: str = Query(default="", max_length=32),
    db: Session = Depends(get_db),
) -> list[CatalogArtifactOut]:
    del request
    needle = tag.strip()
    if not needle and id_code.strip():
        source = get_catalog_artifact_by_id(id_code, db)
        labels = [t.label for t in source.tags] + [
            source.owner_name,
            source.year_acquired,
            source.country_of_origin,
            source.artifact_type,
        ]
        needle = next((x for x in labels if x), "")
    if not needle:
        return []
    slug = needle.lower().replace(" ", "-")
    query = (
        select(Artifact)
        .where(Artifact.published.is_(True))
        .join(ArtifactTag, ArtifactTag.artifact_id == Artifact.id)
        .join(Tag, Tag.id == ArtifactTag.tag_id)
        .where(or_(Tag.slug == slug, Tag.label.ilike(needle), Artifact.owner_name == needle, Artifact.year_acquired == needle))
        .order_by(Artifact.id.asc())
        .limit(500)
    )
    return [_to_catalog(db, row) for row in db.scalars(query).all()]
