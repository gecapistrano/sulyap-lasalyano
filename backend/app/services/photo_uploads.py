"""Curator-only artifact photo storage (not publicly mounted)."""
from __future__ import annotations

import logging
import re
import tarfile
from pathlib import Path
from secrets import token_hex

from fastapi import HTTPException, UploadFile, status
from fastapi.responses import FileResponse, RedirectResponse

from .id_codes import normalize_id_code
from .media_urls import is_http_url
from .object_storage import StorageError, StorageSettings, object_key_for_artifact, upload_file

MAX_PHOTO_BYTES = 12 * 1024 * 1024
ALLOWED_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}
_BACKEND_ROOT = Path(__file__).resolve().parents[2]
PHOTOS_ROOT = _BACKEND_ROOT / "uploads" / "artifacts"
# Seed pack checked into the repo so Render redeploys restore curator photos
# (ephemeral disk otherwise loses uploads/). See docs/DEPLOYMENT.md.
BUNDLED_PHOTOS_ARCHIVE = _BACKEND_ROOT / "data" / "curator_photos.tar.gz"

logger = logging.getLogger("sulyap.photos")


def ensure_photo_dir() -> Path:
    PHOTOS_ROOT.mkdir(parents=True, exist_ok=True)
    return PHOTOS_ROOT


_UPLOAD_PHOTO_RE = re.compile(r"^\d+_[0-9a-f]{16}\.(jpg|jpeg|png|webp)$", re.I)
# Workbook import exports: import_RD244.png / import_AB005.jpg
_IMPORT_PHOTO_RE = re.compile(r"^import_[A-Z0-9]{2,32}\.(jpg|jpeg|png|webp)$", re.I)
_SAFE_LOCAL_PHOTO_RE = re.compile(r"^(?:import_)?[A-Za-z0-9._-]{1,64}\.(jpg|jpeg|png|webp)$", re.I)
_PHOTO_EXTS = (".png", ".jpg", ".jpeg", ".webp")


def _is_allowed_photo_name(name: str) -> bool:
    return bool(_UPLOAD_PHOTO_RE.fullmatch(name) or _IMPORT_PHOTO_RE.fullmatch(name))


def _file_under(root: Path, name: str) -> Path | None:
    if not name or ".." in name or "/" in name or "\\" in name:
        return None
    try:
        root_resolved = root.resolve()
    except OSError:
        return None
    path = (root_resolved / name).resolve()
    try:
        path.relative_to(root_resolved)
    except ValueError:
        return None
    if path.is_file():
        return path
    return None


def restore_bundled_photos() -> int:
    """Extract missing curator photos from the repo seed archive into PHOTOS_ROOT.

    Safe to call on every startup: existing files are left untouched; only
    allowlisted basenames are written (no path traversal).
    """
    ensure_photo_dir()
    if not BUNDLED_PHOTOS_ARCHIVE.is_file():
        logger.info("No bundled photo archive at %s", BUNDLED_PHOTOS_ARCHIVE)
        return 0
    restored = 0
    try:
        with tarfile.open(BUNDLED_PHOTOS_ARCHIVE, "r:gz") as tar:
            for member in tar.getmembers():
                if not member.isfile():
                    continue
                name = Path(member.name).name
                if not _is_allowed_photo_name(name):
                    continue
                dest = PHOTOS_ROOT / name
                if dest.is_file():
                    continue
                extracted = tar.extractfile(member)
                if extracted is None:
                    continue
                with extracted, dest.open("wb") as out:
                    out.write(extracted.read())
                restored += 1
    except (OSError, tarfile.TarError) as exc:
        logger.warning("Failed to restore bundled curator photos: %s", exc)
        return restored
    if restored:
        logger.info("Restored %s curator photos from seed archive", restored)
    return restored


def photo_path_for_media_key(media_key: str) -> Path | None:
    """Resolve curator photo path from `/curator-media/artifacts/<file>` keys."""
    name = (media_key or "").strip().replace("\\", "/")
    if is_http_url(name):
        return None
    if name.startswith("/curator-media/artifacts/"):
        name = name.split("/")[-1]
    elif "/" in name:
        name = name.split("/")[-1]
    if not name or ".." in name:
        return None
    if not _is_allowed_photo_name(name):
        return None
    path = PHOTOS_ROOT / name
    if not path.is_file():
        return None
    return path


async def save_artifact_photo(artifact_id: int, upload: UploadFile) -> str:
    suffix = Path((upload.filename or "").strip().lower()).suffix
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only jpg/png/webp photos allowed")
    ensure_photo_dir()
    dest_name = f"{int(artifact_id)}_{token_hex(8)}{suffix}"
    dest = PHOTOS_ROOT / dest_name
    size = 0
    try:
        with dest.open("wb") as out:
            while True:
                chunk = await upload.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_PHOTO_BYTES:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="Photo exceeds 12MB limit",
                    )
                out.write(chunk)
    except HTTPException:
        dest.unlink(missing_ok=True)
        raise
    except Exception as exc:  # noqa: BLE001
        dest.unlink(missing_ok=True)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unable to store photo") from exc
    finally:
        await upload.close()
    local_path = f"/curator-media/artifacts/{dest_name}"
    try:
        cloud = StorageSettings.resolve()
    except StorageError as exc:
        dest.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Cloud photo storage is misconfigured",
        ) from exc
    if not cloud:
        return local_path
    try:
        key = object_key_for_artifact(int(artifact_id), suffix)
        return upload_file(cloud, dest, key)
    except (StorageError, OSError, ValueError) as exc:
        dest.unlink(missing_ok=True)
        logger.warning("Cloud photo upload failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to store photo in cloud storage",
        ) from exc


def delete_local_photo_if_managed(image_url: str) -> None:
    path = photo_path_for_media_key(image_url)
    if path and path.is_file():
        path.unlink(missing_ok=True)


def find_local_photo(
    image_url: str = "",
    *,
    id_code: str = "",
    artifact_id: int | None = None,
) -> Path | None:
    """Locate a laptop copy under ``uploads/artifacts`` (import_CODE.png, CODE.jpg, …)."""
    managed = photo_path_for_media_key(image_url)
    if managed:
        return managed
    names: list[str] = []
    raw = (image_url or "").strip().replace("\\", "/").split("?", 1)[0]
    if raw:
        names.append(Path(raw).name)
    code = normalize_id_code(id_code)
    if code:
        for ext in _PHOTO_EXTS:
            names.append(f"import_{code}{ext}")
            names.append(f"{code}{ext}")
    if artifact_id is not None:
        try:
            aid = int(artifact_id)
        except (TypeError, ValueError):
            aid = 0
        if aid > 0:
            for ext in _PHOTO_EXTS:
                names.append(f"{aid}{ext}")
    seen: set[str] = set()
    for name in names:
        if not name or name in seen:
            continue
        seen.add(name)
        if not _SAFE_LOCAL_PHOTO_RE.fullmatch(name):
            continue
        found = _file_under(PHOTOS_ROOT, name)
        if found:
            return found
    return None


def photo_file_or_redirect(
    image_url: str,
    *,
    id_code: str = "",
    artifact_id: int | None = None,
    prefer_local: bool = False,
):
    """Serve a local photo when preferred, else redirect to a stored http(s) URL."""
    if prefer_local:
        local = find_local_photo(image_url, id_code=id_code, artifact_id=artifact_id)
        if local:
            return FileResponse(local)
    stored = (image_url or "").strip()
    if is_http_url(stored):
        return RedirectResponse(url=stored, status_code=307)
    path = photo_path_for_media_key(stored)
    if not path:
        return None
    return FileResponse(path)
