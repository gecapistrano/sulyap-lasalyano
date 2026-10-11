"""
Build a Roboflow annotation guide workbook from the catalog DB.

Columns:
  - id_code (Roboflow class name)
  - title / description / owner / curator_remarks
  - photo (embedded thumbnail when available)
  - photo_file (local path)
  - prior_detector (Yes if class existed in previous labels)
  - annotation_status (dropdown: Not annotated | In progress | Annotated)

Usage (from backend/, DATABASE_URL set):
  python scripts/export_annotation_guide_xlsx.py
  python scripts/export_annotation_guide_xlsx.py --out ../data/imports/roboflow_annotation_guide.xlsx
"""
from __future__ import annotations

import argparse
import sys
from io import BytesIO
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
sys.path.insert(0, str(ROOT))

from openpyxl import Workbook  # noqa: E402
from openpyxl.drawing.image import Image as XLImage  # noqa: E402
from openpyxl.styles import Alignment, Font, PatternFill  # noqa: E402
from openpyxl.utils import get_column_letter  # noqa: E402
from openpyxl.worksheet.datavalidation import DataValidation  # noqa: E402
from sqlalchemy import select  # noqa: E402

from app.core.database import SessionLocal  # noqa: E402
from app.models import Artifact  # noqa: E402
from app.services.id_codes import normalize_id_code  # noqa: E402
from app.services.photo_uploads import PHOTOS_ROOT  # noqa: E402

DEFAULT_OUT = REPO / "data" / "imports" / "roboflow_annotation_guide.xlsx"
PRIOR_LABELS = REPO / "ml" / "weights" / "classes.txt"
STATUS_CHOICES = '"Not annotated,In progress,Annotated"'
THUMB_MAX = (160, 160)


def _load_prior_labels() -> set[str]:
    if not PRIOR_LABELS.is_file():
        return set()
    return {
        normalize_id_code(line)
        for line in PRIOR_LABELS.read_text(encoding="utf-8").splitlines()
        if normalize_id_code(line)
    }


def _photo_path_for(id_code: str, image_url: str) -> Path | None:
    code = normalize_id_code(id_code)
    candidates = [
        PHOTOS_ROOT / f"import_{code}.png",
        PHOTOS_ROOT / f"import_{code}.jpg",
        PHOTOS_ROOT / f"import_{code}.jpeg",
        PHOTOS_ROOT / f"import_{code}.webp",
    ]
    url = (image_url or "").strip().replace("\\", "/")
    if url.startswith("/curator-media/artifacts/"):
        candidates.insert(0, PHOTOS_ROOT / url.split("/")[-1])
    for path in candidates:
        if path.is_file() and path.stat().st_size > 200:
            # Skip tiny / placeholder exports
            return path
    return None


def _thumb_bytes(path: Path) -> BytesIO | None:
    try:
        from PIL import Image as PILImage
    except ImportError:
        return None
    try:
        with PILImage.open(path) as im:
            im = im.convert("RGB")
            im.thumbnail(THUMB_MAX)
            buf = BytesIO()
            im.save(buf, format="JPEG", quality=82)
            buf.seek(0)
            return buf
    except Exception:  # noqa: BLE001
        return None


