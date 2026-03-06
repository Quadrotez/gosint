from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from .database import engine
from . import models
from .routers import entities, relationships, search, import_data, stats, entity_schemas

models.Base.metadata.create_all(bind=engine)

# Apply simple migrations for new columns (idempotent)
def run_migrations():
    """Add new columns to existing tables if they don't exist yet."""
    with engine.connect() as conn:
        for col_def in [
            ("entities", "notes", "TEXT"),
            ("entities", "canvas_layout", "TEXT"),
        ]:
            table, col, col_type = col_def
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
                conn.commit()
            except Exception:
                pass  # Column already exists

run_migrations()

app = FastAPI(
    title="OSINT Graph Intelligence Platform",
    description="Store, analyze and explore OSINT data as a graph of entities and relationships.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(entities.router)
app.include_router(relationships.router)
app.include_router(search.router)
app.include_router(import_data.router)
app.include_router(stats.router)
app.include_router(entity_schemas.router)


@app.get("/")
def root():
    return {"status": "ok", "name": "OSINT Graph Intelligence Platform", "version": "2.0.0"}
