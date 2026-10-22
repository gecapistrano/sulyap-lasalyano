"""
Copy trained detection ONNX + class labels into hall/models/
so Live Scan picks them up on the next refresh.
"""
from __future__ import annotations

import argparse
import shutil
from pathlib import Path

import yaml

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SCAN_MODELS = PROJECT_ROOT / "hall" / "models"
WEIGHTS_CLASSES = PROJECT_ROOT / "ml" / "weights" / "classes.txt"


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Deploy ONNX + labels to the Live Scan site.")
    p.add_argument("--onnx", type=Path, required=True, help="Path to model.onnx")
    p.add_argument(
        "--data",
        type=Path,
        default=PROJECT_ROOT / "ml" / "YoloV8_Annotated" / "data.yaml",
        help="data.yaml used to sync labels.txt class order",
    )
    p.add_argument(
        "--labels",
        type=Path,
        default=None,
        help="Optional labels.txt to copy as-is (overrides --data names).",
    )
    return p.parse_args()


def names_from_yaml(data_yaml: Path) -> list[str]:
    payload = yaml.safe_load(data_yaml.read_text(encoding="utf-8"))
    names = payload.get("names")
    if isinstance(names, dict):
        return [str(names[i]) for i in sorted(names, key=lambda k: int(k))]
    if isinstance(names, list):
        return [str(n) for n in names]
    raise ValueError(f"Could not read class names from {data_yaml}")


def write_labels(labels: list[str], dest: Path) -> None:
    text = "\n".join(labels) + "\n"
    dest.write_text(text, encoding="utf-8")
    WEIGHTS_CLASSES.parent.mkdir(parents=True, exist_ok=True)
    WEIGHTS_CLASSES.write_text(text, encoding="utf-8")


def main() -> None:
    args = parse_args()
    onnx_src = args.onnx.resolve()
    if not onnx_src.is_file():
        raise FileNotFoundError(onnx_src)

    SCAN_MODELS.mkdir(parents=True, exist_ok=True)
    onnx_dest = SCAN_MODELS / "model.onnx"
    shutil.copy2(onnx_src, onnx_dest)

    labels_dest = SCAN_MODELS / "labels.txt"
    if args.labels and args.labels.is_file():
        labels = [
            line.strip()
            for line in args.labels.read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]
    elif args.data.is_file():
        labels = names_from_yaml(args.data.resolve())
    else:
        labels = [
            line.strip()
            for line in (SCAN_MODELS / "labels.txt").read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]

    write_labels(labels, labels_dest)
    print(f"Deployed ONNX → {onnx_dest} ({onnx_dest.stat().st_size} bytes)")
    print(f"Deployed labels → {labels_dest} ({len(labels)} classes)")
    print("Hard-refresh Live Scan so it loads the new weights.")


if __name__ == "__main__":
    main()
