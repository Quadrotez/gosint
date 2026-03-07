from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Resolve DB path relative to this file so it works regardless of cwd.
# Default: <project_root>/backend/data/gosint.db
_HERE = os.path.dirname(os.path.abspath(__file__))
_DEFAULT_DB_DIR = os.path.join(_HERE, "..", "data")
_DEFAULT_DB_PATH = os.path.join(_DEFAULT_DB_DIR, "gosint.db")

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{_DEFAULT_DB_PATH}")

# Auto-create the data directory for SQLite if it doesn't exist
if DATABASE_URL.startswith("sqlite:///"):
    _db_file = DATABASE_URL[len("sqlite:///"):]
    _db_dir = os.path.dirname(_db_file)
    if _db_dir:
        os.makedirs(_db_dir, exist_ok=True)

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
