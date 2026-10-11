"""Store curator-uploaded 3D models as GLB under backend/uploads/models (served at /media/models)."""
from __future__ import annotations

import re
import tempfile
from pathlib import Path
from secrets import token_hex

from fastapi import HTTPException, UploadFile, status

MAX_MODEL_BYTES = 40 * 1024 * 1024
ALLOWED_SUFFIXES = {".glb", ".obj"}
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
            detail="Only .glb or .obj 3D files are allowed",
        )
    return suffix


def _convert_obj_to_glb(obj_path: Path, glb_path: Path) -> None:
    try:
        import trimesh  # type: ignore
    except ImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OBJ conversion requires trimesh on the server; upload a .glb instead",
        ) from exc
    try:
        loaded = trimesh.load(str(obj_path), force="scene")
        if isinstance(loaded, trimesh.Scene):
            scene = loaded
        else:
            scene = trimesh.Scene(loaded)
        glb_bytes = scene.export(file_type="glb")
        if not glb_bytes or glb_bytes[:4] != GLB_MAGIC:
            raise ValueError("export failed")
        glb_path.write_bytes(glb_bytes)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to convert OBJ to GLB",
        ) from exc


async def save_artifact_model(artifact_id: int, upload: UploadFile) -> str:
    """Validate upload; convert OBJ→GLB when needed; returns `/media/models/...`."""
    suffix = _safe_suffix(upload.filename)
    ensure_upload_dir()
    dest_name = f"{int(artifact_id)}_{token_hex(8)}.glb"
    if not re.fullmatch(r"\d+_[0-9a-f]{16}\.glb", dest_name):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid upload name")

    dest = UPLOADS_ROOT / dest_name
    size = 0
    header = b""
    tmp_obj: Path | None = None
    try:
        if suffix == ".obj":
            with tempfile.NamedTemporaryFile(delete=False, suffix=".obj") as tmp:
                tmp_obj = Path(tmp.name)
                while True:
                    chunk = await upload.read(1024 * 1024)
                    if not chunk:
                        break
                    size += len(chunk)
                    if size > MAX_MODEL_BYTES:
                        raise HTTPException(
                            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            detail="Model file exceeds 40MB limit",
                        )
                    tmp.write(chunk)
            _convert_obj_to_glb(tmp_obj, dest)
        else:
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
            if size < 12 or header != GLB_MAGIC:
                dest.unlink(missing_ok=True)
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="File is not a valid GLB model",
                )
    except HTTPException:
        dest.unlink(missing_ok=True)
        raise
    except Exception as exc:  # noqa: BLE001
        dest.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to store model file",
        ) from exc
    finally:
        await upload.close()
        if tmp_obj and tmp_obj.exists():
            tmp_obj.unlink(missing_ok=True)

    return f"{MEDIA_URL_PREFIX}/{dest_name}"


def delete_local_model_if_managed(model_url: str | None) -> None:
    if not model_url or not model_url.startswith(f"{MEDIA_URL_PREFIX}/"):
        return
    name = model_url.rsplit("/", 1)[-1]
    if not re.fullmatch(r"\d+_[0-9a-f]{16}\.glb", name):
        return
    path = UPLOADS_ROOT / name
    if path.is_file():
        path.unlink(missing_ok=True)
