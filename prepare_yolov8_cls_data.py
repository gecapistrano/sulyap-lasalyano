from __future__ import annotations

import random
import shutil
from pathlib import Path


SOURCE_ROOT = Path(r"C:\Users\Justine\Documents\Images_Archive")
OUTPUT_ROOT = Path(r"C:\Users\Justine\Documents\Cursor\yolov8_cls_data")
SPLITS = {"train": 0.7, "val": 0.2, "test": 0.1}
SEED = 42
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def main() -> None:
    random.seed(SEED)
    class_dirs = [p for p in SOURCE_ROOT.iterdir() if p.is_dir()]
    if not class_dirs:
        raise RuntimeError(f"No class folders found in: {SOURCE_ROOT}")

    if OUTPUT_ROOT.exists():
        shutil.rmtree(OUTPUT_ROOT)

    for split in SPLITS:
        for class_dir in class_dirs:
            (OUTPUT_ROOT / split / class_dir.name).mkdir(parents=True, exist_ok=True)

    print(f"Found classes: {[p.name for p in class_dirs]}")
    for class_dir in class_dirs:
        images = [
            p
            for p in class_dir.iterdir()
            if p.is_file() and p.suffix.lower() in IMAGE_EXTS
        ]
        if len(images) < 3:
            raise RuntimeError(
                f"Class '{class_dir.name}' has only {len(images)} supported images."
            )

        random.shuffle(images)
        n = len(images)
        n_train = max(1, int(n * SPLITS["train"]))
        n_val = max(1, int(n * SPLITS["val"]))
        n_test = n - n_train - n_val
        if n_test < 1:
            n_test = 1
            n_train = max(1, n_train - 1)

        chunks = {
            "train": images[:n_train],
            "val": images[n_train : n_train + n_val],
            "test": images[n_train + n_val :],
        }

        for split, files in chunks.items():
            for src in files:
                dst = OUTPUT_ROOT / split / class_dir.name / src.name
                shutil.copy2(src, dst)

        print(
            f"{class_dir.name}: total={n}, "
            f"train={len(chunks['train'])}, val={len(chunks['val'])}, test={len(chunks['test'])}"
        )

    print(f"\nPrepared dataset at: {OUTPUT_ROOT}")
    print(f"Use this path with YOLO classify: data={OUTPUT_ROOT}")


if __name__ == "__main__":
    main()
