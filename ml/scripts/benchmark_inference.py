from __future__ import annotations

import argparse
import statistics
import time
from pathlib import Path

from ultralytics import YOLO


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Benchmark YOLO model inference speed.")
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--device", type=str, default="cpu")
    parser.add_argument("--warmup", type=int, default=3)
    parser.add_argument("--runs", type=int, default=20)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    model = YOLO(str(args.model.resolve()))

    for _ in range(args.warmup):
        model.predict(
            source=str(args.source.resolve()),
            imgsz=args.imgsz,
            device=args.device,
            verbose=False,
            save=False,
        )

    times_ms: list[float] = []
    for _ in range(args.runs):
        start = time.perf_counter()
        model.predict(
            source=str(args.source.resolve()),
            imgsz=args.imgsz,
            device=args.device,
            verbose=False,
            save=False,
        )
        end = time.perf_counter()
        times_ms.append((end - start) * 1000)

    print(f"model={args.model}")
    print(f"device={args.device}")
    print(f"runs={args.runs}")
    print(f"avg_ms={statistics.mean(times_ms):.2f}")
    print(f"p50_ms={statistics.median(times_ms):.2f}")
    print(f"min_ms={min(times_ms):.2f}")
    print(f"max_ms={max(times_ms):.2f}")


if __name__ == "__main__":
    main()
