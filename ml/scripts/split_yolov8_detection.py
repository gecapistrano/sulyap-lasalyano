from __future__ import annotations

import argparse
import random
import shutil
from collections import Counter, defaultdict
from pathlib import Path


IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tif", ".tiff"}
SPLITS = ("train", "valid", "test")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Deterministically split YOLOv8 detection dataset into train/valid/test."
    )
    parser.add_argument(
        "--dataset-root",
        type=Path,
        default=Path("ml/YoloV8_Annotated"),
        help="Root folder containing train/valid/test with images+labels.",
    )
    parser.add_argument("--train-ratio", type=float, default=0.7)
    parser.add_argument("--val-ratio", type=float, default=0.2)
    parser.add_argument("--test-ratio", type=float, default=0.1)
    parser.add_argument("--seed", type=int, default=42)
    return parser.parse_args()


def normalize_ratios(train_ratio: float, val_ratio: float, test_ratio: float) -> tuple[float, float, float]:
    total = train_ratio + val_ratio + test_ratio
    if total <= 0:
        raise ValueError("Ratios must sum to a positive number.")
    return (train_ratio / total, val_ratio / total, test_ratio / total)


def read_classes(label_path: Path) -> set[int]:
    classes: set[int] = set()
    for line in label_path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if not line:
            continue
        parts = line.split()
        classes.add(int(parts[0]))
    return classes


def collect_samples(dataset_root: Path) -> list[dict]:
    samples: list[dict] = []
    seen_stems: set[str] = set()

    for split in SPLITS:
        images_dir = dataset_root / split / "images"
        labels_dir = dataset_root / split / "labels"
        if not images_dir.exists() or not labels_dir.exists():
            continue
        for image_path in images_dir.iterdir():
            if not image_path.is_file() or image_path.suffix.lower() not in IMAGE_EXTS:
                continue
            stem = image_path.stem
            label_path = labels_dir / f"{stem}.txt"
            if not label_path.exists():
                continue
            if stem in seen_stems:
                raise RuntimeError(
                    f"Duplicate sample stem '{stem}' found across splits. "
                    "Please make stems unique before splitting."
                )
            seen_stems.add(stem)
            samples.append(
                {
                    "stem": stem,
                    "image_path": image_path,
                    "label_path": label_path,
                    "classes": read_classes(label_path),
                }
            )

    if not samples:
        raise RuntimeError(f"No image/label pairs found under {dataset_root}.")
    return samples


def split_samples(samples: list[dict], train_ratio: float, val_ratio: float, seed: int) -> dict[str, list[dict]]:
    rng = random.Random(seed)
    rng.shuffle(samples)

    total = len(samples)
    target_train = round(total * train_ratio)
    target_val = round(total * val_ratio)
    target_test = total - target_train - target_val

    targets = {"train": target_train, "valid": target_val, "test": target_test}
    assignments: dict[str, list[dict]] = {"train": [], "valid": [], "test": []}
    class_counts: dict[str, Counter[int]] = {"train": Counter(), "valid": Counter(), "test": Counter()}

    class_to_samples: dict[int, list[dict]] = defaultdict(list)
    for sample in samples:
        for cls_id in sample["classes"]:
            class_to_samples[cls_id].append(sample)

    assigned: set[str] = set()

    # Seed val/test with rare classes first to reduce chances of missing classes.
    for cls_id, cls_samples in sorted(class_to_samples.items(), key=lambda kv: len(kv[1])):
        available = [s for s in cls_samples if s["stem"] not in assigned]
        if not available:
            continue
        choice = rng.choice(available)
        split = "valid" if len(assignments["valid"]) < targets["valid"] else "test"
        if len(assignments[split]) < targets[split]:
            assignments[split].append(choice)
            assigned.add(choice["stem"])
            for c in choice["classes"]:
                class_counts[split][c] += 1

    # Fill remaining by prioritizing underfilled splits while balancing class coverage.
    for sample in samples:
        if sample["stem"] in assigned:
            continue
        deficit_order = sorted(
            SPLITS,
            key=lambda s: (len(assignments[s]) / max(targets[s], 1), len(assignments[s])),
        )
        best_split = deficit_order[0]
        assignments[best_split].append(sample)
        assigned.add(sample["stem"])
        for c in sample["classes"]:
            class_counts[best_split][c] += 1

    return assignments


def write_assignments(dataset_root: Path, assignments: dict[str, list[dict]]) -> None:
    temp_root = dataset_root / "_resplit_tmp"
    if temp_root.exists():
        shutil.rmtree(temp_root)
    for split in SPLITS:
        (temp_root / split / "images").mkdir(parents=True, exist_ok=True)
        (temp_root / split / "labels").mkdir(parents=True, exist_ok=True)

    for split, split_samples in assignments.items():
        for sample in split_samples:
            target_image = temp_root / split / "images" / sample["image_path"].name
            target_label = temp_root / split / "labels" / sample["label_path"].name
            shutil.copy2(sample["image_path"], target_image)
            shutil.copy2(sample["label_path"], target_label)

    for split in SPLITS:
        split_dir = dataset_root / split
        if split_dir.exists():
            shutil.rmtree(split_dir)
        shutil.move(str(temp_root / split), str(split_dir))
    shutil.rmtree(temp_root, ignore_errors=True)


def print_summary(assignments: dict[str, list[dict]]) -> None:
    print("Split summary:")
    for split in SPLITS:
        split_samples = assignments[split]
        classes = Counter()
        for sample in split_samples:
            for cls_id in sample["classes"]:
                classes[cls_id] += 1
        print(
            f"  {split}: images={len(split_samples)} "
            f"classes_present={len(classes)} labels={sum(classes.values())}"
        )


def main() -> None:
    args = parse_args()
    train_ratio, val_ratio, test_ratio = normalize_ratios(
        args.train_ratio, args.val_ratio, args.test_ratio
    )
    dataset_root = args.dataset_root.resolve()
    samples = collect_samples(dataset_root)
    assignments = split_samples(samples, train_ratio=train_ratio, val_ratio=val_ratio, seed=args.seed)
    write_assignments(dataset_root, assignments)
    print_summary(assignments)
    print(
        f"\nDone. Dataset split at {dataset_root} "
        f"with ratios train={train_ratio:.3f}, val={val_ratio:.3f}, test={test_ratio:.3f}."
    )


if __name__ == "__main__":
    main()
