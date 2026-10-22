"""Upload catalog photos to Supabase Storage (object keys + public URLs).

Binaries stay in the Storage bucket, never as BYTEA. Credentials come from env only.
"""
from __future__ import annotations

import json
import logging
import os
import re
import unicodedata
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

logger = logging.getLogger("sulyap.storage")

DEFAULT_BUCKET = "catalog-photos"
# Catalog GLBs can be 40–80MB; keep the bucket cap above the import script.
DEFAULT_FILE_SIZE_LIMIT = 100 * 1024 * 1024
ALLOWED_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}
MODEL_SUFFIXES = {".glb"}
_ID_CODE_RE = re.compile(r"^[A-Z0-9]{2,32}$")
_SAFE_KEY_RE = re.compile(r"^[a-zA-Z0-9/_.-]+$")
_SAFE_MODEL_NAME_RE = re.compile(r"^[A-Za-z0-9._-]+\.glb$")

# Static-site filenames in hall/assets/presidents/.
PRESIDENT_NAME_SLUGS: tuple[tuple[str, str], ...] = (
    ("donato", "br-donato"),
    ("boquer", "br-gus"),
    ("gonzalez", "br-andrew"),
    ("dizon", "br-rolly"),
    ("mawel", "br-mawel"),
    ("luistro", "br-armin"),
    ("quebengco", "dr-quebengco"),
    ("buenaventura", "br-mawel"),
    ("sockie", "br-sockie"),
    ("dela rosa", "br-sockie"),
    ("iñigo", "br-inigo"),
    ("inigo", "br-inigo"),
    ("riola", "br-inigo"),
    ("rolly", "br-rolly"),
    ("andrew", "br-andrew"),
    ("armin", "br-armin"),
    ("gus", "br-gus"),
)

CONTENT_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".glb": "model/gltf-binary",
}
# Seconds. Uploaded as cacheControl so CDN/browsers keep public catalog media.
PUBLIC_CACHE_CONTROL = "31536000"


class StorageError(RuntimeError):
    """Upload or bucket API failure (never includes the service role key)."""


@dataclass(frozen=True)
class StorageSettings:
    url: str
    service_role_key: str
    bucket: str = DEFAULT_BUCKET

    @classmethod
    def from_env(cls) -> StorageSettings | None:
        url = (os.environ.get("SUPABASE_URL") or "").strip().rstrip("/")
        key = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
        bucket = (os.environ.get("SUPABASE_STORAGE_BUCKET") or DEFAULT_BUCKET).strip() or DEFAULT_BUCKET
        return cls._validated(url, key, bucket)

    @classmethod
    def resolve(cls) -> StorageSettings | None:
        """Env first (scripts after dotenv), then FastAPI Settings (env_file)."""
        found = cls.from_env()
        if found:
            return found
        from ..core.config import get_settings

        settings = get_settings()
        url = (settings.supabase_url or "").strip().rstrip("/")
        key = (settings.supabase_service_role_key or "").strip()
        bucket = (settings.supabase_storage_bucket or DEFAULT_BUCKET).strip() or DEFAULT_BUCKET
        return cls._validated(url, key, bucket)

    @classmethod
    def _validated(cls, url: str, key: str, bucket: str) -> StorageSettings | None:
        if not url or not key:
            return None
        parsed = urlparse(url)
        host = (parsed.netloc or "").lower()
        if parsed.scheme != "https" or not host or parsed.path not in ("", "/"):
            raise StorageError(
                "SUPABASE_URL must be an https:// origin with no path "
                "(https://<project-ref>.supabase.co, not the dashboard URL)"
            )
        if "supabase.com" in host and not host.endswith(".supabase.co"):
            raise StorageError(
                "SUPABASE_URL must be https://<project-ref>.supabase.co, not the dashboard URL"
            )
        return cls(url=f"https://{parsed.netloc}", service_role_key=key, bucket=bucket)


def normalize_suffix(suffix: str) -> str:
    text = (suffix or "").strip().lower()
    if not text:
        return ".jpg"
    if not text.startswith("."):
        text = f".{text}"
    if text == ".jpeg":
        return ".jpg"
    if text in MODEL_SUFFIXES:
        return text
    if text not in ALLOWED_SUFFIXES and text != ".jpg":
        return ".jpg"
    return text


def content_type_for_suffix(suffix: str) -> str:
    return CONTENT_TYPES.get(normalize_suffix(suffix), "application/octet-stream")


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value or "")
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-")
    return slug or "unknown"


def president_slug(name_or_stem: str) -> str:
    """Map a president display name or portrait filename stem to assets/presidents/<slug>."""
    raw = (name_or_stem or "").strip()
    if not raw:
        return "unknown"
    suffix = Path(raw).suffix.lower()
    if suffix in ALLOWED_SUFFIXES:
        raw = raw[: -len(suffix)]
    lowered = raw.lower()
    for needle, slug in PRESIDENT_NAME_SLUGS:
        if needle in lowered:
            return slug
    return slugify(raw)


def object_key_for_artifact(artifact_id: int, suffix: str = ".jpg") -> str:
    aid = int(artifact_id)
    if aid <= 0:
        raise ValueError("artifact_id must be a positive integer")
    return f"artifacts/{aid}{normalize_suffix(suffix)}"


def object_key_for_artifact_code(id_code: str, suffix: str = ".jpg") -> str:
    code = re.sub(r"[^A-Z0-9]", "", (id_code or "").upper())
    if not _ID_CODE_RE.fullmatch(code):
        raise ValueError("id_code is not a stable catalog accession")
    return f"artifacts/{code}{normalize_suffix(suffix)}"


def object_key_for_president(name_or_slug: str, suffix: str = ".jpg") -> str:
    slug = president_slug(name_or_slug)
    if slug == "unknown":
        raise ValueError("president slug is empty")
    return f"presidents/{slug}{normalize_suffix(suffix)}"


