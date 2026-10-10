"""
SQLAlchemy engine and session factory. `get_db` yields a request-scoped session for FastAPI dependencies.

Supports local SQLite and hosted Postgres (including Supabase). Paste a Supabase URI as
`DATABASE_URL`; `postgresql://` / `postgres://` are normalized to the psycopg driver.
Passwords with `@`, `[`, `]`, etc. are percent-encoded automatically.
"""
from collections.abc import Generator
from urllib.parse import quote, unquote, urlparse, urlunparse

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from .config import get_settings

settings = get_settings()


def _encode_url_password(url: str) -> str:
    """Percent-encode userinfo password so characters like `@` do not break host parsing."""
    parsed = urlparse(url)
    if not parsed.scheme or not parsed.hostname:
        # Fallback for odd forms: split on last @ before path
        if "://" not in url or "@" not in url:
            return url
        scheme, rest = url.split("://", 1)
        userinfo, hostpart = rest.rsplit("@", 1)
        if ":" not in userinfo:
            return url
        user, password = userinfo.split(":", 1)
        encoded = quote(unquote(password), safe="")
        return f"{scheme}://{user}:{encoded}@{hostpart}"

    username = unquote(parsed.username or "")
    password = unquote(parsed.password or "") if parsed.password is not None else None
    if password is None and parsed.username is None:
        return url

    host = parsed.hostname or ""
    netloc = host
    if parsed.port:
        netloc = f"{host}:{parsed.port}"
    if username or password is not None:
        user_enc = quote(username, safe="")
        if password is not None:
            netloc = f"{user_enc}:{quote(password, safe='')}@{netloc}"
        else:
            netloc = f"{user_enc}@{netloc}"
    return urlunparse(
        (parsed.scheme, netloc, parsed.path, parsed.params, parsed.query, parsed.fragment)
    )


def normalize_database_url(url: str) -> str:
    """Accept Supabase/Postgres URIs and force the SQLAlchemy psycopg driver."""
    normalized = url.strip()
    if normalized.startswith("postgres://"):
        normalized = "postgresql+psycopg://" + normalized[len("postgres://") :]
    elif normalized.startswith("postgresql://"):
        normalized = "postgresql+psycopg://" + normalized[len("postgresql://") :]
    elif normalized.startswith("postgresql+psycopg2://"):
        normalized = "postgresql+psycopg://" + normalized[len("postgresql+psycopg2://") :]

    if not normalized.startswith("sqlite"):
        # urlparse stops at the first `@`, so recover passwords that contain `@`.
        if normalized.count("@") > 1:
            scheme, rest = normalized.split("://", 1)
            userinfo, hostpart = rest.rsplit("@", 1)
            if ":" in userinfo:
                user, password = userinfo.split(":", 1)
                normalized = f"{scheme}://{user}:{quote(unquote(password), safe='')}@{hostpart}"
            else:
                normalized = f"{scheme}://{userinfo}@{hostpart}"
        else:
            normalized = _encode_url_password(normalized)

    host_hint = normalized.lower()
    if ("supabase.co" in host_hint or "supabase.com" in host_hint) and "sslmode=" not in host_hint:
        normalized += ("&" if "?" in normalized else "?") + "sslmode=require"
    return normalized


def _sqlite_add_missing_columns(engine) -> None:
    """Add catalog columns on existing local SQLite files (create_all does not ALTER)."""
    if not settings.database_url.startswith("sqlite"):
        return
    extras = {
        "rd_code": "VARCHAR(32) DEFAULT '' NOT NULL",
        "owner_name": "VARCHAR(200) DEFAULT '' NOT NULL",
        "year": "VARCHAR(32) DEFAULT '' NOT NULL",
        "subtitle": "VARCHAR(200) DEFAULT '' NOT NULL",
        "icon": "VARCHAR(16) DEFAULT '🏺' NOT NULL",
        "published": "BOOLEAN DEFAULT 1 NOT NULL",
        "model_url": "VARCHAR(500) DEFAULT '' NOT NULL",
    }
    with engine.connect() as conn:
        existing = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(artifacts)").fetchall()}
        if not existing:
            return
        for name, ddl in extras.items():
            if name not in existing:
                conn.exec_driver_sql(f"ALTER TABLE artifacts ADD COLUMN {name} {ddl}")
        conn.commit()


def _postgres_add_missing_columns(engine) -> None:
    """Add newer catalog columns on existing Supabase/Postgres databases."""
    url = settings.database_url.lower()
    if not (url.startswith("postgres") or "postgresql" in url):
        return
    with engine.connect() as conn:
        conn.exec_driver_sql(
            "ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS model_url VARCHAR(500) NOT NULL DEFAULT ''"
        )
        conn.commit()


_database_url = normalize_database_url(settings.database_url)
_is_sqlite = _database_url.startswith("sqlite")

engine = create_engine(
    _database_url,
    connect_args={"check_same_thread": False} if _is_sqlite else {},
    pool_pre_ping=not _is_sqlite,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
