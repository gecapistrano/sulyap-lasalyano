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
