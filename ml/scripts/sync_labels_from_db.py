"""
Export published catalog id_codes for docs / annotation guides.

IMPORTANT: Do NOT overwrite hall/models/labels.txt from the catalog.
Live Scan labels must match the trained ONNX class order (see ml/weights/classes.txt
and ml/scripts/deploy_model.py). Catalog-sorted codes break index→class mapping.

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

# Catalog export only — never Live Scan training labels.
OUT = ROOT / "ml" / "weights" / "catalog_id_codes.txt"
TRAINING_LABELS = ROOT / "hall" / "models" / "labels.txt"
WEIGHTS_CLASSES = ROOT / "ml" / "weights" / "classes.txt"


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
    print(f"Wrote {len(codes)} catalog id_codes -> {OUT}")
    print(
        "Live Scan labels stay in training order "
        f"({TRAINING_LABELS.name} / {WEIGHTS_CLASSES.name}); "
        "use ml/scripts/deploy_model.py after retraining."
    )


if __name__ == "__main__":
    main()
