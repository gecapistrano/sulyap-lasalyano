"""Normalize accession / scanner id codes and map prefixes to presidents."""
from __future__ import annotations

import re
from pathlib import Path

# Accession prefix → canonical president name (must match presidents catalog).
# Verified against data/imports/presidents_memorabilia_collection.xlsb sheet tabs:
#   (RD) Rafael Donato, (RDi) Rolando Dizon, (AG) Andrew Gonzales,
#   (AB) Augustine Boquer, (FDR) Francisco dela Rosa, (IR) Iñigo Riola
# IMPORTANT: match longest prefix first — RDi/RDI must NOT fall through to RD.
OWNER_BY_PREFIX: dict[str, str] = {
    "RDI": "Br. Rolando V. Dizon, FSC",
    "RD": "Br. Rafael S. Donato, FSC",
    "XAG": "Br. Andrew B. Gonzalez, FSC",
    "AG": "Br. Andrew B. Gonzalez, FSC",
    "AB": "Br. Gus Boquer, FSC",
    "FDR": 'Br. Francisco "Sockie" dela Rosa VI, FSC',
    "IR": "Br. Iñigo Riola, FSC",
}

GALLERY_OWNER_ALIASES = frozenset(
    {
        "dlsu-d presidents' gallery",
        "dlsu-d presidents gallery",
        "su-d presidents' gallery",
        "su-d presidents gallery",
        "presidents' gallery",
        "presidents gallery",
    }
)


def normalize_id_code(value: str | None) -> str:
    raw = (value or "").strip().upper()
    if not raw:
        return ""
    return re.sub(r"\s+", "", raw)


_FILENAME_CODE_RE = re.compile(r"([A-Z]{1,4}\d{1,4})", re.I)


def accession_codes_from_filename(name: str | None) -> list[str]:
    """Parse accession codes from a GLB/photo filename (AG001.glb, AG028-AG029.glb)."""
    stem = Path(name or "").stem
    found: list[str] = []
    seen: set[str] = set()
    for match in _FILENAME_CODE_RE.finditer(stem):
        code = normalize_id_code(match.group(1))
        if not code or code in seen:
            continue
        seen.add(code)
        found.append(code)
    return found


def looks_like_id_code(value: str | None) -> bool:
    code = normalize_id_code(value)
    return bool(re.fullmatch(r"[A-Z]{1,4}\d{1,4}", code))


def prefix_from_id_code(value: str | None) -> str:
    code = normalize_id_code(value)
    match = re.match(r"^([A-Z]{1,4})\d{1,4}$", code)
    return match.group(1) if match else ""


def owner_for_id_code(value: str | None) -> str:
    """Return canonical owner/president for an accession code, or empty if unknown."""
    prefix = prefix_from_id_code(value)
    if not prefix:
        return ""
    # Exact prefix first (RDI003 → RDI, RD155 → RD).
    if prefix in OWNER_BY_PREFIX:
        return OWNER_BY_PREFIX[prefix]
    # Longest-prefix fallback only (never let RD claim an RDI* code).
    for known in sorted(OWNER_BY_PREFIX.keys(), key=len, reverse=True):
        if prefix == known or (len(prefix) > len(known) and prefix.startswith(known)):
            # Require full known prefix; skip if a longer known prefix also matches.
            longer_conflict = any(
                other != known and prefix.startswith(other) and len(other) > len(known)
                for other in OWNER_BY_PREFIX
            )
            if longer_conflict:
                continue
            return OWNER_BY_PREFIX[known]
    return ""


def is_gallery_owner_label(value: str | None) -> bool:
    label = re.sub(r"\s+", " ", (value or "").strip().lower())
    return label in GALLERY_OWNER_ALIASES
