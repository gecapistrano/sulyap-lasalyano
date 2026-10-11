"""Hybrid tags: rule-based auto sync + manual/llm curator tags."""
from __future__ import annotations

import re

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..models import Artifact, ArtifactTag, Tag


def _slugify(label: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (label or "").strip().lower()).strip("-")
    return s[:120] or "tag"


def preload_tag_cache(db: Session) -> dict[str, Tag]:
    return {t.slug: t for t in db.scalars(select(Tag)).all()}


def _ensure_tag(db: Session, label: str, kind: str, cache: dict[str, Tag] | None = None) -> Tag:
    slug = _slugify(label)
    if cache is not None and slug in cache:
        return cache[slug]
    tag = db.scalar(select(Tag).where(Tag.slug == slug))
    if tag:
        if cache is not None:
            cache[slug] = tag
        return tag
    tag = Tag(slug=slug, label=label.strip()[:200], kind=kind[:40])
    try:
        with db.begin_nested():
            db.add(tag)
            db.flush()
    except IntegrityError:
        tag = db.scalar(select(Tag).where(Tag.slug == slug))
        if not tag:
            raise
    if cache is not None:
        cache[slug] = tag
    return tag


def _link(db: Session, artifact_id: int, tag: Tag, source: str) -> None:
    exists = db.scalar(
        select(ArtifactTag).where(
            ArtifactTag.artifact_id == artifact_id,
            ArtifactTag.tag_id == tag.id,
            ArtifactTag.source == source,
        )
    )
    if exists:
        return
    db.add(ArtifactTag(artifact_id=artifact_id, tag_id=tag.id, source=source))


def sync_auto_tags(db: Session, artifact: Artifact, cache: dict[str, Tag] | None = None) -> None:
    desired: list[tuple[str, str]] = []
    owner = (artifact.owner_name or "").strip()
    if owner:
        desired.append((owner, "owner"))
    year = (getattr(artifact, "year_acquired", None) or getattr(artifact, "year", None) or "").strip()
    if year:
        desired.append((year, "year"))
    country = (artifact.country_of_origin or "").strip()
    if country:
        desired.append((country, "country"))
    atype = (artifact.artifact_type or "").strip()
    if atype:
        desired.append((atype, "type"))
    subtitle = (artifact.subtitle or "").strip()
    if subtitle:
        desired.append((subtitle, "theme"))

    desired_slugs = {_slugify(label) for label, _ in desired}

    existing_auto = db.scalars(
        select(ArtifactTag).where(
            ArtifactTag.artifact_id == artifact.id,
            ArtifactTag.source == "auto",
        )
    ).all()
    for link in existing_auto:
        tag = db.get(Tag, link.tag_id)
        if not tag or tag.slug not in desired_slugs:
            db.delete(link)

    for label, kind in desired:
        tag = _ensure_tag(db, label, kind, cache=cache)
        _link(db, artifact.id, tag, "auto")
    db.flush()


def set_manual_tags(db: Session, artifact: Artifact, labels: list[str]) -> None:
    wanted = []
    seen = set()
    for raw in labels:
        label = (raw or "").strip()
        if not label:
            continue
        slug = _slugify(label)
        if slug in seen:
            continue
        seen.add(slug)
        wanted.append(label)

    existing = db.scalars(
        select(ArtifactTag).where(
            ArtifactTag.artifact_id == artifact.id,
            ArtifactTag.source == "manual",
        )
    ).all()
    wanted_slugs = {_slugify(x) for x in wanted}
    for link in existing:
        tag = db.get(Tag, link.tag_id)
        if not tag or tag.slug not in wanted_slugs:
            db.delete(link)

    for label in wanted:
        tag = _ensure_tag(db, label, "manual")
        _link(db, artifact.id, tag, "manual")
    db.flush()


def replace_artifact_tags(db: Session, artifact: Artifact, labels: list[str]) -> None:
    """Replace all tag links for an artifact with the curator-edited list (saved as manual)."""
    wanted: list[str] = []
    seen: set[str] = set()
    for raw in labels:
        label = (raw or "").strip()
        if not label:
            continue
        slug = _slugify(label)
        if slug in seen:
            continue
        seen.add(slug)
        wanted.append(label)

    existing = db.scalars(select(ArtifactTag).where(ArtifactTag.artifact_id == artifact.id)).all()
    for link in existing:
        db.delete(link)
    db.flush()

    for label in wanted:
        tag = _ensure_tag(db, label, "manual")
        _link(db, artifact.id, tag, "manual")
    db.flush()


def add_llm_tags(db: Session, artifact: Artifact, labels: list[str]) -> None:
    for raw in labels:
        label = (raw or "").strip()
        if not label:
            continue
        tag = _ensure_tag(db, label, "theme")
        _link(db, artifact.id, tag, "llm")
    db.flush()


def collect_tags(db: Session, artifact: Artifact) -> list[dict[str, str]]:
    return collect_tags_by_artifact_ids(db, [artifact.id]).get(artifact.id, [])


def collect_tags_by_artifact_ids(db: Session, artifact_ids: list[int]) -> dict[int, list[dict[str, str]]]:
    """Batch-load tags for many artifacts (avoids N+1 round-trips to Postgres)."""
    ids = [int(i) for i in artifact_ids if i is not None]
    result: dict[int, list[dict[str, str]]] = {i: [] for i in ids}
    if not ids:
        return result
    rows = db.execute(
        select(ArtifactTag.artifact_id, ArtifactTag.source, Tag.slug, Tag.label, Tag.kind)
        .join(Tag, Tag.id == ArtifactTag.tag_id)
        .where(ArtifactTag.artifact_id.in_(ids))
        .order_by(ArtifactTag.artifact_id.asc(), Tag.slug.asc())
    ).all()
    seen: dict[int, set[str]] = {i: set() for i in ids}
    for artifact_id, source, slug, label, kind in rows:
        key = f"{slug}:{source}"
        if key in seen[artifact_id]:
            continue
        seen[artifact_id].add(key)
        result[artifact_id].append(
            {"slug": slug, "label": label, "kind": kind, "source": source}
        )
    return result
