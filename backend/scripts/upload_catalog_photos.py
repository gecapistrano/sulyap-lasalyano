"""
Upload local catalog photos to Supabase Storage and point DB URL fields at the public objects.

Does not store binaries in Postgres. Uses SUPABASE_SERVICE_ROLE_KEY locally.

Usage (from backend/):
  python scripts/upload_catalog_photos.py --dry-run
  python scripts/upload_catalog_photos.py
  python scripts/upload_catalog_photos.py --skip-existing
"""
from __future__ import annotations

import argparse
import os
import re
import sys
import tarfile
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
sys.path.insert(0, str(ROOT))


def _load_dotenv(path: Path) -> None:
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        if not key:
            continue
        val = val.strip()
        if len(val) >= 2 and val[0] == val[-1] and val[0] in {"'", '"'}:
            val = val[1:-1]
        os.environ.setdefault(key, val)


_load_dotenv(ROOT / ".env")

from sqlalchemy import select  # noqa: E402

from app.models import Artifact, President  # noqa: E402
from app.services.catalog_seed import PLACEHOLDER_IMAGE  # noqa: E402
from app.services.catalog_sync import open_sync_session, prepare_url  # noqa: E402
from app.services.id_codes import normalize_id_code  # noqa: E402
from app.services.media_urls import is_http_url  # noqa: E402
from app.services.object_storage import (  # noqa: E402
    ALLOWED_SUFFIXES,
    StorageError,
    StorageSettings,
    ensure_public_bucket,
    object_key_for_artifact,
    object_key_for_artifact_code,
    object_key_for_president,
    president_slug,
    public_object_url,
    upload_file,
)
from app.services.photo_uploads import (  # noqa: E402
    BUNDLED_PHOTOS_ARCHIVE,
    MAX_PHOTO_BYTES,
    PHOTOS_ROOT,
    ensure_photo_dir,
    photo_path_for_media_key,
    restore_bundled_photos,
)

_IMPORT_RE = re.compile(r"^import_([A-Z0-9]{2,32})\.(jpg|jpeg|png|webp)$", re.I)
_UPLOAD_RE = re.compile(r"^(\d+)_[0-9a-f]{16}\.(jpg|jpeg|png|webp)$", re.I)

PORTRAIT_DIRS = (
    REPO / "hall" / "assets" / "presidents",
)


@dataclass
class PhotoJob:
    kind: str
    key: str
    path: Path
    artifact_id: int | None = None
    id_code: str = ""
    president_id: int | None = None
    note: str = ""


@dataclass
class UploadReport:
    uploaded: int = 0
    skipped: int = 0
    missing: int = 0
    failed: int = 0
    db_local: int = 0
    db_remote: int = 0
    notes: list[str] = field(default_factory=list)
    failures: list[str] = field(default_factory=list)
    missing_rows: list[str] = field(default_factory=list)

    def summary(self) -> str:
        return (
            f"uploaded={self.uploaded} skipped={self.skipped} missing={self.missing} "
            f"failed={self.failed} db_local={self.db_local} db_remote={self.db_remote}"
        )


def _is_image(path: Path) -> bool:
    return path.is_file() and path.suffix.lower() in ALLOWED_SUFFIXES


def _extract_tar_images() -> int:
    """Restore the seed archive and any other flat image members (path-safe)."""
    ensure_photo_dir()
    restored = restore_bundled_photos()
    if not BUNDLED_PHOTOS_ARCHIVE.is_file():
        return restored
    extra = 0
    try:
        with tarfile.open(BUNDLED_PHOTOS_ARCHIVE, "r:gz") as tar:
            for member in tar.getmembers():
                if not member.isfile():
                    continue
                name = Path(member.name).name
                if name != Path(member.name).name or ".." in name:
                    continue
                if Path(name).suffix.lower() not in ALLOWED_SUFFIXES:
                    continue
                dest = PHOTOS_ROOT / name
                if dest.is_file():
                    continue
                extracted = tar.extractfile(member)
                if extracted is None:
                    continue
                with extracted, dest.open("wb") as out:
                    out.write(extracted.read())
                extra += 1
    except (OSError, tarfile.TarError) as exc:
        print(f"warning: could not read bundled photo archive: {exc}", file=sys.stderr)
        return restored
    return restored + extra


