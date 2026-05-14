"""
evaluate_47class.py — Extract and report all metrics for the YOLOv8n detection model.
Reads training history + final metrics directly from the best.pt checkpoint.
Generates: evaluation report (TXT), results CSV, and training curves plot.

Re-run this script after each new training run — it auto-reads the
checkpoint and adjusts to however many classes the model contains.

Usage:
    python ml/scripts/evaluate_47class.py
    python ml/scripts/evaluate_47class.py --model path/to/best.pt
"""

import argparse
import csv
import os
from pathlib import Path

import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MODEL = PROJECT_ROOT / "ml" / "runs" / "rf_yolov8n_det" / "weights" / "best.pt"


def main():
    parser = argparse.ArgumentParser(description="Evaluate YOLOv8 detection model from checkpoint.")
    parser.add_argument("--model", type=str, default=str(DEFAULT_MODEL), help="Path to best.pt checkpoint")
    args = parser.parse_args()

    MODEL_PATH = Path(args.model)
    from ultralytics import YOLO

    if not MODEL_PATH.exists():
        print(f"ERROR: Model not found at {MODEL_PATH}")
        return

    print(f"Loading model from {MODEL_PATH}...")
    model = YOLO(str(MODEL_PATH))
    ckpt = model.ckpt
    train_args = ckpt.get("train_args", {})
    train_metrics = ckpt.get("train_metrics", {})
    train_results = ckpt.get("train_results", {})

    class_names = list(model.names.values())
    num_classes = len(class_names)

    OUTPUT_DIR = PROJECT_ROOT / "ml" / "evaluation" / f"{num_classes}class"
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Detected {num_classes} classes. Output -> {OUTPUT_DIR}")

    # --- Final best-epoch metrics ---
    precision = train_metrics.get("metrics/precision(B)", 0)
    recall = train_metrics.get("metrics/recall(B)", 0)
    mAP50 = train_metrics.get("metrics/mAP50(B)", 0)
    mAP50_95 = train_metrics.get("metrics/mAP50-95(B)", 0)
    fitness = train_metrics.get("fitness", 0)
    val_box = train_metrics.get("val/box_loss", 0)
    val_cls = train_metrics.get("val/cls_loss", 0)
    val_dfl = train_metrics.get("val/dfl_loss", 0)

    f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0

    epochs = train_results.get("epoch", [])
    total_epochs = max(epochs) if epochs else 0

    report_lines = []
    def p(line=""):
        report_lines.append(line)
        print(line)

    p("=" * 68)
    p(f"  YOLOv8n Detection Model — Full Evaluation Report ({num_classes} Classes)")
    p("=" * 68)
    p()
    p("  MODEL CONFIGURATION")
    p("  " + "-" * 44)
    p(f"  Architecture:     YOLOv8n (nano) — Detection")
    p(f"  Task:             {train_args.get('task', 'detect')}")
    p(f"  Input size:       {train_args.get('imgsz', 640)} x {train_args.get('imgsz', 640)} px")
    p(f"  Number of classes: {num_classes}")
    p(f"  Total epochs:     {total_epochs}")
    p(f"  Batch size:       {train_args.get('batch', 'N/A')}")
    p(f"  Optimizer:        {train_args.get('optimizer', 'N/A')}")
    p(f"  Learning rate:    lr0={train_args.get('lr0', 'N/A')}, lrf={train_args.get('lrf', 'N/A')}")
    p(f"  Patience:         {train_args.get('patience', 'N/A')}")
    p(f"  Seed:             {train_args.get('seed', 'N/A')}")
    p(f"  Device:           GPU (device={train_args.get('device', 'N/A')})")
    p(f"  AMP:              {train_args.get('amp', 'N/A')}")
    p()
    p("  AUGMENTATION")
    p("  " + "-" * 44)
    p(f"  Auto augment:     {train_args.get('auto_augment', 'N/A')}")
    p(f"  Mosaic:           {train_args.get('mosaic', 'N/A')}")
    p(f"  Flip LR:          {train_args.get('fliplr', 'N/A')}")
    p(f"  Scale:            {train_args.get('scale', 'N/A')}")
    p(f"  Erasing:          {train_args.get('erasing', 'N/A')}")
    p(f"  HSV (H/S/V):      {train_args.get('hsv_h', 'N/A')}/{train_args.get('hsv_s', 'N/A')}/{train_args.get('hsv_v', 'N/A')}")
    p()
    p("  CLASSES")
    p("  " + "-" * 44)
    for i, name in enumerate(class_names):
        p(f"  [{i:>2}] {name}")
    p()
    p("=" * 68)
    p("  BEST EPOCH — VALIDATION METRICS")
    p("=" * 68)
    p()
    accuracy = (precision + recall) / 2

    p(f"  Accuracy:           {accuracy:.5f}   ({accuracy*100:.2f}%)")
    p(f"  Precision:          {precision:.5f}   ({precision*100:.2f}%)")
    p(f"  Recall:             {recall:.5f}   ({recall*100:.2f}%)")
    p(f"  F1-Score:           {f1:.5f}   ({f1*100:.2f}%)")
    p()
    p(f"  mAP@0.50:           {mAP50:.5f}   ({mAP50*100:.2f}%)")
    p(f"  mAP@0.50:0.95:      {mAP50_95:.5f}   ({mAP50_95*100:.2f}%)")
    p()
    p(f"  Fitness:            {fitness:.5f}")
    p()
    p("  VALIDATION LOSSES (best epoch)")
    p("  " + "-" * 44)
    p(f"  Box loss:           {val_box:.5f}")
    p(f"  Classification loss: {val_cls:.5f}")
    p(f"  DFL loss:           {val_dfl:.5f}")
    p()

    # --- Epoch-by-epoch summary ---
    prec_hist = train_results.get("metrics/precision(B)", [])
    rec_hist = train_results.get("metrics/recall(B)", [])
    map50_hist = train_results.get("metrics/mAP50(B)", [])
    map5095_hist = train_results.get("metrics/mAP50-95(B)", [])

    p("=" * 68)
    p("  TRAINING PROGRESSION (key epochs)")
    p("=" * 68)
    p(f"  {'Epoch':>6}  {'Accuracy':>10}  {'Precision':>10}  {'Recall':>10}  {'F1':>10}  {'mAP50':>10}  {'mAP50-95':>10}")
    p("  " + "-" * 74)

    milestones = [1, 5, 10, 20, 30, 50, 75, 100]
    for ep_idx, ep in enumerate(epochs):
        if ep in milestones or ep_idx == len(epochs) - 1:
            pr = prec_hist[ep_idx] if ep_idx < len(prec_hist) else 0
            rc = rec_hist[ep_idx] if ep_idx < len(rec_hist) else 0
            acc_ep = (pr + rc) / 2
            f1_ep = 2 * pr * rc / (pr + rc) if (pr + rc) > 0 else 0
            m50 = map50_hist[ep_idx] if ep_idx < len(map50_hist) else 0
            m5095 = map5095_hist[ep_idx] if ep_idx < len(map5095_hist) else 0
            p(f"  {ep:>6}  {acc_ep:>10.4f}  {pr:>10.4f}  {rc:>10.4f}  {f1_ep:>10.4f}  {m50:>10.4f}  {m5095:>10.4f}")

    p()
    p("=" * 68)

    # Save report
    report_path = OUTPUT_DIR / f"evaluation_report_{num_classes}class.txt"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("\n".join(report_lines))
    print(f"\nSaved: {report_path}")

    # Save CSV of full training history
    csv_path = OUTPUT_DIR / f"training_history_{num_classes}class.csv"
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "epoch", "train_box_loss", "train_cls_loss", "train_dfl_loss",
            "accuracy", "precision", "recall", "f1_score", "mAP50", "mAP50_95",
            "val_box_loss", "val_cls_loss", "val_dfl_loss",
        ])
        box_loss = train_results.get("train/box_loss", [])
        cls_loss = train_results.get("train/cls_loss", [])
        dfl_loss = train_results.get("train/dfl_loss", [])
        vbox = train_results.get("val/box_loss", [])
        vcls = train_results.get("val/cls_loss", [])
        vdfl = train_results.get("val/dfl_loss", [])

        for i in range(len(epochs)):
            pr = prec_hist[i] if i < len(prec_hist) else 0
            rc = rec_hist[i] if i < len(rec_hist) else 0
            acc_i = (pr + rc) / 2
            f1_i = 2 * pr * rc / (pr + rc) if (pr + rc) > 0 else 0
            writer.writerow([
                epochs[i],
                round(box_loss[i], 5) if i < len(box_loss) else "",
                round(cls_loss[i], 5) if i < len(cls_loss) else "",
                round(dfl_loss[i], 5) if i < len(dfl_loss) else "",
                round(acc_i, 5),
                round(pr, 5),
                round(rc, 5),
                round(f1_i, 5),
                round(map50_hist[i], 5) if i < len(map50_hist) else "",
                round(map5095_hist[i], 5) if i < len(map5095_hist) else "",
                round(vbox[i], 5) if i < len(vbox) else "",
                round(vcls[i], 5) if i < len(vcls) else "",
                round(vdfl[i], 5) if i < len(vdfl) else "",
            ])
    print(f"Saved: {csv_path}")

    # --- Training Curves Plot ---
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        unique_epochs = sorted(set(epochs))
        ep_to_last_idx = {}
        for i, e in enumerate(epochs):
            ep_to_last_idx[e] = i
        idxs = [ep_to_last_idx[e] for e in unique_epochs]

        fig, axes = plt.subplots(2, 2, figsize=(14, 10))
        fig.suptitle(f"YOLOv8n Detection — {num_classes} Classes Training Curves", fontsize=15, fontweight="bold", y=0.98)

        # Precision, Recall, F1
        ax = axes[0, 0]
        pr_vals = [prec_hist[i] for i in idxs]
        rc_vals = [rec_hist[i] for i in idxs]
        f1_vals = [2*p*r/(p+r) if (p+r) > 0 else 0 for p, r in zip(pr_vals, rc_vals)]
        ax.plot(unique_epochs, pr_vals, label="Precision", color="#8B6914", linewidth=1.5)
        ax.plot(unique_epochs, rc_vals, label="Recall", color="#A0522D", linewidth=1.5)
        ax.plot(unique_epochs, f1_vals, label="F1-Score", color="#CD853F", linewidth=2, linestyle="--")
        ax.set_title("Precision / Recall / F1")
        ax.set_xlabel("Epoch")
        ax.set_ylabel("Score")
        ax.legend()
        ax.grid(True, alpha=0.3)
        ax.set_ylim(0, 1.05)

        # mAP
        ax = axes[0, 1]
        m50_vals = [map50_hist[i] for i in idxs]
        m5095_vals = [map5095_hist[i] for i in idxs]
        ax.plot(unique_epochs, m50_vals, label="mAP@0.50", color="#8B4513", linewidth=1.8)
        ax.plot(unique_epochs, m5095_vals, label="mAP@0.50:0.95", color="#D2691E", linewidth=1.8)
        ax.set_title("mAP Scores")
        ax.set_xlabel("Epoch")
        ax.set_ylabel("mAP")
        ax.legend()
        ax.grid(True, alpha=0.3)
        ax.set_ylim(0, 1.05)

        # Training losses
        ax = axes[1, 0]
        bl = [box_loss[i] for i in idxs]
        cl = [cls_loss[i] for i in idxs]
        dl = [dfl_loss[i] for i in idxs]
        ax.plot(unique_epochs, bl, label="Box Loss", color="#8B6914", linewidth=1.5)
        ax.plot(unique_epochs, cl, label="Cls Loss", color="#A0522D", linewidth=1.5)
        ax.plot(unique_epochs, dl, label="DFL Loss", color="#CD853F", linewidth=1.5)
        ax.set_title("Training Losses")
        ax.set_xlabel("Epoch")
        ax.set_ylabel("Loss")
        ax.legend()
        ax.grid(True, alpha=0.3)

        # Validation losses
        ax = axes[1, 1]
        vb = [vbox[i] for i in idxs]
        vc = [vcls[i] for i in idxs]
        vd = [vdfl[i] for i in idxs]
        ax.plot(unique_epochs, vb, label="Val Box Loss", color="#8B6914", linewidth=1.5)
        ax.plot(unique_epochs, vc, label="Val Cls Loss", color="#A0522D", linewidth=1.5)
        ax.plot(unique_epochs, vd, label="Val DFL Loss", color="#CD853F", linewidth=1.5)
        ax.set_title("Validation Losses")
        ax.set_xlabel("Epoch")
        ax.set_ylabel("Loss")
        ax.legend()
        ax.grid(True, alpha=0.3)

        fig.tight_layout(rect=[0, 0, 1, 0.96])
        plot_path = OUTPUT_DIR / f"training_curves_{num_classes}class.png"
        fig.savefig(plot_path, dpi=150)
        plt.close(fig)
        print(f"Saved: {plot_path}")

        # F1 curve alone
        fig2, ax2 = plt.subplots(figsize=(10, 5))
        ax2.plot(unique_epochs, f1_vals, color="#8B4513", linewidth=2.2)
        ax2.fill_between(unique_epochs, f1_vals, alpha=0.15, color="#D2691E")
        ax2.set_title("F1-Score over Training", fontsize=14, fontweight="bold")
        ax2.set_xlabel("Epoch", fontsize=12)
        ax2.set_ylabel("F1-Score", fontsize=12)
        ax2.set_ylim(0, 1.05)
        ax2.grid(True, alpha=0.3)
        ax2.axhline(y=f1, color="#A0522D", linestyle="--", alpha=0.7, label=f"Best F1 = {f1:.4f}")
        ax2.legend(fontsize=11)
        fig2.tight_layout()
        f1_path = OUTPUT_DIR / f"f1_curve_{num_classes}class.png"
        fig2.savefig(f1_path, dpi=150)
        plt.close(fig2)
        print(f"Saved: {f1_path}")

    except ImportError:
        print("matplotlib not installed — skipping plots")

    print("\nDone!")


if __name__ == "__main__":
    main()
