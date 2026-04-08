"""
Pydantic request/response models. `StrictSchema` forbids unknown fields on every payload.

Keep mutation payloads explicit — security lint and reviews rely on predictable shapes.
"""
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, EmailStr, Field, HttpUrl


class UserRole(str, Enum):
    admin = "admin"
    editor = "editor"
    viewer = "viewer"


class StrictSchema(BaseModel):
    """Base for API bodies: rejects unexpected keys to reduce mass-assignment risk."""

    model_config = ConfigDict(extra="forbid")


class LoginRequest(StrictSchema):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)


class UserPublic(StrictSchema):
    id: int
    email: EmailStr
    role: UserRole
    is_active: bool


class ArtifactCreate(StrictSchema):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=5000)
    image_url: HttpUrl


class ArtifactUpdate(StrictSchema):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    image_url: HttpUrl | None = None


class ArtifactOut(StrictSchema):
    id: int
    owner_id: int
    title: str
    description: str
    image_url: HttpUrl
    created_at: datetime


class RecognitionCandidate(StrictSchema):
    artifact_id: str = Field(min_length=1, max_length=120)
    label: str = Field(min_length=1, max_length=240)
    score: float = Field(ge=0.0, le=1.0)
    source: str = Field(default="unknown", min_length=1, max_length=120)


class RecognitionRequest(StrictSchema):
    """
    Hybrid-scaffold request:
    - send exactly one of `frame_data_url` OR `frame_base64`
    - optional `client_ts` for latency diagnostics
    """

    frame_data_url: str | None = Field(default=None, min_length=50, max_length=6_000_000)
    frame_base64: str | None = Field(default=None, min_length=40, max_length=6_000_000)
    top_k: int = Field(default=5, ge=1, le=20)
    min_score: float = Field(default=0.7, ge=0.0, le=1.0)
    client_ts: int | None = Field(default=None, ge=0)


class RecognitionResponse(StrictSchema):
    status: str = Field(pattern="^(ok)$")
    model_version: str = Field(min_length=1, max_length=80)
    supported: bool
    top_k: int = Field(ge=1, le=20)
    min_score: float = Field(ge=0.0, le=1.0)
    candidates: list[RecognitionCandidate]
