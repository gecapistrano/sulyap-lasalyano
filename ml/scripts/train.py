"""
Train YOLOv8 detection for the museum Live Scan pipeline.

Museum-tuned defaults:
  - letterbox-friendly 640 input (matches frontend)
  - moderate mosaic / HSV / blur-friendly scale (gallery domain)
  - class-balanced early stopping via patience
  - auto CPU/GPU device selection
"""
from __future__ import annotations

import argparse
from pathlib import Path

import torch
from ultralytics import YOLO

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train YOLOv8 detection model.")
    parser.add_argument("--data", type=Path, default=PROJECT_ROOT / "ml" / "YoloV8_Annotated" / "data.yaml")
    parser.add_argument(
        "--model",
        type=str,
        default="yolov8s.pt",
        help="Base weights (yolov8n.pt faster; yolov8s.pt more accurate).",
    )
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--epochs", type=int, default=120)
    parser.add_argument("--batch", type=int, default=8)
    parser.add_argument(
        "--device",
        type=str,
        default="auto",
        help="'auto', 'cpu', '0', or multi-GPU string.",
    )
    parser.add_argument("--patience", type=int, default=30)
    parser.add_argument("--project", type=Path, default=PROJECT_ROOT / "ml" / "runs")
    parser.add_argument("--name", type=str, default="rf_yolov8_det")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--workers", type=int, default=2)
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Resume last run under --project/--name if present.",
    )
    return parser.parse_args()


def resolve_device(requested: str) -> str | int:
    if requested == "auto":
        return 0 if torch.cuda.is_available() else "cpu"
    if requested.isdigit():
        return int(requested)
    return requested


def main() -> None:
    args = parse_args()
    data = args.data.resolve()
    if not data.is_file():
        raise FileNotFoundError(
            f"Missing {data}\n"
            "Export YOLOv8 Object Detection from Roboflow, then run:\n"
            "  python ml/scripts/import_roboflow_export.py --source path/to/export.zip --force\n"
            "  python ml/scripts/split_yolov8_detection.py --train-ratio 0.7 --val-ratio 0.2 --test-ratio 0.1\n"
        )

    device = resolve_device(args.device)
    if device == "cpu":
        print("WARNING: Training on CPU — expect long runtimes. Use a CUDA GPU when possible.")

    model = YOLO(args.model)
    model.train(
        data=str(data),
        imgsz=args.imgsz,
        epochs=args.epochs,
        batch=args.batch,
        device=device,
        patience=args.patience,
        project=str(args.project.resolve()),
        name=args.name,
        seed=args.seed,
        workers=args.workers,
        exist_ok=True,
        pretrained=True,
        optimizer="auto",
        cos_lr=True,
        amp=device != "cpu",
        # --- museum-oriented augmentations (Ultralytics built-ins) ---
        mosaic=0.8,
        mixup=0.05,
        copy_paste=0.0,
        degrees=8.0,
        translate=0.1,
        scale=0.4,
        shear=0.0,
        perspective=0.0,
        flipud=0.0,
        fliplr=0.5,
        hsv_h=0.015,
        hsv_s=0.55,
        hsv_v=0.4,
        erasing=0.2,
        close_mosaic=20,
        # -------------------------------------------------------------
        resume=args.resume,
    )
    best = args.project.resolve() / args.name / "weights" / "best.pt"
    print(f"\nTraining finished. Best weights: {best}")


if __name__ == "__main__":
    main()
