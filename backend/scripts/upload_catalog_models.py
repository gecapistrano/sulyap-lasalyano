"""
Upload local 3D GLB models to Supabase Storage and point artifacts.model_url at public objects.

Visitor Live Scan must not use this path: 20MB Storage GLBs burn Cached Egress.
Compress laptop copies (`npm run models:compress`) and publish to R2/Pages instead.

Does not store binaries in Postgres. Uses SUPABASE_SERVICE_ROLE_KEY locally.

Usage (from backend/):
  python scripts/upload_catalog_models.py --dry-run
  python scripts/upload_catalog_models.py
  python scripts/upload_catalog_models.py --skip-existing
  python scripts/upload_catalog_models.py --from-dir "D:\\STORAGE\\Downloads\\Andrew Gonzales (AG)"
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
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

from app.models import Artifact  # noqa: E402
from app.services.catalog_sync import open_sync_session, prepare_url  # noqa: E402
from app.services.id_codes import accession_codes_from_filename, normalize_id_code  # noqa: E402
from app.services.media_urls import is_http_url  # noqa: E402
from app.services.model_uploads import UPLOADS_ROOT, ensure_upload_dir  # noqa: E402
from app.services.object_storage import (  # noqa: E402
    StorageError,
    StorageSettings,
    ensure_public_bucket,
    object_key_for_model,
    public_object_url,
    upload_file,
)

_MANAGED_GLB_RE = re.compile(r"^\d+_[0-9a-f]{16}\.glb$", re.I)


IMPORT_MAX_MODEL_BYTES = 80 * 1024 * 1024


@dataclass
class ModelJob:
    key: str
    path: Path
    artifact_ids: list[int] = field(default_factory=list)
    note: str = ""


@dataclass
class UploadReport:
    uploaded: int = 0
    skipped: int = 0
    missing: int = 0
    failed: int = 0
    db_primary: int = 0
    db_remote: int = 0
    notes: list[str] = field(default_factory=list)
    failures: list[str] = field(default_factory=list)
    missing_rows: list[str] = field(default_factory=list)

    def summary(self) -> str:
        return (
            f"uploaded={self.uploaded} skipped={self.skipped} missing={self.missing} "
            f"failed={self.failed} db_primary={self.db_primary} db_remote={self.db_remote}"
        )


def _primary_db_url() -> str:
    return (os.environ.get("DATABASE_URL") or "sqlite:///./sulyap.db").strip()


def _remote_db_url() -> str:
    return (os.environ.get("SYNC_REMOTE_DATABASE_URL") or "").strip()


def _open_artifacts(database_url: str) -> tuple[list[Artifact], object, object]:
    engine, factory = open_sync_session(database_url)
    session = factory()
    artifacts = list(session.scalars(select(Artifact).order_by(Artifact.id.asc())).all())
    return artifacts, session, engine


def _jobs_from_disk(artifacts: list[Artifact]) -> tuple[list[ModelJob], list[str]]:
    jobs: list[ModelJob] = []
    missing: list[str] = []
    claimed: set[Path] = set()
    by_id = {int(row.id): row for row in artifacts}
    ensure_upload_dir()

    for row in artifacts:
        stored = (getattr(row, "model_url", "") or "").strip()
        if not stored or is_http_url(stored):
            continue
        name = stored.replace("\\", "/").rsplit("/", 1)[-1]
        path = UPLOADS_ROOT / name
        if path.is_file() and path.suffix.lower() == ".glb":
            jobs.append(
                ModelJob(
                    key=object_key_for_model(path.name),
                    path=path,
                    artifact_ids=[int(row.id)],
                    note=path.name,
                )
            )
            claimed.add(path.resolve())
        elif stored.startswith("/media/models/"):
            missing.append(f"artifact {row.id}: {stored}")

    for path in sorted(UPLOADS_ROOT.iterdir() if UPLOADS_ROOT.is_dir() else []):
        if not path.is_file() or path.suffix.lower() != ".glb":
            continue
        if path.resolve() in claimed:
            continue
        artifact_id = None
        match = _MANAGED_GLB_RE.fullmatch(path.name)
        if match:
            aid = int(path.name.split("_", 1)[0])
            if aid in by_id:
                artifact_id = aid
        jobs.append(
            ModelJob(
                key=object_key_for_model(path.name),
                path=path,
                artifact_ids=[artifact_id] if artifact_id else [],
                note=path.name if artifact_id else f"{path.name} (unlinked)",
            )
        )
        claimed.add(path.resolve())

    return jobs, missing


def _jobs_from_dir(folder: Path, artifacts: list[Artifact]) -> tuple[list[ModelJob], list[str]]:
    jobs: list[ModelJob] = []
    missing: list[str] = []
    if not folder.is_dir():
        missing.append(f"folder missing: {folder}")
        return jobs, missing
    by_code: dict[str, Artifact] = {}
    for row in artifacts:
        code = normalize_id_code(getattr(row, "id_code", "") or "")
        if code:
            by_code[code] = row
    for path in sorted(folder.glob("*.glb")):
        if not path.is_file():
            continue
        codes = accession_codes_from_filename(path.name)
        ids = [int(by_code[code].id) for code in codes if code in by_code]
        miss = [code for code in codes if code not in by_code]
        key_name = path.name
        if len(codes) == 1:
            key_name = f"{codes[0]}.glb"
        note = path.name
        if ids:
            linked = ",".join(str(i) for i in ids)
            note = f"{path.name} -> artifact_id {linked}"
        elif codes:
            note = f"{path.name} (no catalog row for {', '.join(codes)})"
        else:
            note = f"{path.name} (unlinked)"
        for code in miss:
            missing.append(f"{path.name}: no artifact with id_code {code}")
        jobs.append(
            ModelJob(
                key=object_key_for_model(key_name),
                path=path,
                artifact_ids=ids,
                note=note,
            )
        )
    return jobs, missing


def _update_session_urls(session, job: ModelJob, public_url: str) -> bool:
    changed = False
    for artifact_id in job.artifact_ids:
        row = session.get(Artifact, artifact_id)
        if row is None:
            continue
        if (row.model_url or "") == public_url:
            continue
        row.model_url = public_url
        changed = True
    return changed


def run(
    *,
    dry_run: bool,
    skip_existing: bool,
    storage: StorageSettings | None,
    extra_dirs: list[Path] | None = None,
    max_bytes: int = IMPORT_MAX_MODEL_BYTES,
) -> UploadReport:
    report = UploadReport()
    primary_url = prepare_url(_primary_db_url())
    artifacts: list[Artifact] = []
    primary_session = None
    primary_engine = None
    try:
        artifacts, primary_session, primary_engine = _open_artifacts(primary_url)
    except Exception as exc:  # noqa: BLE001
        report.notes.append(f"Primary DB unavailable ({exc}); uploading files found on disk only")

    if extra_dirs:
        jobs = []
        missing = []
        for folder in extra_dirs:
            extra_jobs, extra_missing = _jobs_from_dir(folder, artifacts)
            jobs.extend(extra_jobs)
            missing.extend(extra_missing)
    else:
        jobs, missing = _jobs_from_disk(artifacts)
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
            report.notes.append(f"Remote DB unavailable ({exc}); primary URLs only")
            remote_session = None
    elif not remote_url:
        if not _primary_db_url().lower().startswith("sqlite"):
            report.notes.append("DATABASE_URL is already remote Postgres; model_url updates go there.")
        else:
            report.notes.append(
                "SYNC_REMOTE_DATABASE_URL unset — remote Postgres not updated. "
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

    by_key: dict[str, ModelJob] = {}
    for job in jobs:
        prev = by_key.get(job.key)
        if prev is None or (job.artifact_ids and not prev.artifact_ids):
            by_key[job.key] = job

    for job in by_key.values():
        if not job.path.is_file():
            report.missing += 1
            report.missing_rows.append(f"{job.key}: file missing ({job.path})")
            continue
        size = job.path.stat().st_size
        if size > max_bytes:
            report.failed += 1
            report.failures.append(
                f"{job.key}: exceeds {max_bytes // (1024 * 1024)}MB ({job.path.name})"
            )
            continue
        public_url = public_object_url(storage, job.key) if storage else f"<cloud>/{job.key}"
        if dry_run:
            print(f"DRY  {job.key}  <-  {job.path}  ({job.note})")
            report.skipped += 1
            continue
        assert storage is not None
        already = False
        if skip_existing and primary_session is not None and job.artifact_ids:
            row = primary_session.get(Artifact, job.artifact_ids[0])
            already = bool(row and (row.model_url or "") == public_url)
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
        if primary_session is not None and _update_session_urls(primary_session, job, uploaded_url):
            report.db_primary += 1
        if remote_session is not None and _update_session_urls(remote_session, job, uploaded_url):
            report.db_remote += 1

    if not dry_run and primary_session is not None:
        primary_session.commit()
    if not dry_run and remote_session is not None:
        remote_session.commit()

    for session, engine in ((primary_session, primary_engine), (remote_session, remote_engine)):
        if session is not None:
            session.close()
        if engine is not None:
            engine.dispose()

    return report


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Upload catalog 3D models to Supabase Storage and update model_url"
    )
    parser.add_argument("--dry-run", action="store_true", help="List files and keys without uploading")
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        help="Skip objects whose DB row already stores the public URL for that key",
    )
    parser.add_argument(
        "--from-dir",
        action="append",
        default=[],
        metavar="DIR",
        help="Folder of accession-named GLBs (AG001.glb). Repeatable.",
    )
    parser.add_argument(
        "--max-mb",
        type=int,
        default=IMPORT_MAX_MODEL_BYTES // (1024 * 1024),
        help="Skip files larger than this many megabytes (default 80)",
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
            "Use --dry-run to list local GLB files without credentials.",
            file=sys.stderr,
        )
        return 2

    if args.dry_run and storage is None:
        print("Dry-run: SUPABASE_* not set; listing local GLB files only (no upload, no public URLs).")

    extra_dirs = [Path(item) for item in args.from_dir]
    report = run(
        dry_run=args.dry_run,
        skip_existing=args.skip_existing,
        storage=storage,
        extra_dirs=extra_dirs,
        max_bytes=max(1, int(args.max_mb)) * 1024 * 1024,
    )
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
