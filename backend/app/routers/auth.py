from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from datetime import datetime
from ..database import get_db
from .. import models, schemas, crud
from ..auth import hash_password, verify_password, create_access_token
from ..deps import get_current_user
from ..encryption import generate_salt, derive_key

router = APIRouter(prefix="/auth", tags=["auth"])


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("X-Forwarded-For")
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "unknown")


def _seed_builtins(db: Session, user_id: str):
    from ..main import _seed_builtin_schemas
    _seed_builtin_schemas(db, user_id)


@router.post("/register", response_model=schemas.TokenResponse, status_code=201)
def register(request: Request, body: schemas.RegisterRequest, db: Session = Depends(get_db)):
    settings = db.query(models.SiteSettings).filter(models.SiteSettings.id == "main").first()
    if settings and not settings.registration_enabled:
        raise HTTPException(403, "Registration is disabled")
    if db.query(models.User).filter(models.User.username == body.username).first():
        raise HTTPException(409, "Username already taken")
    if body.email and db.query(models.User).filter(models.User.email == body.email).first():
        raise HTTPException(409, "Email already registered")
    ip = _client_ip(request)
    max_per_ip = settings.max_accounts_per_ip if settings else 3
    if db.query(models.User).filter(models.User.registration_ip == ip).count() >= max_per_ip:
        raise HTTPException(429, f"Maximum {max_per_ip} accounts per IP")
    import uuid
    user = models.User(
        id=str(uuid.uuid4()), username=body.username, email=body.email,
        password_hash=hash_password(body.password), enc_salt=generate_salt(),
        registration_ip=ip, session_lifetime_hours=168,
    )
    db.add(user); db.commit(); db.refresh(user)
    _seed_builtins(db, user.id)
    token = create_access_token(user.id, user.username, user.is_admin, user.session_lifetime_hours)
    return schemas.TokenResponse(access_token=token, user=schemas.UserOut.model_validate(user))


@router.post("/login", response_model=schemas.TokenResponse)
def login(body: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == body.username).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")
    if not user.is_active:
        raise HTTPException(403, "Account is disabled")
    user.last_login = datetime.utcnow()
    existing_builtins = db.query(models.EntityTypeSchema).filter(
        models.EntityTypeSchema.user_id == user.id,
        models.EntityTypeSchema.is_builtin == True,
    ).count()
    if existing_builtins == 0:
        _seed_builtins(db, user.id)
    db.commit()
    token = create_access_token(user.id, user.username, user.is_admin, user.session_lifetime_hours)
    return schemas.TokenResponse(access_token=token, user=schemas.UserOut.model_validate(user))


@router.get("/me", response_model=schemas.UserOut)
def get_me(current_user: models.User = Depends(get_current_user)):
    return schemas.UserOut.model_validate(current_user)


@router.put("/me", response_model=schemas.UserOut)
def update_me(
    body: schemas.UserUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.password:
        if not body.current_password:
            raise HTTPException(400, "current_password required")
        if not verify_password(body.current_password, current_user.password_hash):
            raise HTTPException(400, "Current password is incorrect")
        old_key = crud._get_enc_key(current_user)
        new_pw_hash = hash_password(body.password)
        new_salt = generate_salt()
        current_user.password_hash = new_pw_hash
        current_user.enc_salt = new_salt
        db.flush()
        new_key = derive_key(new_pw_hash, new_salt)
        crud.reencrypt_user_data(db, current_user, old_key, new_key)
    if body.username and body.username != current_user.username:
        if db.query(models.User).filter(models.User.username == body.username).first():
            raise HTTPException(409, "Username already taken")
        current_user.username = body.username
    if body.email is not None:
        if body.email and body.email != current_user.email:
            if db.query(models.User).filter(models.User.email == body.email).first():
                raise HTTPException(409, "Email already registered")
        current_user.email = body.email or None
    if body.session_lifetime_hours is not None:
        current_user.session_lifetime_hours = max(1, min(body.session_lifetime_hours, 8760))
    db.commit(); db.refresh(current_user)
    return schemas.UserOut.model_validate(current_user)


@router.get("/me/storage", response_model=schemas.StorageInfo)
def get_storage(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    used = crud.get_user_storage_bytes(db, current_user.id)
    limit_mb = crud.get_user_effective_limit_mb(db, current_user)
    limit_bytes = limit_mb * 1024 * 1024
    return schemas.StorageInfo(
        used_bytes=used, used_mb=round(used / 1024 / 1024, 2), limit_mb=limit_mb,
        percent=round(min(used / limit_bytes * 100, 100), 1) if limit_bytes > 0 else 0,
    )


@router.delete("/me/data", status_code=204)
def reset_my_data(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete all user data (entities, relationships, groups, schemas) but keep the account."""
    uid = current_user.id
    # Delete in safe order to avoid FK violations
    db.query(models.EntityGroup).filter(models.EntityGroup.user_id == uid).delete(synchronize_session=False)
    db.query(models.EntityAttachment).filter(models.EntityAttachment.user_id == uid).delete(synchronize_session=False)
    db.query(models.Relationship).filter(models.Relationship.user_id == uid).delete(synchronize_session=False)
    db.query(models.Entity).filter(models.Entity.user_id == uid).delete(synchronize_session=False)
    db.query(models.RelationshipTypeSchema).filter(models.RelationshipTypeSchema.user_id == uid).delete(synchronize_session=False)
    db.query(models.EntityTypeSchema).filter(models.EntityTypeSchema.user_id == uid).delete(synchronize_session=False)
    db.commit()
    # Re-seed builtin schemas so the app works normally after reset
    from ..main import _seed_builtin_schemas
    _seed_builtin_schemas(db, uid)


@router.delete("/me", status_code=204)
def delete_my_account(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Permanently delete account and all associated data."""
    uid = current_user.id
    db.query(models.EntityGroup).filter(models.EntityGroup.user_id == uid).delete(synchronize_session=False)
    db.query(models.EntityAttachment).filter(models.EntityAttachment.user_id == uid).delete(synchronize_session=False)
    db.query(models.Relationship).filter(models.Relationship.user_id == uid).delete(synchronize_session=False)
    db.query(models.Entity).filter(models.Entity.user_id == uid).delete(synchronize_session=False)
    db.query(models.RelationshipTypeSchema).filter(models.RelationshipTypeSchema.user_id == uid).delete(synchronize_session=False)
    db.query(models.EntityTypeSchema).filter(models.EntityTypeSchema.user_id == uid).delete(synchronize_session=False)
    db.delete(current_user)
    db.commit()
