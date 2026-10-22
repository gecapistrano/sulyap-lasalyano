"""
Bidirectional catalog sync between local SQLite and a remote Postgres (Supabase).

Scope: presidents, artifacts, tags, artifact_tags. Never copies `users` or
password hashes. Artifact `owner_id` is remapped to the destination curator.
"""
from __future__ import annotations

import gzip
import hashlib
import json
import logging
import re
import secrets
import threading
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session, sessionmaker

from ..core.config import get_settings
from ..core.database import (
    Base,
    add_missing_postgres_columns,
    add_missing_sqlite_columns,
    make_engine,
    normalize_database_url,
)
from ..models import Artifact, ArtifactTag, President, Tag, User
from .catalog_seed import CURATOR_SEED_EMAIL, _curator_account
from .id_codes import normalize_id_code

logger = logging.getLogger("sulyap.catalog_sync")

Direction = Literal["pull", "push", "both"]
RestoreTarget = Literal["local", "remote", "both"]

MAX_SNAPSHOTS = 10
BACKEND_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BACKEND_DIR / "data"
VERSIONS_DIR = DATA_DIR / "catalog_versions"
STATE_PATH = DATA_DIR / "catalog_sync_state.json"
INDEX_NAME = "index.json"

PRESIDENT_FIELDS = ("id", "name", "service", "icon", "biography", "photo_url", "published")
ARTIFACT_HASH_FIELDS = (
    "title",
    "description",
    "image_url",
    "model_url",
    "id_code",
    "owner_name",
    "year",
    "year_acquired",
    "country_of_origin",
    "artifact_type",
    "subtitle",
    "icon",
    "remarks",
    "llm_assist_enabled",
    "president_id",
    "published",
)
TAG_FIELDS = ("slug", "label", "kind")


class CatalogSyncError(RuntimeError):
    """User-facing sync failure (missing remote URL, no curator, etc.)."""


@dataclass
class SyncReport:
    direction: str
    dry_run: bool
    copied_to_local: int = 0
    copied_to_remote: int = 0
    conflicts_prefer_remote: int = 0
    deletes_local: int = 0
    deletes_remote: int = 0
    skipped: int = 0
    snapshot_ids: list[str] = field(default_factory=list)
    discarded: list[dict[str, Any]] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)

    def summary(self) -> str:
        return (
            f"direction={self.direction} dry_run={self.dry_run} "
            f"to_local={self.copied_to_local} to_remote={self.copied_to_remote} "
            f"conflicts={self.conflicts_prefer_remote} "
            f"del_local={self.deletes_local} del_remote={self.deletes_remote} "
            f"skipped={self.skipped}"
        )

    def as_dict(self) -> dict[str, Any]:
        return {
            "direction": self.direction,
            "dry_run": self.dry_run,
            "copied_to_local": self.copied_to_local,
            "copied_to_remote": self.copied_to_remote,
            "conflicts_prefer_remote": self.conflicts_prefer_remote,
            "deletes_local": self.deletes_local,
            "deletes_remote": self.deletes_remote,
            "skipped": self.skipped,
            "snapshot_ids": list(self.snapshot_ids),
            "discarded_count": len(self.discarded),
            "notes": list(self.notes),
        }


def safe_db_label(url: str) -> str:
    """Host/path only — never include userinfo."""
    stripped = (url or "").strip()
    if not stripped:
        return "(empty)"
    return stripped.split("@")[-1] if "@" in stripped else stripped


def resolve_sqlite_url(url: str, base_dir: Path | None = None) -> str:
    """Make relative sqlite:/// paths absolute against the backend directory."""
    raw = (url or "").strip()
    if not raw.startswith("sqlite:///"):
        return raw
    rest = raw[len("sqlite:///") :]
    if rest.startswith(":memory:"):
        return raw
    path = Path(rest)
    if not path.is_absolute():
        path = ((base_dir or BACKEND_DIR) / rest).resolve()
    return "sqlite:///" + path.as_posix()


def prepare_url(url: str) -> str:
    return normalize_database_url(resolve_sqlite_url(url.strip()))


def content_hash(payload: Any) -> str:
    blob = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def decide_row(
    *,
    local_hash: str | None,
    remote_hash: str | None,
    prev_local_hash: str | None,
    prev_remote_hash: str | None,
    direction: Direction,
    apply_deletes: bool,
) -> str:
    """Return a merge action. Pure function — safe to unit-test without a database.

    Actions: skip, copy_to_local, copy_to_remote, conflict_prefer_remote,
    delete_local, delete_remote.
    """
    if local_hash is None and remote_hash is None:
        return "skip"

    if local_hash is None:
        if direction in ("pull", "both"):
            return "copy_to_local"
        return "delete_remote" if apply_deletes else "skip"

    if remote_hash is None:
        if direction in ("push", "both"):
            return "copy_to_remote"
        return "delete_local" if apply_deletes else "skip"

    if local_hash == remote_hash:
        return "skip"

    local_changed = prev_local_hash is None or local_hash != prev_local_hash
    remote_changed = prev_remote_hash is None or remote_hash != prev_remote_hash
    first_sync = prev_local_hash is None and prev_remote_hash is None

    if first_sync:
        winner = "remote"
        conflict = False
    elif local_changed and not remote_changed:
        winner = "local"
        conflict = False
    elif remote_changed and not local_changed:
        winner = "remote"
        conflict = False
    else:
        winner = "remote"
        conflict = local_changed and remote_changed

    if conflict:
        return "conflict_prefer_remote"

    if winner == "local":
        if direction in ("push", "both"):
            return "copy_to_remote"
        return "skip"

    if direction in ("pull", "both"):
        return "copy_to_local"
    return "skip"


