"""Store curator-uploaded GLB models under backend/uploads/models (served at /media/models)."""
from __future__ import annotations

import re
from pathlib import Path
from secrets import token_hex

from fastapi import HTTPException, UploadFile, status

MAX_MODEL_BYTES = 40 * 1024 * 1024
ALLOWED_SUFFIXES = {".glb"}
GLB_MAGIC = b"glTF"

UPLOADS_ROOT = Path(__file__).resolve().parents[2] / "uploads" / "models"
MEDIA_URL_PREFIX = "/media/models"


def ensure_upload_dir() -> Path:
    UPLOADS_ROOT.mkdir(parents=True, exist_ok=True)
    return UPLOADS_ROOT


def _safe_suffix(filename: str | None) -> str:
    name = (filename or "").strip().lower()
    suffix = Path(name).suffix
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .glb (glTF binary) files are allowed",
        )
    return suffix


async def save_artifact_model(artifact_id: int, upload: UploadFile) -> str:
    """Validate and persist a GLB; returns public media path `/media/models/...`."""
    suffix = _safe_suffix(upload.filename)
    ensure_upload_dir()
    dest_name = f"{int(artifact_id)}_{token_hex(8)}{suffix}"
    if not re.fullmatch(r"\d+_[0-9a-f]{16}\.glb", dest_name):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid upload name")

    dest = UPLOADS_ROOT / dest_name
    size = 0
    header = b""
    try:
        with dest.open("wb") as out:
            while True:
                chunk = await upload.read(1024 * 1024)
                if not chunk:
                    break
                if size == 0:
                    header = chunk[:4]
                size += len(chunk)
                if size > MAX_MODEL_BYTES:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="Model file exceeds 40MB limit",
                    )
                out.write(chunk)
    except HTTPException:
        if dest.exists():
            dest.unlink(missing_ok=True)
        raise
    except Exception as exc:  # noqa: BLE001
        if dest.exists():
            dest.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to store model file",
        ) from exc
    finally:
        await upload.close()

    if size < 12 or header != GLB_MAGIC:
        dest.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is not a valid GLB model",
        )

    return f"{MEDIA_URL_PREFIX}/{dest_name}"


def delete_local_model_if_managed(model_url: str | None) -> None:
    """Remove a previously uploaded file when it lives under our media prefix."""
    if not model_url or not model_url.startswith(f"{MEDIA_URL_PREFIX}/"):
        return
    name = model_url.rsplit("/", 1)[-1]
    if not re.fullmatch(r"\d+_[0-9a-f]{16}\.glb", name):
        return
    path = UPLOADS_ROOT / name
    if path.is_file():
        path.unlink(missing_ok=True)
