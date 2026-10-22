"""Unit tests for catalog merge decisions and snapshot prune (no live Supabase)."""
from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import func, select  # noqa: E402

from app.models import Artifact, President, User  # noqa: E402
from app.services.catalog_seed import CURATOR_SEED_EMAIL  # noqa: E402
from app.services.catalog_sync import (  # noqa: E402
    _order_local_remote,
    decide_row,
    open_sync_session,
    prune_snapshots,
    restore_catalog_version,
    run_catalog_sync,
)


class DecideRowTests(unittest.TestCase):
    def test_missing_local_pull_copies_from_remote(self) -> None:
        self.assertEqual(
            decide_row(
                local_hash=None,
                remote_hash="abc",
                prev_local_hash=None,
                prev_remote_hash=None,
                direction="pull",
                apply_deletes=False,
            ),
            "copy_to_local",
        )

    def test_missing_remote_push_copies_from_local(self) -> None:
        self.assertEqual(
            decide_row(
                local_hash="abc",
                remote_hash=None,
                prev_local_hash=None,
                prev_remote_hash=None,
                direction="push",
                apply_deletes=False,
            ),
            "copy_to_remote",
        )

    def test_missing_remote_pull_does_not_delete_by_default(self) -> None:
        self.assertEqual(
            decide_row(
                local_hash="abc",
                remote_hash=None,
                prev_local_hash="abc",
                prev_remote_hash="abc",
                direction="pull",
                apply_deletes=False,
            ),
            "skip",
        )

    def test_missing_remote_pull_deletes_when_flagged(self) -> None:
        self.assertEqual(
            decide_row(
                local_hash="abc",
                remote_hash=None,
                prev_local_hash="abc",
                prev_remote_hash="abc",
                direction="pull",
                apply_deletes=True,
            ),
            "delete_local",
        )

    def test_identical_hashes_skip(self) -> None:
        self.assertEqual(
            decide_row(
                local_hash="same",
                remote_hash="same",
                prev_local_hash="same",
                prev_remote_hash="same",
                direction="both",
                apply_deletes=False,
            ),
            "skip",
        )

    def test_only_local_changed_pushes(self) -> None:
        self.assertEqual(
            decide_row(
                local_hash="new",
                remote_hash="old",
                prev_local_hash="old",
                prev_remote_hash="old",
                direction="both",
                apply_deletes=False,
            ),
            "copy_to_remote",
        )

    def test_only_remote_changed_pulls(self) -> None:
        self.assertEqual(
            decide_row(
                local_hash="old",
                remote_hash="new",
                prev_local_hash="old",
                prev_remote_hash="old",
                direction="both",
                apply_deletes=False,
            ),
            "copy_to_local",
        )

    def test_both_changed_prefers_remote(self) -> None:
        self.assertEqual(
            decide_row(
                local_hash="local-new",
                remote_hash="remote-new",
                prev_local_hash="old",
                prev_remote_hash="old",
                direction="both",
                apply_deletes=False,
            ),
            "conflict_prefer_remote",
        )

    def test_first_sync_difference_prefers_remote_without_conflict(self) -> None:
        self.assertEqual(
            decide_row(
                local_hash="local",
                remote_hash="remote",
                prev_local_hash=None,
                prev_remote_hash=None,
                direction="both",
                apply_deletes=False,
            ),
            "copy_to_local",
        )

    def test_empty_local_push_does_not_delete_remote(self) -> None:
        self.assertEqual(
            decide_row(
                local_hash=None,
                remote_hash="remote",
                prev_local_hash=None,
                prev_remote_hash=None,
                direction="push",
                apply_deletes=False,
            ),
            "skip",
        )


class SyncUrlOrderTests(unittest.TestCase):
    def test_sqlite_is_local_when_primary_is_postgres(self) -> None:
        local, remote = _order_local_remote(
            "postgresql://db.example/postgres",
            "sqlite:///./sulyap.db",
        )
        self.assertTrue(local.startswith("sqlite"))
        self.assertTrue(remote.startswith("postgresql"))


