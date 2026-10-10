# ML Workspace — Live Scan detection

Train a YOLOv8 detector in Roboflow → Ultralytics, then deploy ONNX into the SPA.

## Tracked

- `scripts/` — import / split / train / export / deploy
- `weights/classes.txt` — class labels (kept in sync on deploy)

## Not tracked (local)

- `YoloV8_Annotated/` — detection dataset (`train/`, `valid/`, `test/`, `data.yaml`)
- `runs/` — Ultralytics checkpoints
- `*.pt`, `*.onnx` under `runs/`

## One-command pipeline (recommended)

1. In **Roboflow** → your detection project → **Export** → format **YOLOv8** → download `.zip`.
2. From the repo root:

```bash
python ml/scripts/train_and_deploy.py --source path/to/roboflow-export.zip
```

That will:

1. Import into `ml/YoloV8_Annotated/`
2. **Resplit** train/valid/test **70 / 20 / 10** (class-aware)
3. **Train** YOLOv8s @ 640 with museum augmentations
4. **Export** ONNX
5. **Deploy** to `frontend/public/models/model.onnx` + `labels.txt`

Hard-refresh the browser after deploy.

### Useful flags

```bash
# GPU id 0 (default auto)
python ml/scripts/train_and_deploy.py --source export.zip --device 0 --batch 16

# Faster / smaller model
python ml/scripts/train_and_deploy.py --source export.zip --model yolov8n.pt --epochs 80

# Dataset already imported — only resplit + train + deploy
python ml/scripts/train_and_deploy.py

# Re-export + deploy an existing best.pt without retraining
python ml/scripts/train_and_deploy.py --skip-split --skip-train --name rf_yolov8n_det
```

## Step-by-step (same pipeline, manual)

```bash
python ml/scripts/import_roboflow_export.py --source export.zip --force
python ml/scripts/split_yolov8_detection.py --train-ratio 0.7 --val-ratio 0.2 --test-ratio 0.1
python ml/scripts/train.py --model yolov8s.pt --epochs 120 --batch 8
python ml/scripts/export_onnx.py --weights ml/runs/rf_yolov8_det/weights/best.pt --out ml/runs/rf_yolov8_det/weights/model.onnx
python ml/scripts/deploy_model.py --onnx ml/runs/rf_yolov8_det/weights/model.onnx
```

## Evaluation

```bash
python ml/scripts/evaluate_47class.py --data ml/YoloV8_Annotated/data.yaml
python ml/scripts/evaluate_test_split.py --data ml/YoloV8_Annotated/data.yaml
```

## Notes

- Class names in Roboflow must match Live Scan codes (`RD244`, …). Order in `data.yaml` becomes `labels.txt`.
- Prefer gallery phone footage in the Roboflow dataset; studio-only data overfits.
- This machine may be **CPU-only** — full 120-epoch trains are slow; use a CUDA GPU when possible.
