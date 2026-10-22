"""Normalize stored photo/model URLs for API responses.

Cloud http(s) URLs are returned as-is in production. Local relative paths
(``/curator-media/...``, ``/media/models/...``) stay relative so existing media
routes still work. Non-production catalog may rewrite Storage URLs to those
local paths when the file exists under ``backend/uploads/``.
"""
from __future__ import annotations

from urllib.parse import urlparse


def is_http_url(value: str | None) -> bool:
    """True for absolute http(s) URLs with a host. Rejects newlines and schemes like javascript:."""
    text = (value or "").strip()
    if not text or any(ch in text for ch in ("\n", "\r", "\x00")):
        return False
    parsed = urlparse(text)
    if parsed.scheme not in ("http", "https"):
        return False
    return bool(parsed.netloc)


def passthrough_media_url(value: str | None) -> str:
    """Return stored media URLs unchanged: https stays https, relative paths stay relative."""
    return (value or "").strip()


def is_supabase_storage_url(value: str | None) -> bool:
    """True for objects served from Supabase Storage (public or signed)."""
    text = (value or "").strip().lower()
    if "/storage/v1/object/" not in text:
        return False
    host = urlparse(text).hostname or ""
    return host.endswith(".supabase.co") or host.endswith(".supabase.net")


def public_model_url(
    value: str | None,
    *,
    public_base: str = "",
    omit_storage: bool = False,
) -> str:
    """Rewrite or hide catalog GLB URLs so visitors are not billed on Storage egress.

    ``public_base`` (e.g. an R2/Pages origin) replaces the Supabase prefix and keeps
    ``/models/AG013.glb``. ``omit_storage`` drops Supabase Storage model URLs entirely
    so Live Scan falls back to the catalog photo.
    """
    text = passthrough_media_url(value)
    if not text:
        return ""
    base = (public_base or "").strip().rstrip("/")
    if base:
        lower = text.lower()
        marker = "/models/"
        idx = lower.rfind(marker)
        if idx >= 0:
            return f"{base}{text[idx:]}"
        if text.startswith("/"):
            return f"{base}{text}"
        return f"{base}/{text.lstrip('/')}"
    if omit_storage and is_supabase_storage_url(text):
        return ""
    return text
