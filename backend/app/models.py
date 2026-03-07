from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Index, Boolean, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.sqlite import JSON
from .database import Base
import uuid
from datetime import datetime


def _uuid():
    return str(uuid.uuid4())


# ── Users ────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=_uuid)
    username = Column(String(64), nullable=False, unique=True, index=True)
    email = Column(String(255), nullable=True, unique=True, index=True)
    password_hash = Column(String, nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    session_lifetime_hours = Column(Integer, default=168)   # 7 days
    memory_limit_mb = Column(Integer, nullable=True)        # None = use site default
    registration_ip = Column(String(64), nullable=True)
    # Per-user salt for at-rest encryption key derivation.
    # NULL → account pre-dates encryption; new data stored as plaintext until pw change.
    enc_salt = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)

    entities = relationship("Entity", back_populates="owner", cascade="all, delete-orphan")
    relationships = relationship("Relationship", back_populates="owner", cascade="all, delete-orphan")
    entity_schemas = relationship("EntityTypeSchema", back_populates="owner", cascade="all, delete-orphan")


# ── Site Settings (singleton) ─────────────────────────────────────────────────

class SiteSettings(Base):
    __tablename__ = "site_settings"

    id = Column(String, primary_key=True, default=lambda: "main")
    default_language = Column(String(8), default="en")
    default_memory_limit_mb = Column(Integer, default=512)
    site_icon_b64 = Column(Text, nullable=True)   # data URI for favicon
    site_title = Column(String(128), default="OSINT Graph Platform")
    registration_enabled = Column(Boolean, default=True)
    max_accounts_per_ip = Column(Integer, default=3)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ── Entity Type Schemas ───────────────────────────────────────────────────────

class EntityTypeSchema(Base):
    __tablename__ = "entity_type_schemas"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String, nullable=False, index=True)
    label_en = Column(String, nullable=False)
    label_ru = Column(String, nullable=True)
    icon = Column(String, nullable=True)
    color = Column(String, nullable=True)
    fields = Column(Text, nullable=True)     # JSON array of FieldDefinition
    is_builtin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="entity_schemas")


# ── Entities ──────────────────────────────────────────────────────────────────

class Entity(Base):
    __tablename__ = "entities"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    type = Column(String, nullable=False, index=True)
    value = Column(String, nullable=False, index=True)
    metadata_ = Column("metadata", Text, nullable=True)
    notes = Column(Text, nullable=True)
    canvas_layout = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="entities")
    source_relationships = relationship(
        "Relationship", foreign_keys="Relationship.source_entity_id",
        back_populates="source_entity", cascade="all, delete-orphan",
    )
    target_relationships = relationship(
        "Relationship", foreign_keys="Relationship.target_entity_id",
        back_populates="target_entity", cascade="all, delete-orphan",
    )

    __table_args__ = (Index("ix_entities_user_type", "user_id", "type"),)


# ── Relationships ─────────────────────────────────────────────────────────────

class Relationship(Base):
    __tablename__ = "relationships"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    source_entity_id = Column(String, ForeignKey("entities.id", ondelete="CASCADE"), nullable=False, index=True)
    target_entity_id = Column(String, ForeignKey("entities.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String, nullable=False, index=True)
    metadata_ = Column("metadata", Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="relationships")
    source_entity = relationship("Entity", foreign_keys=[source_entity_id], back_populates="source_relationships")
    target_entity = relationship("Entity", foreign_keys=[target_entity_id], back_populates="target_relationships")
