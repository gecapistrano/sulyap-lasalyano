"""
Regenerate frontend/public/models/labels.txt from published artifact id_codes.

Usage (from repo root, with DATABASE_URL set):
  python ml/scripts/sync_labels_from_db.py
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from sqlalchemy import select  # noqa: E402

from app.core.database import SessionLocal  # noqa: E402
from app.models import Artifact  # noqa: E402
from app.services.id_codes import normalize_id_code  # noqa: E402

OUT = ROOT / "frontend" / "public" / "models" / "labels.txt"


def main() -> None:
    with SessionLocal() as db:
        codes = sorted(
            {
                normalize_id_code(c)
                for c in db.scalars(select(Artifact.id_code).where(Artifact.published.is_(True))).all()
                if normalize_id_code(c)
            }
        )
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(codes) + ("\n" if codes else ""), encoding="utf-8")
    print(f"Wrote {len(codes)} labels -> {OUT}")


if __name__ == "__main__":
    main()
