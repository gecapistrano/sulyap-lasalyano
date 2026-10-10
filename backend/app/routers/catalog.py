"""
Public published-collection reads for museum visitors (browse + scan lookup).

These rows are catalog records (accession / RD code), not private user resources.
Authenticated CRUD stays on /artifacts with owner-or-admin checks.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..core.database import get_db
from ..core.rate_limit import limiter
from ..models import Artifact, President
from ..schemas import CatalogArtifactOut, CatalogPresidentOut

router = APIRouter(prefix="/catalog", tags=["catalog"])
settings = get_settings()


def _to_catalog(artifact: Artifact) -> CatalogArtifactOut:
    return CatalogArtifactOut(
        id=artifact.id,
        rd_code=artifact.rd_code,
        title=artifact.title,
        description=artifact.description,
        image_url=artifact.image_url,
        model_url=getattr(artifact, "model_url", "") or "",
        owner_name=artifact.owner_name,
        year=artifact.year,
        subtitle=artifact.subtitle,
        icon=artifact.icon,
    )


@router.get("/presidents", response_model=list[CatalogPresidentOut])
def list_presidents(db: Session = Depends(get_db)) -> list[CatalogPresidentOut]:
    rows = db.scalars(select(President).order_by(President.id.asc())).all()
    return [CatalogPresidentOut(id=row.id, name=row.name, service=row.service, icon=row.icon) for row in rows]


@router.get("/artifacts", response_model=list[CatalogArtifactOut])
@limiter.limit(settings.rate_limit_search)
def list_catalog_artifacts(
    request: Request,
    search: str = Query(default="", min_length=0, max_length=100),
    owner_name: str = Query(default="", min_length=0, max_length=200),
    db: Session = Depends(get_db),
) -> list[CatalogArtifactOut]:
    del request
    query = select(Artifact).where(Artifact.published.is_(True))
    if owner_name.strip():
        query = query.where(Artifact.owner_name == owner_name.strip())
    if search.strip():
        term = f"%{search.strip().lower()}%"
        query = query.where(
            or_(
                Artifact.title.ilike(term),
                Artifact.rd_code.ilike(term),
                Artifact.subtitle.ilike(term),
                Artifact.year.ilike(term),
            )
        )
    artifacts = db.scalars(query.order_by(Artifact.id.asc()).limit(200)).all()
    return [_to_catalog(row) for row in artifacts]


@router.get("/artifacts/rd/{rd_code}", response_model=CatalogArtifactOut)
def get_catalog_artifact_by_rd(rd_code: str, db: Session = Depends(get_db)) -> CatalogArtifactOut:
    code = rd_code.strip().upper()
    if not code or len(code) > 32:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact not found")
    artifact = db.scalar(
        select(Artifact).where(Artifact.published.is_(True), Artifact.rd_code == code)
    )
    if not artifact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact not found")
    return _to_catalog(artifact)