def object_key_for_model(filename: str) -> str:
    """Stable Storage key for a GLB under models/{filename}."""
    raw = (filename or "").strip().replace("\\", "/")
    if not raw or ".." in raw:
        raise ValueError("model filename is empty")
    name = Path(raw).name.strip()
    if not name:
        raise ValueError("model filename is empty")
    if not name.lower().endswith(".glb"):
        raise ValueError("only .glb models can be stored")
    safe = re.sub(r"[^A-Za-z0-9._-]", "_", name)
    if safe.lower().endswith(".glb") and not safe.endswith(".glb"):
        safe = safe[:-4] + ".glb"
    if not _SAFE_MODEL_NAME_RE.fullmatch(safe):
        raise ValueError("refusing unsafe model filename")
    return f"models/{safe}"


def object_key_for_model_id(artifact_id: int, filename: str | None = None) -> str:
    aid = int(artifact_id)
    if aid <= 0:
        raise ValueError("artifact_id must be a positive integer")
    if filename:
        name = Path(filename).name
        if name.lower().endswith(".glb") and re.fullmatch(r"\d+_[0-9a-f]{16}\.glb", name, re.I):
            return object_key_for_model(name)
    return f"models/{aid}.glb"


def public_object_url(settings: StorageSettings, key: str) -> str:
    if not _SAFE_KEY_RE.fullmatch(key) or ".." in key:
        raise ValueError("refusing unsafe object key")
    return f"{settings.url}/storage/v1/object/public/{settings.bucket}/{key}"


def _auth_headers(settings: StorageSettings, content_type: str | None = None) -> dict[str, str]:
    headers = {
        "Authorization": f"Bearer {settings.service_role_key}",
        "apikey": settings.service_role_key,
    }
    if content_type:
        headers["Content-Type"] = content_type
    return headers


def _storage_request(
    method: str,
    url: str,
    *,
    headers: dict[str, str],
    data: bytes | None = None,
    timeout: int = 180,
) -> tuple[int, bytes]:
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return int(resp.status), resp.read()
    except urllib.error.HTTPError as exc:
        body = b""
        try:
            body = exc.read() or b""
        except OSError:
            body = b""
        snippet = body.decode("utf-8", errors="replace")[:240]
        raise StorageError(f"Storage {method} {exc.code}: {snippet}") from exc
    except urllib.error.URLError as exc:
        raise StorageError("Storage request failed") from exc


def ensure_public_bucket(
    settings: StorageSettings,
    *,
    file_size_limit: int = DEFAULT_FILE_SIZE_LIMIT,
) -> None:
    """Create the bucket as public if it does not exist. Idempotent.

    Raises ``file_size_limit`` when the current cap is lower so catalog GLBs
    (up to ~80MB) are not rejected with EntityTooLarge.
    """
    list_url = f"{settings.url}/storage/v1/bucket/{settings.bucket}"
    headers = _auth_headers(settings, "application/json")
    try:
        _, body = _storage_request("GET", list_url, headers=_auth_headers(settings))
        info = json.loads(body.decode("utf-8") or "{}")
        current = info.get("file_size_limit")
        try:
            current_n = int(current) if current is not None else 0
        except (TypeError, ValueError):
            current_n = 0
        if current_n < int(file_size_limit):
            payload = json.dumps(
                {
                    "public": bool(info.get("public", True)),
                    "file_size_limit": int(file_size_limit),
                }
            ).encode("utf-8")
            try:
                _storage_request("PUT", list_url, headers=headers, data=payload)
            except StorageError as exc:
                # Project-wide Storage cap (often 50MB on Free) may be lower.
                if "413" not in str(exc) and "EntityTooLarge" not in str(exc):
                    logger.warning("Could not raise bucket file_size_limit: %s", exc)
        return
    except StorageError as exc:
        if "404" not in str(exc):
            raise
    payload = json.dumps(
        {
            "id": settings.bucket,
            "name": settings.bucket,
            "public": True,
            "file_size_limit": int(file_size_limit),
        }
    ).encode("utf-8")
    try:
        _storage_request(
            "POST",
            f"{settings.url}/storage/v1/bucket",
            headers=headers,
            data=payload,
        )
    except StorageError as exc:
        # Concurrent create or already exists.
        if "409" in str(exc) or "already exists" in str(exc).lower():
            return
        raise
    logger.info("Created public storage bucket %s", settings.bucket)


def upload_bytes(
    settings: StorageSettings,
    key: str,
    data: bytes,
    *,
    content_type: str,
    upsert: bool = True,
) -> str:
    if not data:
        raise StorageError("Refusing to upload empty object")
    if not _SAFE_KEY_RE.fullmatch(key) or ".." in key:
        raise StorageError("Refusing unsafe object key")
    url = f"{settings.url}/storage/v1/object/{settings.bucket}/{key}?cacheControl={PUBLIC_CACHE_CONTROL}"
    headers = _auth_headers(settings, content_type)
    headers["cache-control"] = PUBLIC_CACHE_CONTROL
    headers["x-cache-control"] = PUBLIC_CACHE_CONTROL
    if upsert:
        headers["x-upsert"] = "true"
    timeout = 180
    if data and len(data) > 8 * 1024 * 1024:
        timeout = 420
    _storage_request("POST", url, headers=headers, data=data, timeout=timeout)
    return public_object_url(settings, key)


def upload_file(settings: StorageSettings, path: Path, key: str, *, upsert: bool = True) -> str:
    payload = path.read_bytes()
    return upload_bytes(
        settings,
        key,
        payload,
        content_type=content_type_for_suffix(path.suffix),
        upsert=upsert,
    )
