from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Index, Boolean, Integer, BigInteger
from sqlalchemy.orm import relationship
from .database import Base
import uuid
from datetime import datetime


def _uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=_uuid)
    username = Column(String(64), nullable=False, unique=True, index=True)
    email = Column(String(255), nullable=True, unique=True, index=True)
    password_hash = Column(String, nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    session_lifetime_hours = Column(Integer, default=168)
    memory_limit_mb = Column(Integer, nullable=True)
    registration_ip = Column(String(64), nullable=True)
    enc_salt = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)
    entities = relationship("Entity", back_populates="owner", cascade="all, delete-orphan")
    relationships = relationship("Relationship", back_populates="owner", cascade="all, delete-orphan")
    entity_schemas = relationship("EntityTypeSchema", back_populates="owner", cascade="all, delete-orphan")
    attachments = relationship("EntityAttachment", back_populates="owner", cascade="all, delete-orphan")
    relationship_type_schemas = relationship("RelationshipTypeSchema", back_populates="owner", cascade="all, delete-orphan")


class SiteSettings(Base):
    __tablename__ = "site_settings"
    id = Column(String, primary_key=True, default=lambda: "main")
    default_language = Column(String(8), default="en")
    default_memory_limit_mb = Column(Integer, default=512)
    site_icon_b64 = Column(Text, nullable=True)
    site_title = Column(String(128), default="OSINT Graph Platform")
    registration_enabled = Column(Boolean, default=True)
    max_accounts_per_ip = Column(Integer, default=3)
    database_url = Column(Text, nullable=True)   # pending DB URL (applied on restart)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class EntityTypeSchema(Base):
    __tablename__ = "entity_type_schemas"
    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String, nullable=False, index=True)
    label_en = Column(String, nullable=False)
    label_ru = Column(String, nullable=True)
    icon = Column(String, nullable=True)
    color = Column(String, nullable=True)
    icon_image = Column(Text, nullable=True)   # base64 data URI – square image for type icon
    fields = Column(Text, nullable=True)       # JSON array of FieldDefinition
    is_builtin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    owner = relationship("User", back_populates="entity_schemas")


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
    attachments = relationship("EntityAttachment", back_populates="entity", cascade="all, delete-orphan")
    source_relationships = relationship(
        "Relationship", foreign_keys="Relationship.source_entity_id",
        back_populates="source_entity", cascade="all, delete-orphan",
    )
    target_relationships = relationship(
        "Relationship", foreign_keys="Relationship.target_entity_id",
        back_populates="target_entity", cascade="all, delete-orphan",
    )
    __table_args__ = (Index("ix_entities_user_type", "user_id", "type"),)


class Relationship(Base):
    __tablename__ = "relationships"
    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    source_entity_id = Column(String, ForeignKey("entities.id", ondelete="CASCADE"), nullable=False, index=True)
    target_entity_id = Column(String, ForeignKey("entities.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String, nullable=False, index=True)
    metadata_ = Column("metadata", Text, nullable=True)
    notes = Column(Text, nullable=True)   # Markdown annotation for this relationship
    created_at = Column(DateTime, default=datetime.utcnow)
    owner = relationship("User", back_populates="relationships")
    source_entity = relationship("Entity", foreign_keys=[source_entity_id], back_populates="source_relationships")
    target_entity = relationship("Entity", foreign_keys=[target_entity_id], back_populates="target_relationships")


class EntityAttachment(Base):
    """File attached to an entity – stored as base64 in DB (keeps stack simple)."""
    __tablename__ = "entity_attachments"
    id = Column(String, primary_key=True, default=_uuid)
    entity_id = Column(String, ForeignKey("entities.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    mimetype = Column(String(128), nullable=False, default="application/octet-stream")
    size_bytes = Column(Integer, nullable=False, default=0)
    data_b64 = Column(Text, nullable=False)   # AES-256-GCM encrypted base64 blob
    created_at = Column(DateTime, default=datetime.utcnow)
    entity = relationship("Entity", back_populates="attachments")
    owner = relationship("User", back_populates="attachments")


class RelationshipTypeSchema(Base):
    """User-defined (and built-in) relationship type definitions."""
    __tablename__ = "relationship_type_schemas"
    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String, nullable=False, index=True)
    label_en = Column(String, nullable=False)
    label_ru = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    emoji = Column(String(8), nullable=True, default="🔗")
    color = Column(String(16), nullable=True)
    fields = Column(Text, nullable=True)       # JSON array of FieldDefinition
    is_builtin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    owner = relationship("User", back_populates="relationship_type_schemas")
