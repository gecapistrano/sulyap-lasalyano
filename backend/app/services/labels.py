"""Load trained RD class names for recognition/debug endpoints."""
from functools import lru_cache
from pathlib import Path

_LABELS_CANDIDATES = (
    Path(__file__).resolve().parents[3] / "frontend" / "public" / "models" / "labels.txt",
    Path(__file__).resolve().parents[2] / "data" / "labels.txt",
)


@lru_cache(maxsize=1)
def load_rd_class_names() -> list[str]:
    for path in _LABELS_CANDIDATES:
        if not path.is_file():
            continue
        names = [line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
        if names:
            return names
    return ["RD244", "RD246"]
