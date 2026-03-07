"""
At-rest field encryption for sensitive entity data.

Each user gets a unique enc_salt. A per-user AES-256-GCM key is derived
from the user's stored bcrypt password_hash + salt via PBKDF2-HMAC-SHA256.
Encrypted blobs are prefixed with "$enc$" so legacy plaintext rows are read
transparently.

This is *server-side at-rest encryption* — the server can always decrypt
data for active sessions. Primary protection: raw database file leaks.
"""

from __future__ import annotations

import base64
import hashlib
import os
from typing import Optional

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

ENC_PREFIX = "$enc$"
PBKDF2_ITERATIONS = 200_000


def generate_salt() -> str:
    """Return a fresh random 32-byte salt as base64."""
    return base64.b64encode(os.urandom(32)).decode()


def derive_key(password_hash: str, enc_salt: str) -> bytes:
    """Derive a 32-byte AES key from password_hash + salt."""
    return hashlib.pbkdf2_hmac(
        "sha256",
        password_hash.encode(),
        base64.b64decode(enc_salt),
        PBKDF2_ITERATIONS,
        dklen=32,
    )


def encrypt_field(key: bytes, plaintext: str) -> str:
    """Encrypt *plaintext* with AES-256-GCM; prefix result with ENC_PREFIX."""
    if not plaintext:
        return plaintext
    if plaintext.startswith(ENC_PREFIX):
        return plaintext  # already encrypted — idempotent
    nonce = os.urandom(12)
    ct = AESGCM(key).encrypt(nonce, plaintext.encode("utf-8"), None)
    return ENC_PREFIX + base64.b64encode(nonce + ct).decode()


def decrypt_field(key: bytes, value: str) -> str:
    """Decrypt a value from encrypt_field; pass-through if no prefix."""
    if not value or not value.startswith(ENC_PREFIX):
        return value
    raw = base64.b64decode(value[len(ENC_PREFIX):])
    nonce, ct = raw[:12], raw[12:]
    return AESGCM(key).decrypt(nonce, ct, None).decode("utf-8")


def is_encrypted(value: str) -> bool:
    return isinstance(value, str) and value.startswith(ENC_PREFIX)


def reencrypt_field(old_key: Optional[bytes], new_key: bytes, value: str) -> str:
    """Re-encrypt value from old_key → new_key (used on password change)."""
    if not value:
        return value
    plain = decrypt_field(old_key, value) if (old_key and is_encrypted(value)) else value
    return encrypt_field(new_key, plain)
