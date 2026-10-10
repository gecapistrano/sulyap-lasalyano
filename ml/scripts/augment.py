"""
Augmentation policy for Live Scan training.

We apply augmentations inside Ultralytics (`ml/scripts/train.py`) so boxes stay
aligned with transforms. Do not offline-augment YOLO label files unless you use
a library that rewrites YOLO boxes (e.g. Albumentations with bbox_params).

Museum-oriented defaults (see train.py):
  mosaic=0.8, mixup=0.05, fliplr=0.5, flipud=0.0
  degrees=8, translate=0.1, scale=0.4
  hsv_h/s/v = 0.015 / 0.55 / 0.4, erasing=0.2
  close_mosaic=20 (last epochs train without mosaic for cleaner boxes)

Offline expansion (optional, advanced): capture more gallery phone frames instead —
that usually beats synthetic copies of the same studio shots.
"""
from __future__ import annotations

MUSEUM_DETECT_AUGMENT = {
    "mosaic": 0.8,
    "mixup": 0.05,
    "copy_paste": 0.0,
    "degrees": 8.0,
    "translate": 0.1,
    "scale": 0.4,
    "shear": 0.0,
    "perspective": 0.0,
    "flipud": 0.0,
    "fliplr": 0.5,
    "hsv_h": 0.015,
    "hsv_s": 0.55,
    "hsv_v": 0.4,
    "erasing": 0.2,
    "close_mosaic": 20,
}