def build(out: Path) -> Path:
    prior = _load_prior_labels()
    with SessionLocal() as db:
        rows = list(
            db.scalars(select(Artifact).order_by(Artifact.id_code.asc())).all()
        )

    wb = Workbook()
    ws = wb.active
    ws.title = "Annotation guide"

    headers = [
        "id_code",
        "title",
        "description",
        "owner_name",
        "curator_remarks",
        "photo",
        "photo_file",
        "prior_detector",
        "annotation_status",
    ]
    header_fill = PatternFill("solid", fgColor="3A2E1F")
    header_font = Font(color="FFFFFF", bold=True)
    for col, name in enumerate(headers, start=1):
        cell = ws.cell(1, col, name)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(vertical="center")

    ws.freeze_panes = "A2"
    ws.row_dimensions[1].height = 22
    widths = {
        "A": 12,
        "B": 28,
        "C": 48,
        "D": 28,
        "E": 28,
        "F": 22,
        "G": 42,
        "H": 14,
        "I": 18,
    }
    for letter, width in widths.items():
        ws.column_dimensions[letter].width = width

    dv = DataValidation(
        type="list",
        formula1=STATUS_CHOICES,
        allow_blank=False,
        showDropDown=False,
        showErrorMessage=True,
        errorTitle="Annotation status",
        error="Choose Not annotated, In progress, or Annotated.",
    )
    dv.add(f"I2:I{max(len(rows) + 1, 2)}")
    ws.add_data_validation(dv)

    with_photo = 0
    for idx, art in enumerate(rows, start=2):
        code = normalize_id_code(art.id_code) or str(art.id_code or "").strip()
        title = (art.title or "").strip()
        desc = (art.description or "").strip()
        if not title and desc:
            title = desc.split(".")[0][:80]
        photo = _photo_path_for(code, getattr(art, "image_url", "") or "")
        was_prior = "Yes" if code in prior else "No"

        ws.cell(idx, 1, code)
        ws.cell(idx, 2, title)
        ws.cell(idx, 3, desc)
        ws.cell(idx, 4, (art.owner_name or "").strip())
        ws.cell(idx, 5, (getattr(art, "remarks", None) or "").strip())
        ws.cell(idx, 6, "Yes" if photo else "No photo in catalog")
        ws.cell(idx, 7, str(photo) if photo else "")
        ws.cell(idx, 8, was_prior)
        # Fresh Roboflow pass — even prior detector classes start as Not annotated
        status_cell = ws.cell(idx, 9, "Not annotated")
        status_cell.alignment = Alignment(vertical="center")

        ws.row_dimensions[idx].height = 90 if photo else 28
        for col in range(1, 10):
            ws.cell(idx, col).alignment = Alignment(wrap_text=True, vertical="top")

        if photo:
            thumb = _thumb_bytes(photo)
            if thumb is not None:
                xl_img = XLImage(thumb)
                xl_img.width = 120
                xl_img.height = 120
                # Anchor over the photo status cell
                ws.add_image(xl_img, f"F{idx}")
                ws.cell(idx, 6, "")
                with_photo += 1
            else:
                # Fallback: keep path; openpyxl can still embed original if small enough
                try:
                    xl_img = XLImage(str(photo))
                    xl_img.width = 120
                    xl_img.height = 120
                    ws.add_image(xl_img, f"F{idx}")
                    ws.cell(idx, 6, "")
                    with_photo += 1
                except Exception:  # noqa: BLE001
                    pass

    # Legend / instructions sheet
    info = wb.create_sheet("How to use", 0)
    info["A1"] = "Roboflow annotation guide — Sulyap Lasalyano"
    info["A1"].font = Font(bold=True, size=14)
    lines = [
        "",
        "Use sheet “Annotation guide” while labeling classes in Roboflow.",
        "• id_code = class name in Roboflow / Live Scan (must match exactly).",
        "• photo = reference thumbnail from the memorabilia workbook (when export succeeded).",
        "• photo_file = local path under backend/uploads/artifacts/.",
        "• prior_detector = Yes if this id_code was in the previous 47-class model.",
        "• annotation_status = dropdown — mark Annotated when that class is done in Roboflow.",
        "",
        f"Catalog rows: {len(rows)}",
        f"Rows with embedded photo: {with_photo}",
        f"Prior detector classes: {len(prior)}",
        "",
        "Tip: filter annotation_status = Not annotated to see remaining work.",
    ]
    for i, line in enumerate(lines, start=2):
        info[f"A{i}"] = line
    info.column_dimensions["A"].width = 100

    out.parent.mkdir(parents=True, exist_ok=True)
    wb.save(out)
    print(f"Wrote {out} ({len(rows)} rows, {with_photo} photos embedded)")
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()
    build(args.out.resolve())


if __name__ == "__main__":
    main()
