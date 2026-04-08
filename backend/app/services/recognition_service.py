"""
Recognition service scaffolding for hybrid CV pipeline.

Current behavior is deterministic mock output to unblock API/frontend wiring.
Replace internals with:
1) embedding extraction from input frame,
2) ANN/vector retrieval,
3) optional reranker/classifier.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True, frozen=True)
class Candidate:
    artifact_id: str
    label: str
    score: float
    source: str = "mock-index-v1"


MOCK_CANDIDATES = (
    Candidate(artifact_id="RD242-243", label="RD242-243", score=0.91),
    Candidate(artifact_id="RD244", label="RD244", score=0.88),
)


def retrieve_candidates(*, limit: int) -> tuple[list[Candidate], bool]:
    """
    Returns top-k candidates and `supported` flag.

    `supported=False` means the scanned item is not confidently retrievable and frontend
    should continue scanning / show fallback UI.
    """
    if limit <= 0:
        return [], False
    candidates = list(MOCK_CANDIDATES[:limit])
    supported = bool(candidates)
    return candidates, supported