def prune_snapshots(directory: Path, keep: int = MAX_SNAPSHOTS) -> list[Path]:
    """Keep the newest `keep` snapshot files; delete the rest. Returns removed paths."""
    directory.mkdir(parents=True, exist_ok=True)
    files = [
        path
        for path in directory.iterdir()
        if path.is_file() and path.name != INDEX_NAME and path.name != ".gitkeep"
        and (path.suffix == ".gz" or path.suffix == ".json")
    ]
    files.sort(key=lambda p: p.name)
    removed: list[Path] = []
    extra = len(files) - keep
    if extra <= 0:
        return removed
    for path in files[:extra]:
        path.unlink(missing_ok=True)
        removed.append(path)
    return removed


def _dt_iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def _parse_dt(value: Any) -> datetime | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)
    text_value = str(value).strip()
    if text_value.endswith("Z"):
        text_value = text_value[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(text_value)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def _as_bool(value: Any) -> bool:
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "t", "yes", "on"}
    return bool(value)


def president_dict(row: President) -> dict[str, Any]:
    return {
        "id": int(row.id),
        "name": row.name or "",
        "service": row.service or "",
        "icon": row.icon or "",
        "biography": row.biography or "",
        "photo_url": row.photo_url or "",
        "published": _as_bool(row.published),
    }


def artifact_dict(row: Artifact) -> dict[str, Any]:
    code = normalize_id_code(getattr(row, "id_code", None) or getattr(row, "rd_code", None))
    return {
        "id": int(row.id),
        "owner_id": int(row.owner_id),
        "title": row.title or "",
        "description": row.description or "",
        "image_url": row.image_url or "",
        "model_url": getattr(row, "model_url", "") or "",
        "id_code": code,
        "owner_name": row.owner_name or "",
        "year": getattr(row, "year", "") or "",
        "year_acquired": getattr(row, "year_acquired", None) or getattr(row, "year", "") or "",
        "country_of_origin": getattr(row, "country_of_origin", "") or "",
        "artifact_type": getattr(row, "artifact_type", "") or "",
        "subtitle": row.subtitle or "",
        "icon": row.icon or "",
        "remarks": getattr(row, "remarks", "") or "",
        "llm_assist_enabled": _as_bool(getattr(row, "llm_assist_enabled", False)),
        "president_id": int(row.president_id) if row.president_id is not None else None,
        "published": _as_bool(row.published),
        "created_at": _dt_iso(row.created_at),
    }


def tag_dict(row: Tag) -> dict[str, Any]:
    return {"id": int(row.id), "slug": row.slug, "label": row.label, "kind": row.kind}


def artifact_key(row: dict[str, Any]) -> str:
    code = normalize_id_code(row.get("id_code"))
    if code:
        return f"code:{code}"
    return f"id:{int(row['id'])}"


def president_key(row: dict[str, Any]) -> str:
    return f"id:{int(row['id'])}"


def tag_key(row: dict[str, Any]) -> str:
    return f"slug:{(row.get('slug') or '').strip()}"


def president_hash(row: dict[str, Any]) -> str:
    return content_hash({field: row.get(field) for field in PRESIDENT_FIELDS})


def artifact_hash(row: dict[str, Any]) -> str:
    payload = {field: row.get(field) for field in ARTIFACT_HASH_FIELDS}
    payload["id_code"] = normalize_id_code(payload.get("id_code"))
    payload["published"] = _as_bool(payload.get("published"))
    payload["llm_assist_enabled"] = _as_bool(payload.get("llm_assist_enabled"))
    return content_hash(payload)


def tag_hash(row: dict[str, Any]) -> str:
    return content_hash({field: row.get(field) for field in TAG_FIELDS})


def dump_catalog(session: Session) -> dict[str, Any]:
    presidents = [president_dict(row) for row in session.scalars(select(President).order_by(President.id)).all()]
    artifacts = [artifact_dict(row) for row in session.scalars(select(Artifact).order_by(Artifact.id)).all()]
    tags = [tag_dict(row) for row in session.scalars(select(Tag).order_by(Tag.id)).all()]
    tag_by_id = {row["id"]: row for row in tags}
    artifact_by_id = {row["id"]: row for row in artifacts}
    links: list[dict[str, Any]] = []
    for link in session.scalars(select(ArtifactTag)).all():
        artifact = artifact_by_id.get(link.artifact_id)
        tag = tag_by_id.get(link.tag_id)
        if not artifact or not tag:
            continue
        links.append(
            {
                "artifact_key": artifact_key(artifact),
                "artifact_id": link.artifact_id,
                "tag_slug": tag["slug"],
                "tag_id": link.tag_id,
                "source": link.source or "auto",
            }
        )
    links.sort(key=lambda item: (item["artifact_key"], item["tag_slug"], item["source"]))
    return {
        "presidents": presidents,
        "artifacts": artifacts,
        "tags": tags,
        "artifact_tags": links,
    }


def catalog_hashes(catalog: dict[str, Any]) -> dict[str, str]:
    hashes: dict[str, str] = {}
    for row in catalog.get("presidents") or []:
        hashes[f"president:{president_key(row)}"] = president_hash(row)
    for row in catalog.get("artifacts") or []:
        hashes[f"artifact:{artifact_key(row)}"] = artifact_hash(row)
    for row in catalog.get("tags") or []:
        hashes[f"tag:{tag_key(row)}"] = tag_hash(row)
    for row in catalog.get("artifact_tags") or []:
        link_key = f"{row['artifact_key']}:{row['tag_slug']}:{row['source']}"
        hashes[f"link:{link_key}"] = content_hash(link_key)
    return hashes


