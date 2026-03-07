from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List
from ..database import get_db
from .. import models, schemas, crud
from ..auth import hash_password
from ..deps import get_admin_user

router = APIRouter(prefix="/admin", tags=["admin"])


class AdminUserOut(schemas.UserOut):
    storage_bytes: int
    storage_mb: float
    registration_ip: str | None


@router.get("/users", response_model=List[AdminUserOut])
def list_users(
    db: Session = Depends(get_db),
    _admin: models.User = Depends(get_admin_user),
):
    users = db.query(models.User).order_by(models.User.created_at).all()
    result = []
    for u in users:
        used = crud.get_user_storage_bytes(db, u.id)
        result.append(AdminUserOut(
            **schemas.UserOut.model_validate(u).model_dump(),
            storage_bytes=used,
            storage_mb=round(used / 1024 / 1024, 2),
            registration_ip=u.registration_ip,
        ))
    return result


@router.put("/users/{user_id}", response_model=schemas.UserOut)
def update_user(
    user_id: str,
    body: schemas.AdminUserUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_admin_user),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent removing own admin status
    if user.id == admin.id and body.is_admin is False:
        raise HTTPException(status_code=400, detail="Cannot remove your own admin status")

    if body.is_active is not None:
        user.is_active = body.is_active
    if body.memory_limit_mb is not None:
        user.memory_limit_mb = body.memory_limit_mb if body.memory_limit_mb > 0 else None
    if body.is_admin is not None:
        user.is_admin = body.is_admin
    if body.password:
        user.password_hash = hash_password(body.password)

    db.commit()
    db.refresh(user)
    return schemas.UserOut.model_validate(user)


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_admin_user),
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()


@router.get("/settings", response_model=schemas.SiteSettingsOut)
def get_settings(
    db: Session = Depends(get_db),
    _admin: models.User = Depends(get_admin_user),
):
    s = db.query(models.SiteSettings).filter(models.SiteSettings.id == "main").first()
    if not s:
        s = models.SiteSettings(id="main")
        db.add(s); db.commit(); db.refresh(s)
    return schemas.SiteSettingsOut.model_validate(s)


@router.put("/settings", response_model=schemas.SiteSettingsOut)
def update_settings(
    body: schemas.SiteSettingsUpdate,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(get_admin_user),
):
    s = db.query(models.SiteSettings).filter(models.SiteSettings.id == "main").first()
    if not s:
        s = models.SiteSettings(id="main")
        db.add(s)

    if body.default_language is not None: s.default_language = body.default_language
    if body.default_memory_limit_mb is not None: s.default_memory_limit_mb = max(1, body.default_memory_limit_mb)
    if body.site_icon_b64 is not None: s.site_icon_b64 = body.site_icon_b64 or None
    if body.site_title is not None: s.site_title = body.site_title or "OSINT Graph Platform"
    if body.registration_enabled is not None: s.registration_enabled = body.registration_enabled
    if body.max_accounts_per_ip is not None: s.max_accounts_per_ip = max(1, body.max_accounts_per_ip)
    s.updated_at = datetime.utcnow()

    db.commit(); db.refresh(s)
    return schemas.SiteSettingsOut.model_validate(s)


@router.get("/settings/public", response_model=schemas.SiteSettingsOut)
def get_public_settings(db: Session = Depends(get_db)):
    """Public endpoint — returns site settings without auth (for login page)."""
    s = db.query(models.SiteSettings).filter(models.SiteSettings.id == "main").first()
    if not s:
        s = models.SiteSettings(id="main")
        db.add(s); db.commit(); db.refresh(s)
    return schemas.SiteSettingsOut.model_validate(s)
