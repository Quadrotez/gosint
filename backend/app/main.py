import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text, inspect
from .database import engine
from . import models
from .routers import entities, relationships, search, import_data, stats, entity_schemas, backup, webdav_sync, attachments
from .routers import auth as auth_router
from .routers import admin as admin_router
from .auth import hash_password
from .encryption import generate_salt

models.Base.metadata.create_all(bind=engine)

BUILTIN_SCHEMAS = [
    {"name": "person",        "label_en": "Person",         "label_ru": "Персона",             "icon": "👤", "color": "#00d4ff"},
    {"name": "email",         "label_en": "Email",          "label_ru": "Электронная почта",    "icon": "✉️",  "color": "#00ff88"},
    {"name": "phone",         "label_en": "Phone",          "label_ru": "Телефон",              "icon": "📞", "color": "#ffd700"},
    {"name": "username",      "label_en": "Username",       "label_ru": "Имя пользователя",     "icon": "@",  "color": "#8b5cf6"},
    {"name": "domain",        "label_en": "Domain",         "label_ru": "Домен",                "icon": "🌐", "color": "#ff6b35"},
    {"name": "ip",            "label_en": "IP Address",     "label_ru": "IP-адрес",             "icon": "🔌", "color": "#ff4444"},
    {"name": "organization",  "label_en": "Organization",   "label_ru": "Организация",          "icon": "🏢", "color": "#06b6d4"},
    {"name": "address",       "label_en": "Address",        "label_ru": "Адрес",                "icon": "📍", "color": "#a78bfa"},
    {"name": "website",       "label_en": "Website",        "label_ru": "Веб-сайт",             "icon": "🔗", "color": "#34d399"},
    {"name": "crypto_wallet", "label_en": "Crypto Wallet",  "label_ru": "Крипто-кошелёк",       "icon": "₿",  "color": "#f59e0b"},
]


def run_migrations():
    inspector = inspect(engine)
    with engine.connect() as conn:
        def add_col(table, col, col_type):
            existing = [c["name"] for c in inspector.get_columns(table)] if table in inspector.get_table_names() else []
            if col not in existing:
                try:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
                    conn.commit()
                except Exception:
                    pass

        add_col("users", "enc_salt", "TEXT")
        add_col("users", "memory_limit_mb", "INTEGER")
        add_col("users", "registration_ip", "TEXT")
        add_col("users", "session_lifetime_hours", "INTEGER")
        add_col("users", "last_login", "DATETIME")
        add_col("entities", "notes", "TEXT")
        add_col("entities", "canvas_layout", "TEXT")
        add_col("entities", "user_id", "TEXT")
        add_col("relationships", "user_id", "TEXT")
        add_col("relationships", "metadata", "TEXT")
        add_col("relationships", "notes", "TEXT")
        add_col("entity_type_schemas", "user_id", "TEXT")
        add_col("entity_type_schemas", "icon_image", "TEXT")
        add_col("site_settings", "database_url", "TEXT")


def _seed_builtin_schemas(db, user_id: str):
    import uuid as _uuid
    existing_names = {
        s.name for s in db.query(models.EntityTypeSchema)
        .filter(models.EntityTypeSchema.user_id == user_id).all()
    }
    for bs in BUILTIN_SCHEMAS:
        if bs["name"] not in existing_names:
            db.add(models.EntityTypeSchema(
                id=str(_uuid.uuid4()), user_id=user_id,
                name=bs["name"], label_en=bs["label_en"], label_ru=bs["label_ru"],
                icon=bs["icon"], color=bs["color"], is_builtin=True,
            ))
    db.commit()


def seed_admin():
    from sqlalchemy.orm import Session
    import uuid
    with Session(engine) as db:
        if not db.query(models.SiteSettings).filter_by(id="main").first():
            db.add(models.SiteSettings(id="main")); db.commit()
        if not db.query(models.User).filter_by(username="admin").first():
            admin = models.User(
                id=str(uuid.uuid4()), username="admin",
                password_hash=hash_password("admin"),
                enc_salt=generate_salt(),
                is_admin=True, is_active=True, session_lifetime_hours=168,
                registration_ip="localhost",
            )
            db.add(admin); db.commit(); db.refresh(admin)
            _seed_builtin_schemas(db, admin.id)


run_migrations()
seed_admin()

app = FastAPI(title="OSINT Graph Intelligence Platform", version="3.2.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

for router in [auth_router.router, admin_router.router, entities.router, relationships.router,
               search.router, import_data.router, stats.router, entity_schemas.router,
               backup.router, webdav_sync.router, attachments.router]:
    app.include_router(router, prefix="/api")


@app.get("/")
def root():
    return {"status": "ok", "version": "3.2.0"}
