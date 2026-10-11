"""Curator-only artifact photo storage (not publicly mounted)."""
from __future__ import annotations

import re
from pathlib import Path
from secrets import token_hex

from fastapi import HTTPException, UploadFile, status

MAX_PHOTO_BYTES = 12 * 1024 * 1024
ALLOWED_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}
PHOTOS_ROOT = Path(__file__).resolve().parents[2] / "uploads" / "artifacts"


def ensure_photo_dir() -> Path:
    PHOTOS_ROOT.mkdir(parents=True, exist_ok=True)
    return PHOTOS_ROOT


_UPLOAD_PHOTO_RE = re.compile(r"^\d+_[0-9a-f]{16}\.(jpg|jpeg|png|webp)$", re.I)
# Workbook import exports: import_RD244.png / import_AB005.jpg
_IMPORT_PHOTO_RE = re.compile(r"^import_[A-Z0-9]{2,32}\.(jpg|jpeg|png|webp)$", re.I)


def photo_path_for_media_key(media_key: str) -> Path | None:
    """Resolve curator photo path from `/curator-media/artifacts/<file>` keys."""
    name = (media_key or "").strip().replace("\\", "/")
    if name.startswith("/curator-media/artifacts/"):
        name = name.split("/")[-1]
    elif "/" in name:
        name = name.split("/")[-1]
    if not name or ".." in name:
        return None
    if not (_UPLOAD_PHOTO_RE.fullmatch(name) or _IMPORT_PHOTO_RE.fullmatch(name)):
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
    return f"/curator-media/artifacts/{dest_name}"


def delete_local_photo_if_managed(image_url: str) -> None:
    path = photo_path_for_media_key(image_url)
    if path and path.is_file():
        path.unlink(missing_ok=True)
