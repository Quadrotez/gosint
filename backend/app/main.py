from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text, inspect
from .database import engine
from . import models
from .routers import entities, relationships, search, import_data, stats, entity_schemas, backup, webdav_sync
from .routers import auth as auth_router
from .routers import admin as admin_router
from .auth import hash_password
from .encryption import generate_salt

models.Base.metadata.create_all(bind=engine)


def run_migrations():
    """Idempotent schema migrations for existing databases."""
    inspector = inspect(engine)
    with engine.connect() as conn:

        def add_col(table: str, col: str, col_type: str):
            cols = [c["name"] for c in inspector.get_columns(table)]
            if col not in cols:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
                conn.commit()

        if "users" in inspector.get_table_names():
            add_col("users", "enc_salt", "TEXT")
            add_col("users", "memory_limit_mb", "INTEGER")
            add_col("users", "registration_ip", "TEXT")
            add_col("users", "session_lifetime_hours", "INTEGER")
            add_col("users", "last_login", "DATETIME")

        if "entities" in inspector.get_table_names():
            add_col("entities", "notes", "TEXT")
            add_col("entities", "canvas_layout", "TEXT")
            add_col("entities", "user_id", "TEXT")

        if "relationships" in inspector.get_table_names():
            add_col("relationships", "user_id", "TEXT")
            add_col("relationships", "metadata", "TEXT")

        if "entity_type_schemas" in inspector.get_table_names():
            add_col("entity_type_schemas", "user_id", "TEXT")


def seed_admin():
    from sqlalchemy.orm import Session
    with Session(engine) as db:
        if not db.query(models.SiteSettings).filter_by(id="main").first():
            db.add(models.SiteSettings(id="main"))
            db.commit()

        if not db.query(models.User).filter_by(username="admin").first():
            pw_hash = hash_password("admin")
            db.add(models.User(
                username="admin",
                password_hash=pw_hash,
                enc_salt=generate_salt(),
                is_admin=True,
                is_active=True,
                session_lifetime_hours=168,
                registration_ip="localhost",
            ))
            db.commit()


run_migrations()
seed_admin()

app = FastAPI(title="OSINT Graph Intelligence Platform", version="3.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router, prefix="/api")
app.include_router(admin_router.router, prefix="/api")
app.include_router(entities.router, prefix="/api")
app.include_router(relationships.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(import_data.router, prefix="/api")
app.include_router(stats.router, prefix="/api")
app.include_router(entity_schemas.router, prefix="/api")
app.include_router(backup.router, prefix="/api")
app.include_router(webdav_sync.router, prefix="/api")


@app.get("/")
def root():
    return {"status": "ok", "version": "3.1.0"}
