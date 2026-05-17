# ML Workspace Notes

This folder contains ML pipeline code and lightweight tracked assets.

## Tracked

- `scripts/` — training/export/data-prep scripts
- `weights/classes.txt` — class labels

## Not tracked (generated/local)

- `YoloV8_Annotated/` — detection dataset (`train/`, `valid/`, `test/`, `data.yaml`)
- `yolov8_cls_data/` — prepared train/val/test image splits
- `runs/` — Ultralytics training outputs/checkpoints
- `evaluation/` — local prediction/metrics exports
- `*.pt`, `*.onnx` — model weight binaries

## Evaluation (validation + held-out test)

Validation metrics (best epoch) are extracted from `best.pt`:

```bash
python ml/scripts/evaluate_47class.py
```

Held-out **test** mAP (not used during training selection) requires the dataset on disk:

```bash
python ml/scripts/evaluate_test_split.py --data ml/YoloV8_Annotated/data.yaml
```

Or both in one pass:

```bash
python ml/scripts/evaluate_47class.py --data ml/YoloV8_Annotated/data.yaml
```

Outputs:

- `ml/evaluation/47class/evaluation_report_47class.txt` — validation + test (if dataset present)
- `ml/evaluation/47class/evaluation_report_47class_test.txt` — test-only report
- `ml/evaluation/47class/val_vs_test_47class.csv` — side-by-side comparison

If you need to share a model artifact, publish it in a release or object storage and reference it in docs instead of committing binaries directly.