def _local_db_url() -> str:
    return (os.environ.get("DATABASE_URL") or "sqlite:///./sulyap.db").strip()


def _remote_db_url() -> str:
    return (os.environ.get("SYNC_REMOTE_DATABASE_URL") or "").strip()


def _rel_note(path: Path) -> str:
    try:
        return str(path.relative_to(REPO))
    except ValueError:
        return path.name


def _open_rows(database_url: str) -> tuple[list[Artifact], list[President], object, object]:
    engine, factory = open_sync_session(database_url)
    session = factory()
    artifacts = list(session.scalars(select(Artifact).order_by(Artifact.id.asc())).all())
    presidents = list(session.scalars(select(President).order_by(President.id.asc())).all())
    return artifacts, presidents, session, engine


def _candidate_local_photo(artifact: Artifact) -> Path | None:
    stored = getattr(artifact, "image_url", "") or ""
    path = photo_path_for_media_key(stored)
    if path:
        return path
    code = normalize_id_code(getattr(artifact, "id_code", "") or "")
    if not code:
        return None
    for suffix in (".png", ".jpg", ".jpeg", ".webp"):
        candidate = PHOTOS_ROOT / f"import_{code}{suffix}"
        if candidate.is_file():
            return candidate
    return None


def _jobs_from_disk(
    artifacts: list[Artifact],
    presidents: list[President],
) -> tuple[list[PhotoJob], list[str]]:
    jobs: list[PhotoJob] = []
    missing: list[str] = []
    claimed: set[Path] = set()

    by_id = {int(row.id): row for row in artifacts}
    by_code: dict[str, Artifact] = {}
    for row in artifacts:
        code = normalize_id_code(getattr(row, "id_code", "") or "")
        if code:
            by_code[code] = row

    for row in artifacts:
        code = normalize_id_code(getattr(row, "id_code", "") or "")
        path = _candidate_local_photo(row)
        stored = (getattr(row, "image_url", "") or "").strip()
        if path is None:
            if stored and stored != PLACEHOLDER_IMAGE and not is_http_url(stored):
                missing.append(f"artifact {code or row.id}: {stored}")
            continue
        key = object_key_for_artifact(int(row.id), path.suffix)
        jobs.append(
            PhotoJob(
                kind="artifact",
                key=key,
                path=path,
                artifact_id=int(row.id),
                id_code=code,
                note=path.name,
            )
        )
        claimed.add(path.resolve())

    ensure_photo_dir()
    for path in sorted(PHOTOS_ROOT.iterdir() if PHOTOS_ROOT.is_dir() else []):
        if not _is_image(path) or path.resolve() in claimed:
            continue
        name = path.name
        import_match = _IMPORT_RE.fullmatch(name)
        upload_match = _UPLOAD_RE.fullmatch(name)
        if import_match:
            code = normalize_id_code(import_match.group(1))
            row = by_code.get(code)
            if row:
                jobs.append(
                    PhotoJob(
                        kind="artifact",
                        key=object_key_for_artifact(int(row.id), path.suffix),
                        path=path,
                        artifact_id=int(row.id),
                        id_code=code,
                        note=name,
                    )
                )
            else:
                jobs.append(
                    PhotoJob(
                        kind="artifact",
                        key=object_key_for_artifact_code(code, path.suffix),
                        path=path,
                        id_code=code,
                        note=f"{name} (no DB row; key uses accession)",
                    )
                )
            claimed.add(path.resolve())
            continue
        if upload_match:
            aid = int(upload_match.group(1))
            row = by_id.get(aid)
            if row:
                code = normalize_id_code(getattr(row, "id_code", "") or "")
                jobs.append(
                    PhotoJob(
                        kind="artifact",
                        key=object_key_for_artifact(aid, path.suffix),
                        path=path,
                        artifact_id=aid,
                        id_code=code,
                        note=name,
                    )
                )
                claimed.add(path.resolve())
                continue
        safe_name = re.sub(r"[^A-Za-z0-9._-]", "_", name)
        jobs.append(
            PhotoJob(
                kind="extra",
                key=f"artifacts/unlinked/{safe_name}",
                path=path,
                note="unlinked upload",
            )
        )
        claimed.add(path.resolve())

    slug_files: dict[str, Path] = {}
    for folder in PORTRAIT_DIRS:
        if not folder.is_dir():
            continue
        for path in sorted(folder.iterdir()):
            if not _is_image(path):
                continue
            slug = president_slug(path.stem)
            slug_files.setdefault(slug, path)

    presidents_by_slug = {president_slug(row.name): row for row in presidents}
    for slug, path in sorted(slug_files.items()):
        row = presidents_by_slug.get(slug)
        jobs.append(
            PhotoJob(
                kind="president",
                key=object_key_for_president(slug, path.suffix),
                path=path,
                president_id=int(row.id) if row else None,
                note=_rel_note(path),
            )
        )

    for row in presidents:
        slug = president_slug(row.name)
        if slug not in slug_files and not is_http_url(getattr(row, "photo_url", "") or ""):
            missing.append(f"president {row.id} {row.name}: no portrait file ({slug})")

    return jobs, missing


