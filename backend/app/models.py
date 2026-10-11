"""
SQLAlchemy ORM models: users, presidents, artifacts, tags, refresh tokens.
"""
from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(32), default="viewer", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    artifacts: Mapped[list["Artifact"]] = relationship(back_populates="owner")
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(back_populates="user")


class President(Base):
    """DLSU Presidents catalog — curator-editable, visitor-facing when published."""

    __tablename__ = "presidents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False, index=True)
    service: Mapped[str] = mapped_column(String(80), default="", nullable=False)
    icon: Mapped[str] = mapped_column(String(16), default="👤", nullable=False)
    biography: Mapped[str] = mapped_column(Text, default="", nullable=False)
    photo_url: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    published: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    artifacts: Mapped[list["Artifact"]] = relationship(back_populates="president")


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    kind: Mapped[str] = mapped_column(String(40), default="theme", nullable=False, index=True)

    artifact_links: Mapped[list["ArtifactTag"]] = relationship(back_populates="tag")


class ArtifactTag(Base):
    __tablename__ = "artifact_tags"

    artifact_id: Mapped[int] = mapped_column(ForeignKey("artifacts.id", ondelete="CASCADE"), primary_key=True)
    tag_id: Mapped[int] = mapped_column(ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True)
    source: Mapped[str] = mapped_column(String(16), primary_key=True, default="auto")

    artifact: Mapped["Artifact"] = relationship(back_populates="tag_links")
    tag: Mapped[Tag] = relationship(back_populates="artifact_links")


class Artifact(Base):
    __tablename__ = "artifacts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    image_url: Mapped[str] = mapped_column(String(500), nullable=False)
    model_url: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    id_code: Mapped[str] = mapped_column(String(32), default="", nullable=False, index=True)
    owner_name: Mapped[str] = mapped_column(String(200), default="", nullable=False, index=True)
    year_acquired: Mapped[str] = mapped_column(String(32), default="", nullable=False, index=True)
    # Legacy column kept for older DBs / seed SQL until fully dropped.
    year: Mapped[str] = mapped_column(String(32), default="", nullable=False)
    country_of_origin: Mapped[str] = mapped_column(String(120), default="", nullable=False, index=True)
    artifact_type: Mapped[str] = mapped_column(String(120), default="", nullable=False, index=True)
    subtitle: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    icon: Mapped[str] = mapped_column(String(16), default="🏺", nullable=False)
    remarks: Mapped[str] = mapped_column(Text, default="", nullable=False)
    llm_assist_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    president_id: Mapped[int | None] = mapped_column(ForeignKey("presidents.id"), nullable=True, index=True)
    published: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    owner: Mapped["User"] = relationship(back_populates="artifacts")
    president: Mapped["President | None"] = relationship(back_populates="artifacts")
    tag_links: Mapped[list[ArtifactTag]] = relationship(
        back_populates="artifact", cascade="all, delete-orphan"
    )


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    token_id: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    replaced_by: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    user: Mapped["User"] = relationship(back_populates="refresh_tokens")
