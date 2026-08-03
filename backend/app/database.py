import os

from sqlalchemy.engine.url import URL
from .portable import portable_dir

_HERE = os.path.dirname(os.path.abspath(__file__))

_pdata = portable_dir()
if _pdata:
    _db_dir = _pdata
else:
    _db_dir = os.path.join(_HERE, "..", "data")
os.makedirs(_db_dir, exist_ok=True)

_db_path = os.path.join(_db_dir, "gosint.db")
_default_url = str(URL.create(drivername="sqlite", database=_db_path))

# Allow override via env var or .env.db file next to this package
_env_db_file = os.path.join(_HERE, ".env.db")
if os.path.exists(_env_db_file):
    with open(_env_db_file) as _f:
        for _line in _f:
            _line = _line.strip()
            if _line.startswith("DATABASE_URL="):
                os.environ["DATABASE_URL"] = _line[len("DATABASE_URL="):]
                break

DATABASE_URL = os.getenv("DATABASE_URL", _default_url)

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

_kwargs = {}
if DATABASE_URL.startswith("sqlite"):
    _kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, **_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
