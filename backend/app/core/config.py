"""
Typed settings from environment (`backend/.env`). Validates CORS origins and JWT secret in production.

`get_settings()` is cached — call it once per process; tests should clear cache if mutating env.
"""
from functools import lru_cache
from secrets import token_urlsafe

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Sulyap Lasalyano API"
    app_env: str = "development"
    database_url: str = "sqlite:///./sulyap.db"

    jwt_secret_key: str = ""
    jwt_algorithm: str = "HS256"
    access_token_exp_minutes: int = 15
    refresh_token_exp_days: int = 7

    frontend_origins: str = "http://localhost:5173"
    cookie_domain: str | None = None
    cookie_secure: bool = True
    # Cross-site SPA (e.g. Vercel → Render): browsers require SameSite=None + Secure for credentialed API calls.
    cookie_samesite: str = "none"

    rate_limit_login: str = "5/minute"
    rate_limit_search: str = "30/minute"

    @field_validator("frontend_origins")
    @classmethod
    def validate_frontend_origins(cls, value: str) -> str:
        origins = [origin.strip() for origin in value.split(",") if origin.strip()]
        if not origins:
            raise ValueError("At least one frontend origin is required")
        return ",".join(origins)

    @field_validator("cookie_samesite")
    @classmethod
    def validate_cookie_samesite(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in ("strict", "lax", "none"):
            raise ValueError("COOKIE_SAMESITE must be one of: strict, lax, none")
        return normalized

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.frontend_origins.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"

    @model_validator(mode="after")
    def hydrate_jwt_secret(self):
        if self.jwt_secret_key:
            pass
        elif self.is_production:
            raise ValueError("JWT_SECRET_KEY is required in production")
        else:
            self.jwt_secret_key = token_urlsafe(64)

        if self.is_production:
            for origin in self.allowed_origins:
                if origin.startswith("http://") or "localhost" in origin or "127.0.0.1" in origin:
                    raise ValueError("Production FRONTEND_ORIGINS must be explicit HTTPS public origins")

        if self.cookie_samesite == "none" and not self.cookie_secure:
            raise ValueError(
                "SameSite=None requires Secure cookies (HTTPS). "
                "Use COOKIE_SECURE=true for production, or COOKIE_SAMESITE=lax with COOKIE_SECURE=false for local HTTP."
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
