"""Export YOLO detection weights to ONNX (640, opset 12) for the Live Scan SPA."""
from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from ultralytics import YOLO

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export YOLO model to ONNX.")
    parser.add_argument("--weights", type=Path, required=True, help="Path to best.pt")
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--opset", type=int, default=18)
    parser.add_argument("--dynamic", action="store_true")
    parser.add_argument("--half", action="store_true")
    parser.add_argument(
        "--out",
        type=Path,
        default=None,
        help="Optional destination path for the .onnx file (copied after export).",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    weights = args.weights.resolve()
    if not weights.is_file():
        raise FileNotFoundError(weights)

    model = YOLO(str(weights))
    exported = model.export(
        format="onnx",
        imgsz=args.imgsz,
        opset=args.opset,
        dynamic=args.dynamic,
        half=args.half,
        simplify=True,
    )
    exported_path = Path(str(exported)).resolve()
    print(f"Exported ONNX → {exported_path}")

    if args.out:
        out = args.out.resolve()
        out.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(exported_path, out)
        print(f"Copied ONNX → {out}")


if __name__ == "__main__":
    main()
