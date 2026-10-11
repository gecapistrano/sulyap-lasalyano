"""
Pydantic request/response models. `StrictSchema` forbids unknown fields on every payload.
"""
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, EmailStr, Field, HttpUrl


class UserRole(str, Enum):
    admin = "admin"
    editor = "editor"
    viewer = "viewer"


class StrictSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")


class LoginRequest(StrictSchema):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)


class UserPublic(StrictSchema):
    id: int
    email: EmailStr
    role: UserRole
    is_active: bool


class TagOut(StrictSchema):
    slug: str
    label: str
    kind: str
    source: str = "auto"


class ArtifactCreate(StrictSchema):
    title: str = Field(default="", max_length=200)
    description: str = Field(default="", max_length=20000)
    image_url: HttpUrl | str = Field(default="")
    id_code: str = Field(default="", max_length=32)
    owner_name: str = Field(default="", max_length=200)
    year_acquired: str = Field(default="", max_length=32)
    country_of_origin: str = Field(default="", max_length=120)
    artifact_type: str = Field(default="", max_length=120)
    subtitle: str = Field(default="", max_length=200)
    icon: str = Field(default="🏺", max_length=16)
    remarks: str = Field(default="", max_length=10000)
    president_id: int | None = None
    llm_assist_enabled: bool = False
    published: bool = True
    manual_tags: list[str] = Field(default_factory=list, max_length=40)


class ArtifactUpdate(StrictSchema):
    title: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=20000)
    image_url: HttpUrl | str | None = None
    id_code: str | None = Field(default=None, max_length=32)
    owner_name: str | None = Field(default=None, max_length=200)
    year_acquired: str | None = Field(default=None, max_length=32)
    country_of_origin: str | None = Field(default=None, max_length=120)
    artifact_type: str | None = Field(default=None, max_length=120)
    subtitle: str | None = Field(default=None, max_length=200)
    icon: str | None = Field(default=None, max_length=16)
    remarks: str | None = Field(default=None, max_length=10000)
    president_id: int | None = None
    llm_assist_enabled: bool | None = None
    published: bool | None = None
    model_url: str | None = Field(default=None, max_length=500)
    # Full curator-edited tag list (replaces all links when sent).
    tags: list[str] | None = Field(default=None, max_length=40)
    # Legacy alias for `tags` (same replace behavior).
    manual_tags: list[str] | None = Field(default=None, max_length=40)


class ArtifactOut(StrictSchema):
    id: int
    owner_id: int
    title: str
    description: str
    image_url: str
    model_url: str = ""
    id_code: str
    owner_name: str
    year_acquired: str = ""
    country_of_origin: str = ""
    artifact_type: str = ""
    subtitle: str
    icon: str
    remarks: str = ""
    llm_assist_enabled: bool = False
    president_id: int | None = None
    published: bool
    created_at: datetime
    tags: list[TagOut] = Field(default_factory=list)


class CatalogArtifactOut(StrictSchema):
    """Visitor-facing published memorabilia. No curator-only fields."""

    id: int
    id_code: str
    title: str
    description: str
    model_url: str = ""
    owner_name: str
    year_acquired: str = ""
    country_of_origin: str = ""
    artifact_type: str = ""
    subtitle: str
    icon: str
    president_id: int | None = None
    tags: list[TagOut] = Field(default_factory=list)


class CatalogPresidentOut(StrictSchema):
    id: int
    name: str
    service: str
    icon: str
    biography: str = ""
    photo_url: str = ""


class PresidentCreate(StrictSchema):
    name: str = Field(min_length=1, max_length=200)
    service: str = Field(default="", max_length=80)
    icon: str = Field(default="👤", max_length=16)
    biography: str = Field(default="", max_length=20000)
    photo_url: str = Field(default="", max_length=500)
    published: bool = True


class PresidentUpdate(StrictSchema):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    service: str | None = Field(default=None, max_length=80)
    icon: str | None = Field(default=None, max_length=16)
    biography: str | None = Field(default=None, max_length=20000)
    photo_url: str | None = Field(default=None, max_length=500)
    published: bool | None = None


class PresidentOut(StrictSchema):
    id: int
    name: str
    service: str
    icon: str
    biography: str
    photo_url: str
    published: bool


class LlmSuggestOut(StrictSchema):
    title: str | None = None
    year_acquired: str | None = None
    country_of_origin: str | None = None
    artifact_type: str | None = None
    tags: list[str] = Field(default_factory=list)


class LlmApplyRequest(StrictSchema):
    title: str | None = None
    year_acquired: str | None = None
    country_of_origin: str | None = None
    artifact_type: str | None = None
    tags: list[str] = Field(default_factory=list)
    replace_existing: bool = False


class RecognitionCandidate(StrictSchema):
    artifact_id: str = Field(min_length=1, max_length=120)
    label: str = Field(min_length=1, max_length=240)
    score: float = Field(ge=0.0, le=1.0)
    source: str = Field(default="unknown", min_length=1, max_length=120)


class RecognitionRequest(StrictSchema):
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
