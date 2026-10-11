"""Optional per-artifact LLM facet/tag suggestions. Off unless configured + toggled."""
from __future__ import annotations

import json
import logging
import os
import re
import urllib.error
import urllib.request

from fastapi import HTTPException, status

from .facet_hints import extract_facet_hints

logger = logging.getLogger("sulyap.llm")


def llm_configured() -> bool:
    return bool(os.environ.get("LLM_API_KEY", "").strip())


def suggest_from_description(
    *,
    id_code: str,
    title: str,
    description: str,
    owner_name: str,
) -> dict:
    """Return suggestion dict. Uses OpenAI-compatible Chat Completions when configured."""
    if not llm_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI assist not configured",
        )

    api_key = os.environ["LLM_API_KEY"].strip()
    model = (os.environ.get("LLM_MODEL") or "gpt-4o-mini").strip()
    base = (os.environ.get("LLM_API_BASE") or "https://api.openai.com/v1").rstrip("/")

    system = (
        "You extract museum catalog metadata. Reply with ONLY compact JSON object keys: "
        "title (string|null), year_acquired (string|null), country_of_origin (string|null), "
        "artifact_type (string|null), tags (array of short strings). "
        "Use null when unknown. Do not invent accession codes. No markdown."
    )
    user = (
        f"id_code: {id_code}\n"
        f"owner: {owner_name}\n"
        f"title: {title}\n"
        f"description: {description[:6000]}"
    )
    payload = {
        "model": model,
        "temperature": 0.2,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }
    req = urllib.request.Request(
        f"{base}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        logger.warning("LLM HTTP error: %s", exc.code)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="AI assist failed") from exc
    except Exception as exc:  # noqa: BLE001
        logger.warning("LLM request failed: %s", exc)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="AI assist failed") from exc

    try:
        content = body["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="AI assist invalid response") from exc

    parsed = _parse_json_object(content)
    # Fallback merge with rules if model returned almost nothing
    if not any(parsed.get(k) for k in ("year_acquired", "country_of_origin", "artifact_type", "tags")):
        hints = extract_facet_hints(title, description)
        parsed.update({k: v for k, v in hints.items() if not parsed.get(k)})
    return {
        "title": _clean_opt_str(parsed.get("title"), 200),
        "year_acquired": _clean_opt_str(parsed.get("year_acquired"), 32),
        "country_of_origin": _clean_opt_str(parsed.get("country_of_origin"), 120),
        "artifact_type": _clean_opt_str(parsed.get("artifact_type"), 120),
        "tags": _clean_tags(parsed.get("tags")),
    }


def _parse_json_object(content: str) -> dict:
    text = (content or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", text)
        if not match:
            return {}
        try:
            data = json.loads(match.group(0))
        except json.JSONDecodeError:
            return {}
    return data if isinstance(data, dict) else {}


def _clean_opt_str(value, max_len: int) -> str | None:
    if value is None:
        return None
    s = str(value).strip()
    if not s or s.lower() in {"null", "none", "unknown", "n/a"}:
        return None
    return s[:max_len]


def _clean_tags(value) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for item in value[:20]:
        s = str(item).strip()[:80]
        if s and s.lower() not in {"null", "none"}:
            out.append(s)
    return out
