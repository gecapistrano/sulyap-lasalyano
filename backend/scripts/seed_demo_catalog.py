"""Fill an empty local database with demo presidents and placeholder artifacts.

Does not overwrite presidents or artifacts that already exist. The hosted
catalog is edited in Curator Desk; do not run this against that database
unless it is empty and you want the demo rows.

Usage (from backend/):
  python scripts/seed_demo_catalog.py
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from sqlalchemy import func, select  # noqa: E402

from app.core.database import SessionLocal  # noqa: E402
from app.models import Artifact, President  # noqa: E402
from app.services.catalog_seed import seed_demo_catalog  # noqa: E402


def main() -> None:
    with SessionLocal() as db:
        added = seed_demo_catalog(db)
        presidents = db.scalar(select(func.count()).select_from(President)) or 0
        artifacts = db.scalar(select(func.count()).select_from(Artifact)) or 0
    print(f"Demo seed added {added} artifacts. presidents={presidents}, artifacts={artifacts}")


if __name__ == "__main__":
    main()
