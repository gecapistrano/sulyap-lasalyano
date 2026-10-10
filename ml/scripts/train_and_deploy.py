"""
End-to-end: import (optional) → split → train → export ONNX → deploy to frontend.

Examples:
  # Dataset already at ml/YoloV8_Annotated
  python ml/scripts/train_and_deploy.py

  # Fresh Roboflow zip
  python ml/scripts/train_and_deploy.py --source path/to/roboflow-export.zip

  # Faster smoke train (CPU / sanity check)
  python ml/scripts/train_and_deploy.py --epochs 3 --model yolov8n.pt --batch 4
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = Path(__file__).resolve().parent


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Split + train + export + deploy Live Scan model.")
    p.add_argument("--source", type=Path, default=None, help="Roboflow zip/folder to import first.")
    p.add_argument("--skip-import", action="store_true")
    p.add_argument("--skip-split", action="store_true")
    p.add_argument("--skip-train", action="store_true", help="Only export+deploy existing best.pt")
    p.add_argument("--skip-deploy", action="store_true")
    p.add_argument("--model", type=str, default="yolov8s.pt")
    p.add_argument("--epochs", type=int, default=120)
    p.add_argument("--batch", type=int, default=8)
    p.add_argument("--device", type=str, default="auto")
    p.add_argument("--name", type=str, default="rf_yolov8_det")
    p.add_argument("--train-ratio", type=float, default=0.7)
    p.add_argument("--val-ratio", type=float, default=0.2)
    p.add_argument("--test-ratio", type=float, default=0.1)
    p.add_argument("--seed", type=int, default=42)
    return p.parse_args()


def run(cmd: list[str]) -> None:
    print("\n>>", " ".join(cmd), flush=True)
    subprocess.run(cmd, cwd=str(PROJECT_ROOT), check=True)


def main() -> None:
    args = parse_args()
    py = sys.executable
    data_yaml = PROJECT_ROOT / "ml" / "YoloV8_Annotated" / "data.yaml"
    run_dir = PROJECT_ROOT / "ml" / "runs" / args.name
    best_pt = run_dir / "weights" / "best.pt"

    if args.source and not args.skip_import:
        run(
            [
                py,
                str(SCRIPTS / "import_roboflow_export.py"),
                "--source",
                str(args.source),
                "--force",
            ]
        )

    if not data_yaml.is_file() and not args.skip_train:
        raise SystemExit(
            f"Missing {data_yaml}\n"
            "Download a YOLOv8 Object Detection export from Roboflow, then:\n"
            f"  {py} ml/scripts/train_and_deploy.py --source path/to/export.zip\n"
        )

    if not args.skip_split:
        if not data_yaml.is_file():
            raise SystemExit(f"Cannot split — missing {data_yaml}")
        run(
            [
                py,
                str(SCRIPTS / "split_yolov8_detection.py"),
                "--dataset-root",
                str(PROJECT_ROOT / "ml" / "YoloV8_Annotated"),
                "--train-ratio",
                str(args.train_ratio),
                "--val-ratio",
                str(args.val_ratio),
                "--test-ratio",
                str(args.test_ratio),
                "--seed",
                str(args.seed),
            ]
        )

    if not args.skip_train:
        run(
            [
                py,
                str(SCRIPTS / "train.py"),
                "--data",
                str(data_yaml),
                "--model",
                args.model,
                "--epochs",
                str(args.epochs),
                "--batch",
                str(args.batch),
                "--device",
                args.device,
                "--name",
                args.name,
                "--seed",
                str(args.seed),
            ]
        )

    if not best_pt.is_file():
        # Fall back to previous detection run if present
        legacy = PROJECT_ROOT / "ml" / "runs" / "rf_yolov8n_det" / "weights" / "best.pt"
        if legacy.is_file():
            best_pt = legacy
        else:
            raise SystemExit(f"No best.pt found at {best_pt}")

    onnx_out = best_pt.parent / "model.onnx"
    run(
        [
            py,
            str(SCRIPTS / "export_onnx.py"),
            "--weights",
            str(best_pt),
            "--imgsz",
            "640",
            "--out",
            str(onnx_out),
        ]
    )

    if not args.skip_deploy:
        deploy_cmd = [
            py,
            str(SCRIPTS / "deploy_model.py"),
            "--onnx",
            str(onnx_out),
        ]
        if data_yaml.is_file():
            deploy_cmd.extend(["--data", str(data_yaml)])
        else:
            labels_fallback = PROJECT_ROOT / "frontend" / "public" / "models" / "labels.txt"
            deploy_cmd.extend(["--labels", str(labels_fallback)])
        run(deploy_cmd)

    print("\nDone. Live Scan model updated under frontend/public/models/")


if __name__ == "__main__":
    main()
