"""Smoke-check DATABASE_URL (SQLite or Supabase/Postgres)."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from sqlalchemy import func, select, text  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.core.database import (  # noqa: E402
    Base,
    SessionLocal,
    _sqlite_add_missing_columns,
    engine,
    normalize_database_url,
)
from app.models import Artifact, President, User  # noqa: E402
from app.services.catalog_seed import seed_catalog_if_empty  # noqa: E402


def main() -> None:
    settings = get_settings()
    url = normalize_database_url(settings.database_url)
    safe = url.split("@")[-1] if "@" in url else url
    print(f"Connecting via …@{safe}")
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    Base.metadata.create_all(bind=engine)
    _sqlite_add_missing_columns(engine)
    with SessionLocal() as db:
        seed_catalog_if_empty(db)
        users = db.scalar(select(func.count()).select_from(User)) or 0
        presidents = db.scalar(select(func.count()).select_from(President)) or 0
        artifacts = db.scalar(select(func.count()).select_from(Artifact)) or 0
    print(f"OK — users={users}, presidents={presidents}, artifacts={artifacts}")



if __name__ == "__main__":
    main()
