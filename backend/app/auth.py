"""
Auth helpers: password hashing (bcrypt direct, no passlib) + JWT.

passlib is NOT used because it is incompatible with bcrypt >= 4.x
(dropped __about__, different API).  We call bcrypt directly and
pre-hash the plaintext with SHA-256 to work around bcrypt's 72-byte
password limit while keeping full entropy.
"""

import hashlib
import os
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from jose import JWTError, jwt

SECRET_KEY = os.getenv("SECRET_KEY", "osint-graph-secret-key-change-in-production-2024")
ALGORITHM = "HS256"

# bcrypt work factor — 12 is a good balance of security vs speed
_BCRYPT_ROUNDS = 12


def _prehash(password: str) -> bytes:
    """
    SHA-256 the password first so any length is safe for bcrypt,
    then hex-encode to keep it printable ASCII (64 bytes < 72 limit).
    """
    return hashlib.sha256(password.encode("utf-8")).hexdigest().encode("ascii")


def hash_password(password: str) -> str:
    hashed = bcrypt.hashpw(_prehash(password), bcrypt.gensalt(rounds=_BCRYPT_ROUNDS))
    return hashed.decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(_prehash(plain), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, username: str, is_admin: bool, expires_hours: int = 168) -> str:
    expire = datetime.utcnow() + timedelta(hours=expires_hours)
    payload = {
        "sub": user_id,
        "username": username,
        "is_admin": is_admin,
        "exp": expire,
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None
