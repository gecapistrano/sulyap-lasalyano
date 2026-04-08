# ML Workspace Notes

This folder contains ML pipeline code and lightweight tracked assets.

## Tracked

- `scripts/` — training/export/data-prep scripts
- `weights/classes.txt` — class labels

## Not tracked (generated/local)

- `yolov8_cls_data/` — prepared train/val/test image splits
- `runs/` — Ultralytics training outputs/checkpoints
- `evaluation/` — local prediction/metrics exports
- `*.pt`, `*.onnx` — model weight binaries

If you need to share a model artifact, publish it in a release or object storage and reference it in docs instead of committing binaries directly.
