"""Admin-only catalog operations. Mutations require CSRF + admin role."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from ..deps import require_roles, verify_csrf_token
from ..models import User
from ..schemas import CatalogSyncOut, CatalogSyncRequest, UserRole
from ..services.catalog_sync import CatalogSyncError, restore_from_settings, run_from_settings

router = APIRouter(prefix="/admin", tags=["admin"])


def _to_out(report) -> CatalogSyncOut:
    payload = report.as_dict()
    return CatalogSyncOut(ok=True, **payload)


@router.post("/catalog/sync", response_model=CatalogSyncOut)
def sync_catalog(
    payload: CatalogSyncRequest,
    user: User = Depends(require_roles(UserRole.admin)),
    csrf_checked_user: User = Depends(verify_csrf_token),
) -> CatalogSyncOut:
    del user, csrf_checked_user
    restore_id = (payload.restore or "").strip() or None
    try:
        if restore_id:
            report = restore_from_settings(
                version_id=restore_id,
                target=payload.target,
                dry_run=payload.dry_run,
            )
        else:
            report = run_from_settings(
                direction=payload.direction,
                dry_run=payload.dry_run,
                apply_deletes=payload.apply_deletes,
            )
    except CatalogSyncError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _to_out(report)
