"""
Bidirectional catalog sync: local SQLite (DATABASE_URL) ↔ remote Postgres (SYNC_REMOTE_DATABASE_URL).

Syncs presidents, artifacts, tags, and artifact_tags only. Never copies users/password hashes.

Usage (from backend/):
  python scripts/sync_catalog.py
  python scripts/sync_catalog.py --pull --dry-run
  python scripts/sync_catalog.py --push
  python scripts/sync_catalog.py --both --apply-deletes
  python scripts/sync_catalog.py --list-versions
  python scripts/sync_catalog.py --restore VERSION_ID
  python scripts/sync_catalog.py --restore VERSION_ID --target local
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def _load_dotenv(path: Path) -> None:
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        if not key:
            continue
        val = val.strip()
        if len(val) >= 2 and val[0] == val[-1] and val[0] in {"'", '"'}:
            val = val[1:-1]
        os.environ.setdefault(key, val)


_load_dotenv(ROOT / ".env")

from app.services.catalog_sync import (  # noqa: E402
    CatalogSyncError,
    list_snapshots,
    restore_from_settings,
    run_from_settings,
)


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync presidents/artifacts between local SQLite and Supabase")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--pull", action="store_true", help="Remote → local only")
    group.add_argument("--push", action="store_true", help="Local → remote only")
    group.add_argument("--both", action="store_true", help="Bidirectional merge (default)")
    parser.add_argument("--dry-run", action="store_true", help="Print planned writes without changing databases")
    parser.add_argument(
        "--apply-deletes",
        action="store_true",
        help="Propagate missing rows as deletes (off by default)",
    )
    parser.add_argument("--restore", metavar="VERSION_ID", help="Restore a snapshot onto the selected target")
    parser.add_argument(
        "--target",
        choices=("local", "remote", "both"),
        default="both",
        help="Restore target (default both)",
    )
    parser.add_argument("--list-versions", action="store_true", help="List local catalog snapshots")
    args = parser.parse_args()

    if args.list_versions:
        entries = list_snapshots()
        if not entries:
            print("No catalog snapshots yet. Run a sync (without --dry-run) to create history.")
            return 0
        for item in entries:
            print(
                f"{item.get('id', '?'):8}  {item.get('created_at', '?'):20}  "
                f"source={item.get('source', '?'):8}  {item.get('file', '')}"
            )
        return 0

    direction = "both"
    if args.pull:
        direction = "pull"
    elif args.push:
        direction = "push"
    elif args.both:
        direction = "both"

    try:
        if args.restore:
            report = restore_from_settings(
                version_id=args.restore,
                target=args.target,
                dry_run=args.dry_run,
            )
        else:
            report = run_from_settings(
                direction=direction,
                dry_run=args.dry_run,
                apply_deletes=args.apply_deletes,
            )
    except CatalogSyncError as exc:
        print(str(exc), file=sys.stderr)
        return 2

    print(report.summary())
    for note in report.notes:
        print(f"- {note}")
    if report.discarded:
        print(f"Discarded local conflict rows: {len(report.discarded)} (see matching local snapshot)")
        for item in report.discarded[:20]:
            print(f"  {item.get('entity')} {item.get('key')} kept={item.get('kept')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
