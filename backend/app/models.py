from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Index, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.sqlite import JSON
from .database import Base
import uuid
from datetime import datetime


def generate_uuid():
    return str(uuid.uuid4())


class EntityTypeSchema(Base):
    """User-defined entity type schemas with custom fields"""
    __tablename__ = "entity_type_schemas"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False, unique=True, index=True)  # internal key, e.g. "telegram"
    label_en = Column(String, nullable=False)  # visible label EN, e.g. "Telegram Account"
    label_ru = Column(String, nullable=True)   # visible label RU, e.g. "Telegram аккаунт"
    icon = Column(String, nullable=True)        # emoji icon
    color = Column(String, nullable=True)       # hex color
    fields = Column(Text, nullable=True)        # JSON array of field definitions
    is_builtin = Column(Boolean, default=False) # True for system types
    created_at = Column(DateTime, default=datetime.utcnow)


class Entity(Base):
    __tablename__ = "entities"

    id = Column(String, primary_key=True, default=generate_uuid)
    type = Column(String, nullable=False, index=True)
    value = Column(String, nullable=False, index=True)
    metadata_ = Column("metadata", Text, nullable=True)
    notes = Column(Text, nullable=True)           # Markdown notes
    canvas_layout = Column(Text, nullable=True)   # JSON for board card positions
    created_at = Column(DateTime, default=datetime.utcnow)

    source_relationships = relationship(
        "Relationship", foreign_keys="Relationship.source_entity_id", back_populates="source_entity", cascade="all, delete-orphan"
    )
    target_relationships = relationship(
        "Relationship", foreign_keys="Relationship.target_entity_id", back_populates="target_entity", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_entities_type_value", "type", "value"),
    )


class Relationship(Base):
    __tablename__ = "relationships"

    id = Column(String, primary_key=True, default=generate_uuid)
    source_entity_id = Column(String, ForeignKey("entities.id"), nullable=False, index=True)
    target_entity_id = Column(String, ForeignKey("entities.id"), nullable=False, index=True)
    type = Column(String, nullable=False, index=True)
    metadata_ = Column("metadata", Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    source_entity = relationship("Entity", foreign_keys=[source_entity_id], back_populates="source_relationships")
    target_entity = relationship("Entity", foreign_keys=[target_entity_id], back_populates="target_relationships")