class PruneSnapshotsTests(unittest.TestCase):
    def test_keeps_ten_newest_and_drops_oldest(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            (folder / ".gitkeep").write_text("", encoding="utf-8")
            for index in range(12):
                stamp = f"20261022T{index:06d}Z"
                (folder / f"{stamp}_local_abcd{index:02d}.json.gz").write_bytes(b"x")
            removed = prune_snapshots(folder, keep=10)
            remaining = sorted(
                path.name
                for path in folder.iterdir()
                if path.suffix == ".gz" or path.name.endswith(".json.gz")
            )
            self.assertEqual(len(removed), 2)
            self.assertEqual(len(remaining), 10)
            self.assertTrue((folder / ".gitkeep").is_file())
            self.assertTrue(remaining[0].startswith("20261022T000002Z"))


class TwoSqliteSyncTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        tmp = Path(self._tmp.name)
        self.versions = tmp / "versions"
        self.versions.mkdir()
        import app.services.catalog_sync as cs

        self._cs = cs
        self._old = (cs.VERSIONS_DIR, cs.STATE_PATH, cs.DATA_DIR)
        cs.VERSIONS_DIR = self.versions
        cs.STATE_PATH = tmp / "state.json"
        cs.DATA_DIR = tmp
        self.local_url = "sqlite:///" + (tmp / "local.db").as_posix()
        self.remote_url = "sqlite:///" + (tmp / "remote.db").as_posix()

    def tearDown(self) -> None:
        self._cs.VERSIONS_DIR, self._cs.STATE_PATH, self._cs.DATA_DIR = self._old
        self._tmp.cleanup()

    def _seed(
        self,
        url: str,
        *,
        extra_user: bool = False,
        president: bool = False,
        artifact: bool = False,
        curator_hash: str = "curator-hash",
    ) -> None:
        engine, factory = open_sync_session(url)
        session = factory()
        try:
            curator = User(
                email=CURATOR_SEED_EMAIL,
                hashed_password=curator_hash,
                role="admin",
                is_active=True,
            )
            session.add(curator)
            session.flush()
            if extra_user:
                session.add(
                    User(
                        email="demo-only@example.com",
                        hashed_password="should-not-copy",
                        role="viewer",
                        is_active=True,
                    )
                )
            if president:
                session.add(
                    President(
                        id=1,
                        name="Br. Rafael S. Donato, FSC",
                        service="1987 - 1994",
                        icon="👤",
                        biography="local bio",
                        photo_url="",
                        published=True,
                    )
                )
            if artifact:
                session.flush()
                session.add(
                    Artifact(
                        owner_id=curator.id,
                        title="Founding Plaque",
                        description="seed",
                        image_url="https://example.com/a.png",
                        id_code="RD204",
                        owner_name="Br. Rafael S. Donato, FSC",
                        year="1987",
                        year_acquired="1987",
                        published=True,
                        president_id=1 if president else None,
                    )
                )
            session.commit()
        finally:
            session.close()
            engine.dispose()

    def test_push_copies_catalog_but_not_users(self) -> None:
        self._seed(
            self.local_url,
            extra_user=True,
            president=True,
            artifact=True,
            curator_hash="local-hash-not-synced",
        )
        self._seed(
            self.remote_url,
            extra_user=False,
            president=False,
            artifact=False,
            curator_hash="remote-hash-keep-me",
        )
        report = run_catalog_sync(
            local_url=self.local_url,
            remote_url=self.remote_url,
            direction="push",
            dry_run=False,
            apply_deletes=False,
        )
        self.assertGreaterEqual(report.copied_to_remote, 2)
        engine, factory = open_sync_session(self.remote_url)
        session = factory()
        try:
            self.assertEqual(session.scalar(select(func.count()).select_from(President)), 1)
            self.assertEqual(session.scalar(select(func.count()).select_from(Artifact)), 1)
            emails = set(session.scalars(select(User.email)).all())
            self.assertEqual(emails, {CURATOR_SEED_EMAIL})
            art = session.scalar(select(Artifact))
            self.assertEqual(art.id_code, "RD204")
            remote_curator = session.scalar(select(User).where(User.email == CURATOR_SEED_EMAIL))
            self.assertEqual(art.owner_id, remote_curator.id)
            self.assertEqual(remote_curator.hashed_password, "remote-hash-keep-me")
        finally:
            session.close()
            engine.dispose()

    def test_default_does_not_delete_remote_when_local_empty(self) -> None:
        self._seed(self.local_url, president=False, artifact=False)
        self._seed(self.remote_url, president=True, artifact=True)
        run_catalog_sync(
            local_url=self.local_url,
            remote_url=self.remote_url,
            direction="push",
            dry_run=False,
            apply_deletes=False,
        )
        engine, factory = open_sync_session(self.remote_url)
        session = factory()
        try:
            self.assertEqual(session.scalar(select(func.count()).select_from(Artifact)), 1)
        finally:
            session.close()
            engine.dispose()

    def test_restore_replaces_target_catalog(self) -> None:
        self._seed(self.local_url, president=True, artifact=True)
        self._seed(self.remote_url, president=False, artifact=False)
        run_catalog_sync(
            local_url=self.local_url,
            remote_url=self.remote_url,
            direction="push",
            dry_run=False,
        )
        engine, factory = open_sync_session(self.local_url)
        session = factory()
        try:
            row = session.scalar(select(President).where(President.id == 1))
            row.biography = "changed after sync"
            session.commit()
        finally:
            session.close()
            engine.dispose()
        versions = sorted(self.versions.glob("*.json.gz"))
        self.assertTrue(versions)
        local_snap = [p for p in versions if "_local_" in p.name]
        self.assertTrue(local_snap)
        version_id = local_snap[0].name.rsplit("_", 1)[-1].removesuffix(".json.gz")
        restore_catalog_version(
            version_id=version_id,
            local_url=self.local_url,
            remote_url=self.remote_url,
            target="local",
            dry_run=False,
        )
        engine, factory = open_sync_session(self.local_url)
        session = factory()
        try:
            row = session.scalar(select(President).where(President.id == 1))
            self.assertEqual(row.biography, "local bio")
        finally:
            session.close()
            engine.dispose()


if __name__ == "__main__":
    unittest.main()
