"""
evaluate_test_split.py — Run Ultralytics val() on the held-out TEST split.

Produces metrics that were not used for early stopping / best-epoch selection
(unlike the validation metrics stored inside best.pt).

Usage:
    python ml/scripts/evaluate_test_split.py
    python ml/scripts/evaluate_test_split.py --data ml/YoloV8_Annotated/data.yaml
    python ml/scripts/evaluate_test_split.py --model ml/runs/rf_yolov8n_det/weights/best.pt --data path/to/data.yaml

Requires the YOLO detection dataset (train/valid/test folders) on disk.
"""

from __future__ import annotations

import argparse
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MODEL = PROJECT_ROOT / "ml" / "runs" / "rf_yolov8n_det" / "weights" / "best.pt"
DEFAULT_DATA_CANDIDATES = (
    PROJECT_ROOT / "ml" / "YoloV8_Annotated" / "data.yaml",
    PROJECT_ROOT / "ml" / "YoloV8_Annotated" / "data.yml",
)


def resolve_data_yaml(explicit: str | None, checkpoint_data: str | None) -> Path | None:
    if explicit:
        path = Path(explicit).expanduser().resolve()
        return path if path.is_file() else None
    for candidate in DEFAULT_DATA_CANDIDATES:
        if candidate.is_file():
            return candidate.resolve()
    if checkpoint_data:
        path = Path(checkpoint_data).expanduser()
        if path.is_file():
            return path.resolve()
    return None


def run_test_evaluation(
    model_path: Path,
    data_yaml: Path,
    *,
    imgsz: int = 640,
    batch: int = 16,
    device: str = "",
) -> dict:
    from ultralytics import YOLO

    model = YOLO(str(model_path.resolve()))
    kwargs = {
        "data": str(data_yaml),
        "split": "test",
        "imgsz": imgsz,
        "batch": batch,
        "verbose": False,
    }
    if device:
        kwargs["device"] = device

    results = model.val(**kwargs)
    box = results.box

    precision = float(box.mp)
    recall = float(box.mr)
    mAP50 = float(box.map50)
    mAP50_95 = float(box.map)
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0
    mean_pr = (precision + recall) / 2

    return {
        "data_yaml": str(data_yaml),
        "model_path": str(model_path.resolve()),
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "mean_precision_recall": mean_pr,
        "mAP50": mAP50,
        "mAP50_95": mAP50_95,
        "num_classes": len(model.names),
        "class_names": list(model.names.values()),
        "results_dir": str(Path(results.save_dir)) if getattr(results, "save_dir", None) else "",
    }


def format_test_report(metrics: dict, val_mAP50: float | None = None, val_mAP50_95: float | None = None) -> list[str]:
    lines: list[str] = []
    p = lines.append

    p("=" * 68)
    p(f"  YOLOv8n Detection — HELD-OUT TEST SPLIT ({metrics['num_classes']} Classes)")
    p("=" * 68)
    p()
    p("  NOTE: Test images were not used to pick the best training epoch.")
    p("  Compare these numbers to the VALIDATION block in evaluation_report_*class.txt.")
    p()
    p("  MODEL & DATA")
    p("  " + "-" * 44)
    p(f"  Weights:          {metrics['model_path']}")
    p(f"  data.yaml:        {metrics['data_yaml']}")
    if metrics.get("results_dir"):
        p(f"  Ultralytics out:  {metrics['results_dir']}")
    p()
    p("=" * 68)
    p("  TEST SPLIT METRICS (Ultralytics model.val split='test')")
    p("=" * 68)
    p()
    mp = metrics["mean_precision_recall"]
    p(f"  Mean(P,R):          {mp:.5f}   ({mp * 100:.2f}%)  [not standard top-1 accuracy]")
    p(f"  Precision:          {metrics['precision']:.5f}   ({metrics['precision'] * 100:.2f}%)")
    p(f"  Recall:             {metrics['recall']:.5f}   ({metrics['recall'] * 100:.2f}%)")
    p(f"  F1-Score:           {metrics['f1']:.5f}   ({metrics['f1'] * 100:.2f}%)")
    p()
    p(f"  mAP@0.50:           {metrics['mAP50']:.5f}   ({metrics['mAP50'] * 100:.2f}%)")
    p(f"  mAP@0.50:0.95:      {metrics['mAP50_95']:.5f}   ({metrics['mAP50_95'] * 100:.2f}%)")
    p()

    if val_mAP50 is not None and val_mAP50_95 is not None:
        p("  VALIDATION vs TEST (generalization gap)")
        p("  " + "-" * 44)
        d50 = metrics["mAP50"] - val_mAP50
        d95 = metrics["mAP50_95"] - val_mAP50_95
        p(f"  Val mAP@0.50:       {val_mAP50:.5f}  |  Test: {metrics['mAP50']:.5f}  |  Δ: {d50:+.5f}")
        p(f"  Val mAP@0.50:0.95:  {val_mAP50_95:.5f}  |  Test: {metrics['mAP50_95']:.5f}  |  Δ: {d95:+.5f}")
        if abs(d50) < 0.02 and abs(d95) < 0.02:
            p("  → Small val/test gap suggests limited split leakage / stable generalization on this dataset.")
        elif d50 < -0.05 or d95 < -0.05:
            p("  → Test notably below validation; discuss overfitting or split difficulty in the thesis.")
        p()

    p("=" * 68)
    return lines


def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate YOLOv8 detector on held-out test split.")
    parser.add_argument("--model", type=str, default=str(DEFAULT_MODEL))
    parser.add_argument("--data", type=str, default="", help="Path to data.yaml (train/valid/test roots)")
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--device", type=str, default="", help="e.g. 0 or cpu")
    parser.add_argument(
        "--val-mAP50",
        type=float,
        default=None,
        help="Optional validation mAP@0.50 for comparison table",
    )
    parser.add_argument(
        "--val-mAP50-95",
        type=float,
        default=None,
        help="Optional validation mAP@0.50:0.95 for comparison table",
    )
    args = parser.parse_args()

    model_path = Path(args.model)
    if not model_path.is_file():
        print(f"ERROR: Model not found: {model_path}")
        return 1

    from ultralytics import YOLO

    ckpt_data = None
    try:
        ckpt_data = YOLO(str(model_path)).ckpt.get("train_args", {}).get("data")
    except Exception:
        pass

    data_yaml = resolve_data_yaml(args.data or None, ckpt_data)
    if not data_yaml:
        print("ERROR: data.yaml not found.")
        print("  Place the detection dataset at ml/YoloV8_Annotated/data.yaml")
        print("  or pass: --data path/to/data.yaml")
        if ckpt_data:
            print(f"  (Checkpoint was trained with: {ckpt_data})")
        return 1

    test_root = data_yaml.parent / "test"
    if not test_root.is_dir():
        print(f"ERROR: test split folder missing: {test_root}")
        return 1

    print(f"Model: {model_path}")
    print(f"Data:  {data_yaml}")
    print("Running model.val(split='test')...")

    metrics = run_test_evaluation(
        model_path,
        data_yaml,
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device,
    )

    out_dir = PROJECT_ROOT / "ml" / "evaluation" / f"{metrics['num_classes']}class"
    out_dir.mkdir(parents=True, exist_ok=True)

    lines = format_test_report(metrics, val_mAP50=args.val_mAP50, val_mAP50_95=args.val_mAP50_95)
    report_path = out_dir / f"evaluation_report_{metrics['num_classes']}class_test.txt"
    report_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"\nSaved: {report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
