"""
Reassign artifact owner_name / president_id from accession prefixes.

Fixes bogus "DLSU-D Presidents' Gallery" labels and RD* rows that were
incorrectly attributed to other presidents.

Usage (from backend/):
  python scripts/repair_artifact_owners.py
  python scripts/repair_artifact_owners.py --dry-run
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from sqlalchemy import select  # noqa: E402

from app.core.database import SessionLocal  # noqa: E402
from app.models import Artifact, President  # noqa: E402
from app.services.artifact_tags import preload_tag_cache, sync_auto_tags  # noqa: E402
from app.services.id_codes import (  # noqa: E402
    is_gallery_owner_label,
    owner_for_id_code,
)


def main() -> None:
    parser = argparse.ArgumentParser(description="Repair artifact owners from id_code prefixes")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    changed = 0
    gallery_cleared = 0
    with SessionLocal() as db:
        presidents = {p.name: p.id for p in db.scalars(select(President)).all()}
        tag_cache = preload_tag_cache(db)
        arts = db.scalars(select(Artifact)).all()
        for art in arts:
            code = (art.id_code or "").strip()
            correct = owner_for_id_code(code)
            current = (art.owner_name or "").strip()
            if not correct:
                if is_gallery_owner_label(current):
                    print(f"  clear gallery label on {code or art.id}: {current!r}")
                    if not args.dry_run:
                        art.owner_name = ""
                        art.president_id = None
                        sync_auto_tags(db, art, cache=tag_cache)
                    gallery_cleared += 1
                continue
            if current == correct:
                # Still refresh president_id if missing/mismatched.
                want_pid = presidents.get(correct)
                if want_pid and art.president_id != want_pid:
                    if not args.dry_run:
                        art.president_id = want_pid
                    changed += 1
                continue
            print(f"  {code}: {current!r} -> {correct!r}")
            if not args.dry_run:
                art.owner_name = correct
                art.president_id = presidents.get(correct)
                sync_auto_tags(db, art, cache=tag_cache)
            changed += 1
        if args.dry_run:
            print(f"Dry run: would change {changed} row(s), clear {gallery_cleared} gallery label(s)")
        else:
            db.commit()
            print(f"Done: changed={changed} gallery_cleared={gallery_cleared}")


if __name__ == "__main__":
    main()
