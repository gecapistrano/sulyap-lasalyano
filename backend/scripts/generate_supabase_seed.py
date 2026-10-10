"""Regenerate supabase/seed.sql from catalog_seed.py (UTF-8, idempotent)."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from passlib.context import CryptContext  # noqa: E402

from app.services.catalog_seed import (  # noqa: E402
    ARTIFACT_BY_RD,
    ARTIFACT_ROWS,
    PLACEHOLDER_IMAGE,
    PRESIDENT_ROWS,
    _load_scanner_labels,
)

OUT = ROOT.parent / "supabase" / "seed.sql"
PWD = "ChangeMe" + "Local12"


def esc(value: str) -> str:
    return value.replace("'", "''")


def main() -> None:
    hash_pw = CryptContext(schemes=["bcrypt"], deprecated="auto").hash(PWD)
    needed = sorted(set(_load_scanner_labels()) | set(ARTIFACT_BY_RD.keys()))
    lines: list[str] = [
        "-- Idempotent seed for Sulyap catalog (presidents + artifacts + curator)",
        f"-- Curator login: curator@example.com / {PWD}",
        "-- Prefer letting FastAPI seed on startup; this SQL is for the Supabase SQL Editor.",
        "-- Inserts missing RD codes even when some artifacts already exist.",
        "",
        "INSERT INTO users (email, hashed_password, role, is_active)",
        f"SELECT 'curator@example.com', '{hash_pw}', 'admin', TRUE",
        "WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'curator@example.com');",
        "",
    ]
    for president_id, name, service in PRESIDENT_ROWS:
        lines.append(
            "INSERT INTO presidents (id, name, service, icon) "
            f"SELECT {president_id}, '{esc(name)}', '{esc(service)}', '👤' "
            f"WHERE NOT EXISTS (SELECT 1 FROM presidents WHERE id = {president_id} OR name = '{esc(name)}');"
        )
    lines.extend(
        [
            "",
            "SELECT setval(pg_get_serial_sequence('presidents', 'id'), "
            "(SELECT COALESCE(MAX(id), 1) FROM presidents));",
            "",
            "DO $$",
            "DECLARE curator_id INTEGER;",
            "BEGIN",
            "  SELECT id INTO curator_id FROM users WHERE email = 'curator@example.com';",
        ]
    )
    for rd_code in needed:
        rich = ARTIFACT_BY_RD.get(rd_code)
        if rich:
            title, code, owner_name, year, subtitle, icon, description = rich
        else:
            title = f"Memorabilia {rd_code}"
            code = rd_code
            owner_name = "DLSU-D Presidents' Gallery"
            year = ""
            subtitle = "Scanner catalog entry"
            icon = "🏺"
            description = (
                f"Published catalog record for scanner class {rd_code}. "
                "Curators can edit this title and description in Curator Desk."
            )
        lines.append(
            "  IF NOT EXISTS (SELECT 1 FROM artifacts WHERE upper(rd_code) = "
            f"'{esc(code.upper())}') THEN"
        )
        lines.append(
            "    INSERT INTO artifacts "
            "(owner_id, title, description, image_url, rd_code, owner_name, year, subtitle, icon, published) "
            f"VALUES (curator_id, '{esc(title)}', '{esc(description)}', '{esc(PLACEHOLDER_IMAGE)}', "
            f"'{esc(code)}', '{esc(owner_name)}', '{esc(year)}', '{esc(subtitle)}', '{esc(icon)}', TRUE);"
        )
        lines.append("  END IF;")
    lines.extend(["END $$;", ""])
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {OUT} ({len(needed)} artifact upserts; {len(ARTIFACT_ROWS)} rich rows)")


if __name__ == "__main__":
    main()
