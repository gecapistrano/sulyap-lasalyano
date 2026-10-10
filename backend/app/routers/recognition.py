"""
Hybrid recognition endpoints (scaffold).

Security posture:
- POST endpoint is protected by active user + CSRF checks.
- Request schema is strict (`extra="forbid"` in shared StrictSchema base).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from ..deps import get_current_active_user, verify_csrf_token
from ..models import User
from ..schemas import (
    RecognitionCandidate,
    RecognitionRequest,
    RecognitionResponse,
)
from ..services.labels import load_rd_class_names
from ..services.recognition_service import retrieve_candidates

router = APIRouter(prefix="/recognition", tags=["recognition"])


def _validate_frame_payload(payload: RecognitionRequest) -> None:
    has_data_url = bool(payload.frame_data_url)
    has_base64 = bool(payload.frame_base64)
    if has_data_url == has_base64:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide exactly one of frame_data_url or frame_base64",
        )

    if has_data_url and not payload.frame_data_url.startswith("data:image/"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="frame_data_url must start with data:image/",
        )


@router.get("/classes")
def list_supported_classes() -> dict[str, list[str]]:
    """Public helper endpoint for UI bootstrapping and debug overlays."""
    return {"classes": load_rd_class_names()}


@router.post("/candidates", response_model=RecognitionResponse)
def recognize_candidates(
    payload: RecognitionRequest,
    user: User = Depends(get_current_active_user),
    csrf_checked_user: User = Depends(verify_csrf_token),
) -> RecognitionResponse:
    del user, csrf_checked_user
    _validate_frame_payload(payload)

    retrieved, supported = retrieve_candidates(limit=payload.top_k)
    filtered = [row for row in retrieved if row.score >= payload.min_score]

    return RecognitionResponse(
        status="ok",
        model_version="rd-hybrid-scaffold-v1",
        supported=supported and bool(filtered),
        top_k=payload.top_k,
        min_score=payload.min_score,
        candidates=[
            RecognitionCandidate(
                artifact_id=item.artifact_id,
                label=item.label,
                score=item.score,
                source=item.source,
            )
            for item in filtered
        ],
    )
