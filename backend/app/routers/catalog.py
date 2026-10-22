"""Public published-collection reads for museum visitors."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import FileResponse
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..core.database import get_db
from ..core.rate_limit import limiter
from ..models import Artifact, ArtifactTag, President, Tag
from ..schemas import CatalogArtifactOut, CatalogPresidentOut, TagOut
from ..services.artifact_tags import collect_tags
from ..services.id_codes import normalize_id_code
from ..services.photo_uploads import photo_path_for_media_key

router = APIRouter(prefix="/catalog", tags=["catalog"])
settings = get_settings()


def _year_value(artifact: Artifact) -> str:
    return (getattr(artifact, "year_acquired", None) or getattr(artifact, "year", None) or "") or ""


def _to_catalog(db: Session, artifact: Artifact) -> CatalogArtifactOut:
    return CatalogArtifactOut(
        id=artifact.id,
        id_code=normalize_id_code(getattr(artifact, "id_code", None) or getattr(artifact, "rd_code", None)),
        title=artifact.title,
        description=artifact.description,
        image_url=getattr(artifact, "image_url", "") or "",
        model_url=getattr(artifact, "model_url", "") or "",
        owner_name=artifact.owner_name,
        year_acquired=_year_value(artifact),
        country_of_origin=getattr(artifact, "country_of_origin", "") or "",
        artifact_type=getattr(artifact, "artifact_type", "") or "",
        subtitle=artifact.subtitle,
        icon=artifact.icon,
        president_id=getattr(artifact, "president_id", None),
        tags=[TagOut(**t) for t in collect_tags(db, artifact)],
    )


@router.get("/presidents", response_model=list[CatalogPresidentOut])
def list_presidents(db: Session = Depends(get_db)) -> list[CatalogPresidentOut]:
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
            photo_url=getattr(row, "photo_url", "") or "",
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
    search: str = Query(default="", min_length=0, max_length=100),
    owner_name: str = Query(default="", min_length=0, max_length=200),
    president_id: int | None = Query(default=None),
    year_acquired: str = Query(default="", min_length=0, max_length=32),
    country_of_origin: str = Query(default="", min_length=0, max_length=120),
    artifact_type: str = Query(default="", min_length=0, max_length=120),
    tag: str = Query(default="", min_length=0, max_length=120),
    sort: str = Query(default="id", min_length=1, max_length=40),
    db: Session = Depends(get_db),
) -> list[CatalogArtifactOut]:
    del request
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
    artifacts = db.scalars(query.order_by(order).limit(500)).all()
    return [_to_catalog(db, row) for row in artifacts]


def _find_published(db: Session, id_code: str) -> Artifact | None:
    code = normalize_id_code(id_code)
    if not code or len(code) > 32:
        return None
    artifact = db.scalar(
        select(Artifact).where(Artifact.published.is_(True), Artifact.id_code == code)
    )
    if artifact:
        return artifact
    # Older rows may still store spaced codes until re-normalized.
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
def get_catalog_artifact_photo(request: Request, id_code: str, db: Session = Depends(get_db)) -> FileResponse:
    """Serve the curator-uploaded photo for a published artifact."""
    del request
    artifact = _find_published(db, id_code)
    if not artifact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact not found")
    path = photo_path_for_media_key(getattr(artifact, "image_url", "") or "")
    if not path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Photo not found")
    return FileResponse(path)


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
