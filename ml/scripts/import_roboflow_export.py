"""
Import a Roboflow YOLOv8 Object Detection export into ml/YoloV8_Annotated.

Accepts either:
  - a .zip from Roboflow (Download → YOLOv8)
  - an already-unzipped folder that contains data.yaml + train|valid|test

Usage:
  python ml/scripts/import_roboflow_export.py --source path/to/export.zip
  python ml/scripts/import_roboflow_export.py --source path/to/unzipped_folder
"""
from __future__ import annotations

import argparse
import shutil
import tempfile
import zipfile
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DEST = PROJECT_ROOT / "ml" / "YoloV8_Annotated"


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Import Roboflow YOLOv8 detection export.")
    p.add_argument("--source", type=Path, required=True, help="Zip or folder from Roboflow.")
    p.add_argument("--dest", type=Path, default=DEFAULT_DEST)
    p.add_argument("--force", action="store_true", help="Replace existing dest if present.")
    return p.parse_args()


def find_dataset_root(root: Path) -> Path:
    """Locate the folder that contains data.yaml (Roboflow nests it sometimes)."""
    direct = root / "data.yaml"
    if direct.is_file():
        return root
    matches = list(root.rglob("data.yaml"))
    if not matches:
        raise FileNotFoundError(f"No data.yaml under {root}")
    # Prefer shallowest match
    matches.sort(key=lambda p: len(p.parts))
    return matches[0].parent


def ensure_split_layout(dataset_root: Path) -> None:
    """Normalize valid/ vs val/ naming for Ultralytics + our split script."""
    # Roboflow uses "valid"; some exports use "val"
    valid = dataset_root / "valid"
    val = dataset_root / "val"
    if val.exists() and not valid.exists():
        val.rename(valid)
    for split in ("train", "valid", "test"):
        images = dataset_root / split / "images"
        labels = dataset_root / split / "labels"
        if (dataset_root / split).exists() and not images.exists():
            # Flat layout: images next to labels at split root — leave as-is if already nested
            pass
        if images.exists() and labels.exists():
            continue
        # Some zips put images directly in train/
        split_dir = dataset_root / split
        if not split_dir.is_dir():
            continue


def copy_tree(src: Path, dest: Path, force: bool) -> None:
    if dest.exists():
        if not force:
            raise FileExistsError(f"{dest} already exists. Pass --force to replace.")
        shutil.rmtree(dest)
    shutil.copytree(src, dest)


def import_from_zip(zip_path: Path, dest: Path, force: bool) -> Path:
    with tempfile.TemporaryDirectory(prefix="rf_yolo_") as tmp:
        tmp_path = Path(tmp)
        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(tmp_path)
        dataset_root = find_dataset_root(tmp_path)
        ensure_split_layout(dataset_root)
        copy_tree(dataset_root, dest, force=force)
    return dest


def import_from_folder(folder: Path, dest: Path, force: bool) -> Path:
    dataset_root = find_dataset_root(folder.resolve())
    ensure_split_layout(dataset_root)
    if dataset_root.resolve() == dest.resolve():
        print(f"Source already at {dest}")
        return dest
    copy_tree(dataset_root, dest, force=force)
    return dest


def main() -> None:
    args = parse_args()
    source = args.source.expanduser().resolve()
    dest = args.dest.expanduser().resolve()
    if not source.exists():
        raise FileNotFoundError(source)

    if source.is_file() and source.suffix.lower() == ".zip":
        out = import_from_zip(source, dest, force=args.force)
    elif source.is_dir():
        out = import_from_folder(source, dest, force=args.force)
    else:
        raise ValueError("--source must be a .zip or a directory")

    yaml_path = out / "data.yaml"
    print(f"Imported dataset → {out}")
    print(f"data.yaml → {yaml_path}")
    # Quick counts
    for split in ("train", "valid", "test"):
        images = out / split / "images"
        n = len(list(images.glob("*"))) if images.is_dir() else 0
        print(f"  {split}: {n} images")


if __name__ == "__main__":
    main()