def open_sync_session(database_url: str) -> tuple[Any, sessionmaker]:
    url = prepare_url(database_url)
    engine = make_engine(url)
    Base.metadata.create_all(bind=engine)
    if url.startswith("sqlite"):
        add_missing_sqlite_columns(engine)
    else:
        add_missing_postgres_columns(engine)
    factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return engine, factory


def resolve_catalog_owner(session: Session) -> User:
    user = session.scalar(select(User).where(User.email == CURATOR_SEED_EMAIL))
    if user:
        return user
    user = session.scalar(select(User).where(User.role == "admin").order_by(User.id.asc()))
    if user:
        return user
    raise CatalogSyncError(
        "Destination has no curator/admin user. Create one before syncing artifacts "
        "(catalog sync never copies the users table)."
    )


def _short_id() -> str:
    return secrets.token_hex(4)


def _snapshot_filename(created_at: datetime, source: str, short_id: str) -> str:
    stamp = created_at.strftime("%Y%m%dT%H%M%SZ")
    return f"{stamp}_{source}_{short_id}.json.gz"


def _write_json_gz(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with gzip.open(tmp, "wt", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
    tmp.replace(path)


def _read_json_gz(path: Path) -> dict[str, Any]:
    opener = gzip.open if path.suffix == ".gz" or path.name.endswith(".json.gz") else open
    with opener(path, "rt", encoding="utf-8") as handle:  # type: ignore[arg-type]
        data = json.load(handle)
    if not isinstance(data, dict):
        raise CatalogSyncError(f"Snapshot {path.name} is not a JSON object")
    return data


def _index_path() -> Path:
    return VERSIONS_DIR / INDEX_NAME


def _load_index() -> list[dict[str, Any]]:
    path = _index_path()
    if not path.is_file():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []
    entries = data.get("versions") if isinstance(data, dict) else data
    return list(entries) if isinstance(entries, list) else []


def _save_index(entries: list[dict[str, Any]]) -> None:
    VERSIONS_DIR.mkdir(parents=True, exist_ok=True)
    payload = {"versions": entries[-MAX_SNAPSHOTS:]}
    _index_path().write_text(json.dumps(payload, indent=2), encoding="utf-8")


def write_snapshot(
    *,
    source: str,
    catalog: dict[str, Any],
    discarded: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    created_at = datetime.now(UTC)
    short_id = _short_id()
    entry = {
        "id": short_id,
        "source": source,
        "created_at": _dt_iso(created_at),
        "discarded_conflicts": discarded or [],
        "counts": {
            "presidents": len(catalog.get("presidents") or []),
            "artifacts": len(catalog.get("artifacts") or []),
            "tags": len(catalog.get("tags") or []),
            "artifact_tags": len(catalog.get("artifact_tags") or []),
        },
        "catalog": catalog,
    }
    filename = _snapshot_filename(created_at, source, short_id)
    path = VERSIONS_DIR / filename
    _write_json_gz(path, entry)
    index = _load_index()
    index.append(
        {
            "id": short_id,
            "source": source,
            "created_at": entry["created_at"],
            "file": filename,
            "counts": entry["counts"],
            "discarded_count": len(discarded or []),
        }
    )
    removed = prune_snapshots(VERSIONS_DIR, MAX_SNAPSHOTS)
    removed_names = {path.name for path in removed}
    index = [item for item in index if item.get("file") not in removed_names]
    _save_index(index[-MAX_SNAPSHOTS:])
    return {"id": short_id, "file": filename, "source": source, "created_at": entry["created_at"]}


def list_snapshots() -> list[dict[str, Any]]:
    VERSIONS_DIR.mkdir(parents=True, exist_ok=True)
    index = _load_index()
    if index:
        return index
    entries: list[dict[str, Any]] = []
    for path in sorted(VERSIONS_DIR.glob("*.json.gz")):
        match = re.match(r"^(\d{8}T\d{6}Z)_([a-z]+)_([0-9a-f]+)\.json\.gz$", path.name)
        if not match:
            continue
        entries.append(
            {
                "id": match.group(3),
                "source": match.group(2),
                "created_at": match.group(1),
                "file": path.name,
            }
        )
    return entries


def load_snapshot(version_id: str) -> dict[str, Any]:
    needle = (version_id or "").strip().lower()
    if not needle:
        raise CatalogSyncError("Restore requires a VERSION_ID")
    matches: list[Path] = []
    for path in VERSIONS_DIR.glob("*.json.gz"):
        match = re.match(r"^(\d{8}T\d{6}Z)_([a-z]+)_([0-9a-f]+)\.json\.gz$", path.name)
        if match and match.group(3).startswith(needle):
            matches.append(path)
    if not matches:
        for item in _load_index():
            if str(item.get("id", "")).startswith(needle):
                candidate = VERSIONS_DIR / str(item.get("file", ""))
                if candidate.is_file():
                    matches.append(candidate)
    if not matches:
        raise CatalogSyncError(f"No catalog snapshot matches {version_id!r}")
    if len(matches) > 1 and not any(p.stem.endswith(needle) or p.name.endswith(f"_{needle}.json.gz") for p in matches):
        ids = ", ".join(p.name for p in matches[:8])
        raise CatalogSyncError(f"VERSION_ID {version_id!r} is ambiguous ({ids})")
    path = matches[0]
    payload = _read_json_gz(path)
    payload["_file"] = path.name
    return payload


def load_sync_state() -> dict[str, Any]:
    if not STATE_PATH.is_file():
        return {"last_sync_at": None, "hashes": {}}
    try:
        data = json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"last_sync_at": None, "hashes": {}}
    if not isinstance(data, dict):
        return {"last_sync_at": None, "hashes": {}}
    data.setdefault("hashes", {})
    return data


def save_sync_state(local_hashes: dict[str, str], remote_hashes: dict[str, str]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    keys = set(local_hashes) | set(remote_hashes)
    hashes = {
        key: {"local": local_hashes.get(key), "remote": remote_hashes.get(key)}
        for key in sorted(keys)
    }
    payload = {"last_sync_at": _dt_iso(datetime.now(UTC)), "hashes": hashes}
    STATE_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def _prev_hashes(state: dict[str, Any], key: str) -> tuple[str | None, str | None]:
    entry = (state.get("hashes") or {}).get(key) or {}
    if not isinstance(entry, dict):
        return None, None
    local = entry.get("local")
    remote = entry.get("remote")
    return (str(local) if local else None, str(remote) if remote else None)


def _index_by_key(rows: list[dict[str, Any]], key_fn) -> dict[str, dict[str, Any]]:
    indexed: dict[str, dict[str, Any]] = {}
    for row in rows:
        indexed[key_fn(row)] = row
    return indexed


_PG_SETVAL = {
    "presidents": "SELECT setval(pg_get_serial_sequence('presidents', 'id'), :max_id)",
    "artifacts": "SELECT setval(pg_get_serial_sequence('artifacts', 'id'), :max_id)",
    "tags": "SELECT setval(pg_get_serial_sequence('tags', 'id'), :max_id)",
}


def _reset_pk_sequence(session: Session, table: str) -> None:
    bind = session.get_bind()
    dialect = bind.dialect.name if bind is not None else ""
    model = {"presidents": President, "artifacts": Artifact, "tags": Tag}[table]
    max_id = session.scalar(select(func.max(model.id))) or 1
    if dialect == "postgresql":
        session.execute(text(_PG_SETVAL[table]), {"max_id": int(max_id)})
    elif dialect == "sqlite":
        exists = session.execute(
            text("SELECT 1 FROM sqlite_master WHERE type='table' AND name = 'sqlite_sequence'")
        ).scalar()
        if not exists:
            return
        session.execute(text("DELETE FROM sqlite_sequence WHERE name = :name"), {"name": table})
        session.execute(
            text("INSERT INTO sqlite_sequence(name, seq) VALUES (:name, :seq)"),
            {"name": table, "seq": int(max_id)},
        )


def _find_president(session: Session, row: dict[str, Any]) -> President | None:
    found = session.get(President, int(row["id"]))
    if found:
        return found
    name = (row.get("name") or "").strip()
    if name:
        return session.scalar(select(President).where(President.name == name))
    return None


def _find_artifact(session: Session, row: dict[str, Any]) -> Artifact | None:
    code = normalize_id_code(row.get("id_code"))
    if code:
        found = session.scalar(select(Artifact).where(Artifact.id_code == code))
        if found:
            return found
        # Case-insensitive fallback for older rows.
        found = session.scalar(select(Artifact).where(func.upper(Artifact.id_code) == code))
        if found:
            return found
    return session.get(Artifact, int(row["id"]))


def _find_tag(session: Session, row: dict[str, Any]) -> Tag | None:
    slug = (row.get("slug") or "").strip()
    if not slug:
        return None
    return session.scalar(select(Tag).where(Tag.slug == slug))


def _apply_president(session: Session, row: dict[str, Any]) -> President:
    existing = _find_president(session, row)
    if existing is None:
        existing = President(id=int(row["id"]))
        session.add(existing)
    existing.name = row.get("name") or ""
    existing.service = row.get("service") or ""
    existing.icon = row.get("icon") or "👤"
    existing.biography = row.get("biography") or ""
    existing.photo_url = row.get("photo_url") or ""
    existing.published = _as_bool(row.get("published", True))
    session.flush()
    return existing


def _apply_tag(session: Session, row: dict[str, Any]) -> Tag:
    slug = (row.get("slug") or "").strip()
    existing = _find_tag(session, row)
    if existing is None:
        existing = Tag(slug=slug, label=row.get("label") or slug, kind=row.get("kind") or "theme")
        session.add(existing)
    else:
        existing.label = row.get("label") or existing.label
        existing.kind = row.get("kind") or existing.kind
    session.flush()
    return existing


def _apply_artifact(session: Session, row: dict[str, Any], owner: User, president_ids: set[int]) -> Artifact:
    existing = _find_artifact(session, row)
    created_at = _parse_dt(row.get("created_at")) or datetime.now(UTC)
    president_id = row.get("president_id")
    if president_id is not None:
        president_id = int(president_id)
        if president_id not in president_ids:
            president_id = None
    if existing is None:
        wanted_id = int(row["id"])
        id_taken = session.get(Artifact, wanted_id)
        kwargs: dict[str, Any] = {
            "owner_id": owner.id,
            "title": row.get("title") or "",
            "description": row.get("description") or "",
            "image_url": row.get("image_url") or "",
            "model_url": row.get("model_url") or "",
            "id_code": normalize_id_code(row.get("id_code")),
            "owner_name": row.get("owner_name") or "",
            "year": row.get("year") or row.get("year_acquired") or "",
            "year_acquired": row.get("year_acquired") or row.get("year") or "",
            "country_of_origin": row.get("country_of_origin") or "",
            "artifact_type": row.get("artifact_type") or "",
            "subtitle": row.get("subtitle") or "",
            "icon": row.get("icon") or "🏺",
            "remarks": row.get("remarks") or "",
            "llm_assist_enabled": _as_bool(row.get("llm_assist_enabled", False)),
            "president_id": president_id,
            "published": _as_bool(row.get("published", True)),
            "created_at": created_at,
        }
        if id_taken is None:
            kwargs["id"] = wanted_id
        existing = Artifact(**kwargs)
        session.add(existing)
    else:
        existing.title = row.get("title") or ""
        existing.description = row.get("description") or ""
        existing.image_url = row.get("image_url") or ""
        existing.model_url = row.get("model_url") or ""
        existing.id_code = normalize_id_code(row.get("id_code")) or existing.id_code
        existing.owner_name = row.get("owner_name") or ""
        existing.year = row.get("year") or row.get("year_acquired") or ""
        existing.year_acquired = row.get("year_acquired") or row.get("year") or ""
        existing.country_of_origin = row.get("country_of_origin") or ""
        existing.artifact_type = row.get("artifact_type") or ""
        existing.subtitle = row.get("subtitle") or ""
        existing.icon = row.get("icon") or "🏺"
        existing.remarks = row.get("remarks") or ""
        existing.llm_assist_enabled = _as_bool(row.get("llm_assist_enabled", False))
        existing.president_id = president_id
        existing.published = _as_bool(row.get("published", True))
    session.flush()
    return existing


def _apply_link(
    session: Session,
    *,
    artifact_id: int,
    tag_id: int,
    source: str,
) -> None:
    exists = session.scalar(
        select(ArtifactTag).where(
            ArtifactTag.artifact_id == artifact_id,
            ArtifactTag.tag_id == tag_id,
            ArtifactTag.source == source,
        )
    )
    if exists:
        return
    session.add(ArtifactTag(artifact_id=artifact_id, tag_id=tag_id, source=source))


def _delete_link(session: Session, *, artifact_id: int, tag_id: int, source: str) -> None:
    row = session.scalar(
        select(ArtifactTag).where(
            ArtifactTag.artifact_id == artifact_id,
            ArtifactTag.tag_id == tag_id,
            ArtifactTag.source == source,
        )
    )
    if row is not None:
        session.delete(row)


def apply_catalog_snapshot(session: Session, catalog: dict[str, Any], *, replace: bool) -> None:
    """Write a catalog dump onto `session`. Remaps artifact owner_id to dest curator."""
    owner = resolve_catalog_owner(session)
    incoming_presidents = list(catalog.get("presidents") or [])
    incoming_tags = list(catalog.get("tags") or [])
    incoming_artifacts = list(catalog.get("artifacts") or [])
    incoming_links = list(catalog.get("artifact_tags") or [])

    for row in incoming_presidents:
        _apply_president(session, row)
    session.flush()
    president_ids = {int(pid) for pid in session.scalars(select(President.id)).all()}

    for row in incoming_tags:
        _apply_tag(session, row)
    session.flush()

    for row in incoming_artifacts:
        _apply_artifact(session, row, owner, president_ids)
    session.flush()

    dest_artifacts = {artifact_key(artifact_dict(row)): row for row in session.scalars(select(Artifact)).all()}
    dest_tags = {row.slug: row for row in session.scalars(select(Tag)).all()}

    for link in incoming_links:
        artifact = dest_artifacts.get(link["artifact_key"])
        tag = dest_tags.get(link["tag_slug"])
        if artifact is None or tag is None:
            continue
        _apply_link(session, artifact_id=artifact.id, tag_id=tag.id, source=link.get("source") or "auto")

    if replace:
        keep_president_ids = {int(row["id"]) for row in incoming_presidents}
        keep_artifact_keys = {artifact_key(row) for row in incoming_artifacts}
        keep_tag_slugs = {(row.get("slug") or "").strip() for row in incoming_tags}
        keep_links = {
            (link["artifact_key"], link["tag_slug"], link.get("source") or "auto") for link in incoming_links
        }
        for link in list(session.scalars(select(ArtifactTag)).all()):
            artifact = session.get(Artifact, link.artifact_id)
            tag = session.get(Tag, link.tag_id)
            if artifact is None or tag is None:
                session.delete(link)
                continue
            key = (artifact_key(artifact_dict(artifact)), tag.slug, link.source or "auto")
            if key not in keep_links:
                session.delete(link)
        for artifact in list(session.scalars(select(Artifact)).all()):
            if artifact_key(artifact_dict(artifact)) not in keep_artifact_keys:
                session.delete(artifact)
        for tag in list(session.scalars(select(Tag)).all()):
            if tag.slug not in keep_tag_slugs:
                session.delete(tag)
        for president in list(session.scalars(select(President)).all()):
            if president.id not in keep_president_ids:
                session.delete(president)

    session.flush()
    for table in ("presidents", "artifacts", "tags"):
        _reset_pk_sequence(session, table)


def _same_url(left: str, right: str) -> bool:
    return prepare_url(left) == prepare_url(right)


def run_catalog_sync(
    *,
    local_url: str,
    remote_url: str,
    direction: Direction = "both",
    dry_run: bool = False,
    apply_deletes: bool = False,
) -> SyncReport:
    if direction not in {"pull", "push", "both"}:
        raise CatalogSyncError("direction must be pull, push, or both")
    if not (remote_url or "").strip():
        raise CatalogSyncError(
            "Remote catalog URI is not set. Set SYNC_REMOTE_DATABASE_URL or pair a local "
            "sqlite file with DATABASE_URL (see docs/DEPLOYMENT.md). Users/password hashes "
            "are never synced."
        )
    if not (local_url or "").strip():
        raise CatalogSyncError("DATABASE_URL is not set")
    if _same_url(local_url, remote_url):
        raise CatalogSyncError("DATABASE_URL and SYNC_REMOTE_DATABASE_URL point at the same database")

    report = SyncReport(direction=direction, dry_run=dry_run)
    local_engine = remote_engine = None
    local_session: Session | None = None
    remote_session: Session | None = None
    try:
        try:
            local_engine, local_factory = open_sync_session(local_url)
        except CatalogSyncError:
            raise
        except Exception:
            logger.error("Local catalog connection failed for …@%s", safe_db_label(local_url))
            raise CatalogSyncError(
                f"Could not connect to local database (…@{safe_db_label(local_url)}). Check DATABASE_URL."
            ) from None
        try:
            remote_engine, remote_factory = open_sync_session(remote_url)
        except CatalogSyncError:
            raise
        except Exception:
            logger.error("Remote catalog connection failed for …@%s", safe_db_label(remote_url))
            raise CatalogSyncError(
                f"Could not connect to remote database (…@{safe_db_label(remote_url)}). "
                "Check SYNC_REMOTE_DATABASE_URL."
            ) from None
        local_session = local_factory()
        remote_session = remote_factory()
        existing = local_session.scalar(select(User).where(User.email == CURATOR_SEED_EMAIL))
        if not existing:
            existing = local_session.scalar(select(User).where(User.role == "admin").order_by(User.id.asc()))
        if not existing:
            _curator_account(local_session)
            local_session.flush()

        local_catalog = dump_catalog(local_session)
        remote_catalog = dump_catalog(remote_session)

        if not dry_run:
            local_snap = write_snapshot(source="local", catalog=local_catalog)
            remote_snap = write_snapshot(source="remote", catalog=remote_catalog)
            report.snapshot_ids = [local_snap["id"], remote_snap["id"]]
            report.notes.append(
                f"snapshotted local={local_snap['id']} remote={remote_snap['id']} "
                f"(kept {MAX_SNAPSHOTS} newest files)"
            )
        else:
            report.notes.append("dry-run: snapshots not written")

        state = load_sync_state()
        local_map = {
            "president": _index_by_key(local_catalog["presidents"], president_key),
            "artifact": _index_by_key(local_catalog["artifacts"], artifact_key),
            "tag": _index_by_key(local_catalog["tags"], tag_key),
            "link": {
                f"{row['artifact_key']}:{row['tag_slug']}:{row['source']}": row
                for row in local_catalog["artifact_tags"]
            },
        }
        remote_map = {
            "president": _index_by_key(remote_catalog["presidents"], president_key),
            "artifact": _index_by_key(remote_catalog["artifacts"], artifact_key),
            "tag": _index_by_key(remote_catalog["tags"], tag_key),
            "link": {
                f"{row['artifact_key']}:{row['tag_slug']}:{row['source']}": row
                for row in remote_catalog["artifact_tags"]
            },
        }
        hash_fn = {
            "president": president_hash,
            "artifact": artifact_hash,
            "tag": tag_hash,
            "link": lambda row: content_hash(f"{row['artifact_key']}:{row['tag_slug']}:{row['source']}"),
        }
        prefix = {"president": "president", "artifact": "artifact", "tag": "tag", "link": "link"}
        copy_rank = {"president": 0, "tag": 1, "artifact": 2, "link": 3}
        delete_rank = {"link": 0, "artifact": 1, "tag": 2, "president": 3}

        planned: list[tuple[str, str, str, dict[str, Any] | None, dict[str, Any] | None]] = []
        for kind in ("president", "tag", "artifact", "link"):
            keys = set(local_map[kind]) | set(remote_map[kind])
            for key in sorted(keys):
                local_row = local_map[kind].get(key)
                remote_row = remote_map[kind].get(key)
                local_h = hash_fn[kind](local_row) if local_row else None
                remote_h = hash_fn[kind](remote_row) if remote_row else None
                prev_l, prev_r = _prev_hashes(state, f"{prefix[kind]}:{key}")
                action = decide_row(
                    local_hash=local_h,
                    remote_hash=remote_h,
                    prev_local_hash=prev_l,
                    prev_remote_hash=prev_r,
                    direction=direction,
                    apply_deletes=apply_deletes,
                )
                planned.append((kind, key, action, local_row, remote_row))

        def _plan_rank(item: tuple[str, str, str, dict[str, Any] | None, dict[str, Any] | None]) -> tuple[int, int, str]:
            kind, key, action, _local_row, _remote_row = item
            if action in {"delete_local", "delete_remote"}:
                return (1, delete_rank[kind], key)
            return (0, copy_rank[kind], key)

        planned.sort(key=_plan_rank)

        local_owner = None
        remote_owner = None
        if not dry_run:
            if any(
                kind == "artifact" and action in {"copy_to_local", "conflict_prefer_remote"}
                for kind, _key, action, _l, _r in planned
            ):
                local_owner = resolve_catalog_owner(local_session)
            if any(kind == "artifact" and action == "copy_to_remote" for kind, _key, action, _l, _r in planned):
                remote_owner = resolve_catalog_owner(remote_session)

        local_president_ids = {int(pid) for pid in local_session.scalars(select(President.id)).all()}
        remote_president_ids = {int(pid) for pid in remote_session.scalars(select(President.id)).all()}

        for kind, key, action, local_row, remote_row in planned:
            if action == "skip":
                report.skipped += 1
                continue
            if action == "conflict_prefer_remote":
                report.conflicts_prefer_remote += 1
                report.discarded.append(
                    {"entity": kind, "key": key, "kept": "remote", "discarded": local_row}
                )
                if direction in {"pull", "both"}:
                    action = "copy_to_local"
                else:
                    report.skipped += 1
                    continue

            if dry_run:
                if action == "copy_to_local":
                    report.copied_to_local += 1
                elif action == "copy_to_remote":
                    report.copied_to_remote += 1
                elif action == "delete_local":
                    report.deletes_local += 1
                elif action == "delete_remote":
                    report.deletes_remote += 1
                continue

            if action == "copy_to_local" and remote_row is not None:
                _apply_kind(local_session, kind, remote_row, local_owner, local_president_ids)
                report.copied_to_local += 1
                if kind == "president":
                    local_president_ids.add(int(remote_row["id"]))
            elif action == "copy_to_remote" and local_row is not None:
                _apply_kind(remote_session, kind, local_row, remote_owner, remote_president_ids)
                report.copied_to_remote += 1
                if kind == "president":
                    remote_president_ids.add(int(local_row["id"]))
            elif action == "delete_local":
                _delete_kind(local_session, kind, key, local_row)
                report.deletes_local += 1
            elif action == "delete_remote":
                _delete_kind(remote_session, kind, key, remote_row)
                report.deletes_remote += 1

        if not dry_run:
            local_session.flush()
            remote_session.flush()
            for table in ("presidents", "artifacts", "tags"):
                _reset_pk_sequence(local_session, table)
                _reset_pk_sequence(remote_session, table)
            remote_session.commit()
            local_session.commit()
            if report.discarded and report.snapshot_ids:
                report.notes.append(
                    f"{len(report.discarded)} conflict(s) kept remote; "
                    f"restore snapshot {report.snapshot_ids[0]} to recover discarded local rows"
                )
            save_sync_state(catalog_hashes(dump_catalog(local_session)), catalog_hashes(dump_catalog(remote_session)))
        else:
            local_session.rollback()
            remote_session.rollback()

        report.notes.append(
            f"local=…@{safe_db_label(prepare_url(local_url))} remote=…@{safe_db_label(prepare_url(remote_url))}"
        )
        if apply_deletes:
            report.notes.append("apply-deletes enabled")
        report.notes.append("users table was not synced")
        report.notes.append("photo/model files are metadata-only; binaries are not copied")
        return report
    except CatalogSyncError:
        if local_session is not None:
            local_session.rollback()
        if remote_session is not None:
            remote_session.rollback()
        raise
    except Exception:
        if local_session is not None:
            local_session.rollback()
        if remote_session is not None:
            remote_session.rollback()
        logger.exception("Catalog sync failed")
        raise
    finally:
        if local_session is not None:
            local_session.close()
        if remote_session is not None:
            remote_session.close()
        if local_engine is not None:
            local_engine.dispose()
        if remote_engine is not None:
            remote_engine.dispose()


def _apply_kind(
    session: Session,
    kind: str,
    row: dict[str, Any],
    owner: User | None,
    president_ids: set[int],
) -> None:
    if kind == "president":
        _apply_president(session, row)
        return
    if kind == "tag":
        _apply_tag(session, row)
        return
    if kind == "artifact":
        if owner is None:
            owner = resolve_catalog_owner(session)
        _apply_artifact(session, row, owner, president_ids)
        return
    artifact_row = _lookup_artifact_by_key(session, row["artifact_key"])
    tag_row = session.scalar(select(Tag).where(Tag.slug == row["tag_slug"]))
    if artifact_row is None or tag_row is None:
        return
    _apply_link(session, artifact_id=artifact_row.id, tag_id=tag_row.id, source=row.get("source") or "auto")


def _lookup_artifact_by_key(session: Session, key: str) -> Artifact | None:
    if key.startswith("code:"):
        code = key.split(":", 1)[1]
        found = session.scalar(select(Artifact).where(Artifact.id_code == code))
        if found:
            return found
        return session.scalar(select(Artifact).where(func.upper(Artifact.id_code) == code))
    if key.startswith("id:"):
        return session.get(Artifact, int(key.split(":", 1)[1]))
    return None


def _delete_kind(session: Session, kind: str, key: str, row: dict[str, Any] | None) -> None:
    if kind == "president":
        target = session.get(President, int(row["id"])) if row else None
        if target is not None:
            session.delete(target)
        return
    if kind == "tag":
        slug = (row or {}).get("slug") or key.removeprefix("slug:")
        target = session.scalar(select(Tag).where(Tag.slug == slug))
        if target is not None:
            session.delete(target)
        return
    if kind == "artifact":
        target = _find_artifact(session, row) if row else _lookup_artifact_by_key(session, key)
        if target is not None:
            session.delete(target)
        return
    artifact_row = _lookup_artifact_by_key(session, (row or {}).get("artifact_key") or "")
    tag_row = session.scalar(select(Tag).where(Tag.slug == (row or {}).get("tag_slug")))
    if artifact_row is None or tag_row is None:
        return
    _delete_link(
        session,
        artifact_id=artifact_row.id,
        tag_id=tag_row.id,
        source=(row or {}).get("source") or "auto",
    )


def restore_catalog_version(
    *,
    version_id: str,
    local_url: str,
    remote_url: str | None,
    target: RestoreTarget = "both",
    dry_run: bool = False,
) -> SyncReport:
    snapshot = load_snapshot(version_id)
    catalog = snapshot.get("catalog")
    if not isinstance(catalog, dict):
        raise CatalogSyncError(f"Snapshot {version_id} has no catalog payload")
    if target not in {"local", "remote", "both"}:
        raise CatalogSyncError("target must be local, remote, or both")
    if target in {"remote", "both"} and not (remote_url or "").strip():
        raise CatalogSyncError(
            "SYNC_REMOTE_DATABASE_URL is not set; pass --target local to restore only SQLite"
        )

    report = SyncReport(direction=f"restore:{target}", dry_run=dry_run)
    report.notes.append(
        f"restoring snapshot {snapshot.get('id')} source={snapshot.get('source')} "
        f"created_at={snapshot.get('created_at')} file={snapshot.get('_file')}"
    )
    if dry_run:
        counts = snapshot.get("counts") or {
            "presidents": len(catalog.get("presidents") or []),
            "artifacts": len(catalog.get("artifacts") or []),
        }
        report.notes.append(f"dry-run restore counts={counts}")
        return report

    engines = []
    sessions: list[tuple[str, Session]] = []
    try:
        if target in {"local", "both"}:
            engine, factory = open_sync_session(local_url)
            engines.append(engine)
            session = factory()
            sessions.append(("local", session))
            write_snapshot(source="local", catalog=dump_catalog(session))
        if target in {"remote", "both"}:
            engine, factory = open_sync_session(remote_url or "")
            engines.append(engine)
            session = factory()
            sessions.append(("remote", session))
            write_snapshot(source="remote", catalog=dump_catalog(session))

        for label, session in sessions:
            apply_catalog_snapshot(session, catalog, replace=True)
        for label, session in sessions:
            session.commit()
            report.notes.append(f"wrote snapshot onto {label}")
            if label == "local":
                report.copied_to_local += 1
            else:
                report.copied_to_remote += 1
        report.snapshot_ids.append(str(snapshot.get("id")))
        report.notes.append("users table was not modified")
        return report
    except Exception:
        for _, session in sessions:
            session.rollback()
        raise
    finally:
        for _, session in sessions:
            session.close()
        for engine in engines:
            engine.dispose()


def _is_sqlite_url(url: str) -> bool:
    return (url or "").strip().lower().startswith("sqlite")


def _order_local_remote(primary: str, extra: str) -> tuple[str, str]:
    """Treat SQLite as local and Postgres as remote when the pair is mixed."""
    if _is_sqlite_url(primary) and not _is_sqlite_url(extra):
        return primary, extra
    if _is_sqlite_url(extra) and not _is_sqlite_url(primary):
        return extra, primary
    return primary, extra


def resolve_sync_urls(*, require_remote: bool = True) -> tuple[str, str]:
    """Pair a local catalog DB with a remote one.

    v2 often sets DATABASE_URL to Supabase already. Sync still works when:
    - SYNC_REMOTE_DATABASE_URL is set (paired with DATABASE_URL; sqlite is local), or
    - DATABASE_URL is remote and backend/sulyap.db exists (used as local sqlite).
    """
    settings = get_settings()
    primary = (settings.database_url or "").strip()
    extra = (settings.sync_remote_database_url or "").strip()
    if extra:
        return _order_local_remote(primary, extra)
    if primary and not _is_sqlite_url(primary):
        default_sqlite = BACKEND_DIR / "sulyap.db"
        default_sqlite.parent.mkdir(parents=True, exist_ok=True)
        if not default_sqlite.is_file():
            default_sqlite.touch()
        return f"sqlite:///{default_sqlite.as_posix()}", primary
    if not require_remote:
        return primary, extra
    raise CatalogSyncError(
        "SYNC_REMOTE_DATABASE_URL is not set. Add a second catalog URI (typically "
        "sqlite:///./sulyap.db plus the Supabase Postgres URI), or keep a local "
        "sulyap.db next to the backend when DATABASE_URL is already remote. "
        "Users/password hashes are never synced."
    )


def run_from_settings(
    *,
    direction: Direction = "both",
    dry_run: bool = False,
    apply_deletes: bool = False,
) -> SyncReport:
    local_url, remote_url = resolve_sync_urls()
    return run_catalog_sync(
        local_url=local_url,
        remote_url=remote_url,
        direction=direction,
        dry_run=dry_run,
        apply_deletes=apply_deletes,
    )


def schedule_catalog_mirror() -> None:
    """Mirror catalog both ways in a daemon thread. Never raises to the request path."""

    def _run() -> None:
        try:
            report = run_from_settings(direction="both", dry_run=False, apply_deletes=False)
            logger.info("Catalog mirror: %s", report.summary())
        except CatalogSyncError as exc:
            logger.info("Catalog mirror skipped: %s", exc)
        except Exception:
            logger.exception("Catalog mirror failed")

    threading.Thread(target=_run, name="catalog-mirror", daemon=True).start()


def restore_from_settings(
    *,
    version_id: str,
    target: RestoreTarget = "both",
    dry_run: bool = False,
) -> SyncReport:
    local_url, remote_url = resolve_sync_urls(require_remote=target != "local")
    return restore_catalog_version(
        version_id=version_id,
        local_url=local_url,
        remote_url=remote_url,
        target=target,
        dry_run=dry_run,
    )
