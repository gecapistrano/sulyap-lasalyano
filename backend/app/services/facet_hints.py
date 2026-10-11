"""Rule-based facet hints from title/description (no LLM)."""
from __future__ import annotations

import re

TYPE_KEYWORDS: tuple[tuple[str, str], ...] = (
    ("medal", "medal"),
    ("medallion", "medallion"),
    ("plaque", "plaque"),
    ("bust", "bust"),
    ("trophy", "trophy"),
    ("candle holder", "candle holder"),
    ("ceramic plate", "ceramic plate"),
    ("plate", "plate"),
    ("statue", "statue"),
    ("painting", "painting"),
    ("portrait", "portrait"),
    ("certificate", "certificate"),
    ("banner", "banner"),
    ("poster", "poster"),
    ("pin", "pin"),
    ("book", "book"),
    ("binder", "binder"),
)

COUNTRY_KEYWORDS: tuple[tuple[str, str], ...] = (
    ("thailand", "Thailand"),
    ("japan", "Japan"),
    ("china", "China"),
    ("korea", "Korea"),
    ("philippines", "Philippines"),
    ("philippine", "Philippines"),
    ("usa", "United States"),
    ("united states", "United States"),
    ("america", "United States"),
    ("france", "France"),
    ("germany", "Germany"),
    ("italy", "Italy"),
    ("spain", "Spain"),
    ("united kingdom", "United Kingdom"),
    ("england", "United Kingdom"),
    ("australia", "Australia"),
    ("canada", "Canada"),
    ("india", "India"),
    ("singapore", "Singapore"),
    ("malaysia", "Malaysia"),
    ("indonesia", "Indonesia"),
    ("vietnam", "Vietnam"),
    ("taiwan", "Taiwan"),
    ("hong kong", "Hong Kong"),
    ("finland", "Finland"),
    ("helsingiensis", "Finland"),
    ("portsmouth", "United Kingdom"),
)


def extract_facet_hints(title: str = "", description: str = "") -> dict[str, str]:
    text = f"{title}\n{description}".lower()
    out: dict[str, str] = {}

    years = re.findall(r"\b(19|20)\d{2}\b", text)
    if years:
        # Prefer the last explicit year in the blurb (often acquisition / gift year).
        out["year_acquired"] = years[-1]

    for needle, label in TYPE_KEYWORDS:
        if needle in text:
            out["artifact_type"] = label
            break

    for needle, label in COUNTRY_KEYWORDS:
        if needle in text:
            out["country_of_origin"] = label
            break

    return out


def apply_facet_hints_if_empty(artifact, *, force: bool = False) -> None:
    hints = extract_facet_hints(getattr(artifact, "title", "") or "", getattr(artifact, "description", "") or "")
    for field, value in hints.items():
        current = (getattr(artifact, field, "") or "").strip()
        if force or not current:
            setattr(artifact, field, value)
