"""Store curator-uploaded 3D models as GLB under backend/uploads/models (served at /media/models)."""
from __future__ import annotations

import logging
import re
import tempfile
from pathlib import Path
from secrets import token_hex

from fastapi import HTTPException, UploadFile, status
from fastapi.responses import FileResponse, RedirectResponse

from .id_codes import normalize_id_code
from .media_urls import is_http_url
from .object_storage import StorageError, StorageSettings, object_key_for_model, upload_file

MAX_MODEL_BYTES = 40 * 1024 * 1024
ALLOWED_SUFFIXES = {".glb", ".obj"}
GLB_MAGIC = b"glTF"

UPLOADS_ROOT = Path(__file__).resolve().parents[2] / "uploads" / "models"
MEDIA_URL_PREFIX = "/media/models"
_MANAGED_GLB_RE = re.compile(r"^\d+_[0-9a-f]{16}\.glb$", re.I)
_SAFE_LOCAL_GLB_RE = re.compile(r"^[A-Za-z0-9._-]{1,64}\.glb$", re.I)
logger = logging.getLogger("sulyap.models")


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
    if not _MANAGED_GLB_RE.fullmatch(dest_name):
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

    local_path = f"{MEDIA_URL_PREFIX}/{dest_name}"
    try:
        cloud = StorageSettings.resolve()
    except StorageError as exc:
        dest.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Cloud model storage is misconfigured",
        ) from exc
    if not cloud:
        return local_path
    try:
        key = object_key_for_model(dest_name)
        return upload_file(cloud, dest, key)
    except (StorageError, OSError, ValueError) as exc:
        dest.unlink(missing_ok=True)
        logger.warning("Cloud model upload failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to store model in cloud storage",
        ) from exc


def local_model_media_url(stored: str = "", id_code: str = "") -> str:
    """Return ``/media/models/<file>.glb`` when a local copy exists, else ``""``.

    Matches the stored URL basename (``AG013.glb`` or a managed upload name) and
    ``{id_code}.glb``. Used only when catalog prefers local media.
    """
    names: list[str] = []
    raw = (stored or "").strip().replace("\\", "/").split("?", 1)[0]
    if raw:
        names.append(Path(raw).name)
    code = normalize_id_code(id_code)
    if code:
        names.append(f"{code}.glb")
    seen: set[str] = set()
    for name in names:
        if not name or name in seen:
            continue
        seen.add(name)
        if not _SAFE_LOCAL_GLB_RE.fullmatch(name):
            continue
        path = _file_under(UPLOADS_ROOT, name)
        if path:
            return f"{MEDIA_URL_PREFIX}/{path.name}"
    return ""


def model_path_for_media_key(media_key: str) -> Path | None:
    name = (media_key or "").strip().replace("\\", "/")
    if is_http_url(name):
        return None
    if name.startswith(f"{MEDIA_URL_PREFIX}/"):
        name = name.rsplit("/", 1)[-1]
    elif "/" in name:
        name = name.rsplit("/", 1)[-1]
    if not name or ".." in name or not _MANAGED_GLB_RE.fullmatch(name):
        return None
    path = UPLOADS_ROOT / name
    if not path.is_file():
        return None
    return path


def delete_local_model_if_managed(model_url: str | None) -> None:
    path = model_path_for_media_key(model_url or "")
    if path and path.is_file():
        path.unlink(missing_ok=True)


def model_file_or_redirect(model_url: str):
    stored = (model_url or "").strip()
    if is_http_url(stored):
        return RedirectResponse(url=stored, status_code=307)
    path = model_path_for_media_key(stored)
    if not path:
        return None
    return FileResponse(path)
