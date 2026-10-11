"""
FastAPI application entry: CORS, rate limiting, security headers, and router registration.

Run with uvicorn (see `backend/README.md`). Creates tables on startup via SQLAlchemy metadata
(SQLite locally, or Supabase/Postgres when `DATABASE_URL` points there).
"""
import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from .core.config import get_settings
from .core.rate_limit import limiter
from .core.database import (
    Base,
    SessionLocal,
    _postgres_add_missing_columns,
    _sqlite_add_missing_columns,
    engine,
)
from .routers import artifacts, auth, catalog, presidents, recognition
from .services.catalog_seed import seed_catalog_if_empty
from .services.model_uploads import ensure_upload_dir
from .services.photo_uploads import ensure_photo_dir

settings = get_settings()
logger = logging.getLogger("sulyap.security")
logging.basicConfig(level=logging.INFO)
logger.info("CORS allow_origins=%s", settings.allowed_origins)

Base.metadata.create_all(bind=engine)
_sqlite_add_missing_columns(engine)
_postgres_add_missing_columns(engine)
with SessionLocal() as _seed_db:
    seed_catalog_if_empty(_seed_db)

_uploads_dir = ensure_upload_dir()
ensure_photo_dir()

# redirect_slashes=False avoids 307 /artifacts -> /artifacts/ which breaks
# credentialed cross-origin fetch (cookies dropped on the redirected request).
app = FastAPI(title=settings.app_name, redirect_slashes=False)
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With", "X-CSRF-Token"],
)


@app.middleware("http")
async def set_security_headers(request: Request, call_next):
    """Apply baseline security headers on every response (CSP, frame denial, etc.)."""
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(self), microphone=(), geolocation=()"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self'; "
        "img-src 'self' data: https:; "
        "font-src 'self'; "
        "connect-src 'self'; "
        "media-src 'self'; "
        "object-src 'none'; "
        "frame-ancestors 'none'; "
        "base-uri 'self';"
    )
    if settings.is_production:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
    return response


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):  # noqa: ARG001
    logger.info("Validation error on %s", request.url.path)
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Invalid request payload"},
    )


@app.exception_handler(RateLimitExceeded)
async def ratelimit_handler(request: Request, exc: RateLimitExceeded):  # noqa: ARG001
    return JSONResponse(status_code=status.HTTP_429_TOO_MANY_REQUESTS, content={"detail": "Rate limit exceeded"})


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s", request.url.path, exc_info=exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Unexpected server error"},
    )


@app.get("/health")
def healthcheck():
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(artifacts.router)
app.include_router(catalog.router)
app.include_router(presidents.router)
app.include_router(recognition.router)
app.mount("/media/models", StaticFiles(directory=str(_uploads_dir)), name="artifact_models")