def _dedupe_jobs(jobs: list[PhotoJob]) -> list[PhotoJob]:
    by_key: dict[str, PhotoJob] = {}
    for job in jobs:
        previous = by_key.get(job.key)
        if previous is None:
            by_key[job.key] = job
            continue
        # Prefer a job that will update a DB row.
        if job.artifact_id or job.president_id:
            by_key[job.key] = job
    return list(by_key.values())


def _update_session_urls(session, job: PhotoJob, public_url: str) -> bool:
    changed = False
    if job.kind == "artifact":
        row = None
        if job.id_code:
            row = session.scalar(select(Artifact).where(Artifact.id_code == job.id_code))
        if row is None and job.artifact_id:
            row = session.get(Artifact, job.artifact_id)
        if row is not None and (row.image_url or "") != public_url:
            row.image_url = public_url
            changed = True
    elif job.kind == "president" and job.president_id:
        row = session.get(President, job.president_id)
        if row is None:
            row = session.scalar(
                select(President).where(President.id == job.president_id)
            )
        if row is not None and (row.photo_url or "") != public_url:
            row.photo_url = public_url
            changed = True
    return changed


def run(
    *,
    dry_run: bool,
    skip_existing: bool,
    storage: StorageSettings | None,
) -> UploadReport:
    report = UploadReport()
    extracted = _extract_tar_images()
    if extracted:
        report.notes.append(f"Prepared {extracted} local photo(s) from curator_photos.tar.gz")

    local_url = prepare_url(_local_db_url())
    artifacts: list[Artifact] = []
    presidents: list[President] = []
    local_session = None
    local_engine = None
    try:
        artifacts, presidents, local_session, local_engine = _open_rows(local_url)
    except Exception as exc:  # noqa: BLE001
        report.notes.append(f"Local DB unavailable ({exc}); uploading files found on disk only")

    jobs, missing = _jobs_from_disk(artifacts, presidents)
    jobs = _dedupe_jobs(jobs)
    report.missing = len(missing)
    report.missing_rows = missing

    remote_url = _remote_db_url()
    remote_session = None
    remote_engine = None
    if remote_url and not dry_run:
        try:
            remote_engine, remote_factory = open_sync_session(remote_url)
            remote_session = remote_factory()
        except Exception as exc:  # noqa: BLE001
            report.notes.append(f"Remote DB unavailable ({exc}); local URLs only")
            remote_session = None
    elif not remote_url:
        if not _local_db_url().lower().startswith("sqlite"):
            report.notes.append("DATABASE_URL is already remote Postgres; image_url / photo_url updates go there.")
        else:
            report.notes.append(
                "SYNC_REMOTE_DATABASE_URL unset - remote Postgres not updated. "
                "Run `python scripts/sync_catalog.py --push` after this upload, or set the URI."
            )

    if storage and not dry_run:
        try:
            ensure_public_bucket(storage)
        except StorageError as exc:
            report.failed += 1
            report.failures.append(f"bucket: {exc}")
            print(report.summary())
            return report

    for job in jobs:
        if not job.path.is_file():
            report.missing += 1
            report.missing_rows.append(f"{job.key}: file missing ({job.path})")
            continue
        size = job.path.stat().st_size
        if size > MAX_PHOTO_BYTES:
            report.failed += 1
            report.failures.append(f"{job.key}: exceeds 12MB ({job.path.name})")
            continue
        public_url = public_object_url(storage, job.key) if storage else f"<cloud>/{job.key}"
        if dry_run:
            print(f"DRY  {job.key}  <-  {job.path}  ({job.note})")
            report.skipped += 1
            continue
        assert storage is not None
        already = False
        if skip_existing and local_session is not None:
            if job.kind == "artifact" and job.artifact_id:
                row = local_session.get(Artifact, job.artifact_id)
                already = bool(row and (row.image_url or "") == public_url)
            elif job.kind == "president" and job.president_id:
                row = local_session.get(President, job.president_id)
                already = bool(row and (row.photo_url or "") == public_url)
        if already:
            report.skipped += 1
            print(f"SKIP {job.key} (DB already has cloud URL)")
            continue
        try:
            uploaded_url = upload_file(storage, job.path, job.key)
        except (StorageError, OSError) as exc:
            report.failed += 1
            report.failures.append(f"{job.key}: {exc}")
            print(f"FAIL {job.key}: {exc}", file=sys.stderr)
            continue
        report.uploaded += 1
        print(f"PUT  {job.key}")
        if local_session is not None and _update_session_urls(local_session, job, uploaded_url):
            report.db_local += 1
        if remote_session is not None and _update_session_urls(remote_session, job, uploaded_url):
            report.db_remote += 1

    if not dry_run and local_session is not None:
        local_session.commit()
    if not dry_run and remote_session is not None:
        remote_session.commit()

    for session, engine in ((local_session, local_engine), (remote_session, remote_engine)):
        if session is not None:
            session.close()
        if engine is not None:
            engine.dispose()

    return report


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Upload catalog/president photos to Supabase Storage and update image_url / photo_url"
    )
    parser.add_argument("--dry-run", action="store_true", help="List files and keys without uploading")
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        help="Skip objects whose DB row already stores the public URL for that key",
    )
    args = parser.parse_args()

    storage: StorageSettings | None = None
    try:
        storage = StorageSettings.from_env()
    except StorageError as exc:
        print(f"Supabase storage is misconfigured: {exc}", file=sys.stderr)
        return 2

    if not args.dry_run and storage is None:
        print(
            "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n"
            "Copy backend/.env.example to backend/.env and set:\n"
            "  SUPABASE_URL=https://<project-ref>.supabase.co\n"
            "  SUPABASE_SERVICE_ROLE_KEY=<Project Settings -> API -> service_role>\n"
            "  SUPABASE_STORAGE_BUCKET=catalog-photos\n"
            "Create a public bucket named catalog-photos (or let this script create it).\n"
            "Use --dry-run to list local files without credentials.",
            file=sys.stderr,
        )
        return 2

    if args.dry_run and storage is None:
        print("Dry-run: SUPABASE_* not set; listing local files only (no upload, no public URLs).")

    report = run(dry_run=args.dry_run, skip_existing=args.skip_existing, storage=storage)
    print(report.summary())
    for note in report.notes:
        print(f"note: {note}")
    if report.missing_rows:
        print(f"missing ({len(report.missing_rows)}):")
        for line in report.missing_rows[:40]:
            print(f"  {line}")
        if len(report.missing_rows) > 40:
            print(f"  … {len(report.missing_rows) - 40} more")
    if report.failures:
        print("failures:")
        for line in report.failures:
            print(f"  {line}")
    return 1 if report.failed else 0


if __name__ == "__main__":
    sys.exit(main())
