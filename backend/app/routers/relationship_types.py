"""
CRUD API for user-defined relationship type schemas.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import json, uuid
from datetime import datetime
from ..database import get_db
from .. import models, schemas
from ..deps import get_current_user

router = APIRouter(prefix="/relationship-types", tags=["relationship-types"])

# Built-in relationship types seeded for each user
BUILTIN_REL_TYPES = [
    {"name": "linked_to",        "label_en": "Linked to",        "label_ru": "Связан с",         "emoji": "🔗", "color": "#3b82f6"},
    {"name": "owns",             "label_en": "Owns",             "label_ru": "Владеет",          "emoji": "📦", "color": "#f97316"},
    {"name": "uses",             "label_en": "Uses",             "label_ru": "Использует",       "emoji": "⚙️", "color": "#8b5cf6"},
    {"name": "registered_to",    "label_en": "Registered to",    "label_ru": "Зарегистрирован",  "emoji": "📝", "color": "#06b6d4"},
    {"name": "member_of",        "label_en": "Member of",        "label_ru": "Участник",         "emoji": "🏛️", "color": "#10b981"},
    {"name": "controls",         "label_en": "Controls",         "label_ru": "Управляет",        "emoji": "🎮", "color": "#f43f5e"},
    {"name": "associated_with",  "label_en": "Associated with",  "label_ru": "Ассоциирован с",   "emoji": "➰", "color": "#a855f7"},
    {"name": "works_at",         "label_en": "Works at",         "label_ru": "Работает в",       "emoji": "💼", "color": "#eab308"},
    {"name": "located_at",       "label_en": "Located at",       "label_ru": "Находится по",     "emoji": "📍", "color": "#a78bfa"},
    {"name": "colleague",        "label_en": "Colleague",        "label_ru": "Коллега",          "emoji": "💼", "color": "#06b6d4"},
    {"name": "spouse",           "label_en": "Spouse",           "label_ru": "Супруг/Супруга",   "emoji": "💍", "color": "#ec4899"},
    {"name": "partner",          "label_en": "Partner",          "label_ru": "Партнёр",          "emoji": "🤝", "color": "#10b981"},
    {"name": "relative",         "label_en": "Relative",         "label_ru": "Родственник",      "emoji": "👨‍👩‍👧", "color": "#f43f5e"},
    {"name": "friend",           "label_en": "Friend",           "label_ru": "Друг",             "emoji": "👫", "color": "#00d4ff"},
    {"name": "boss",             "label_en": "Boss / Employer",  "label_ru": "Начальник",        "emoji": "👔", "color": "#f97316"},
    {"name": "subordinate",      "label_en": "Subordinate",      "label_ru": "Подчинённый",      "emoji": "📋", "color": "#84cc16"},
    {"name": "business_partner", "label_en": "Business Partner", "label_ru": "Бизнес-партнёр",   "emoji": "🏢", "color": "#3b82f6"},
]


def _ensure_builtins(db: Session, user_id: str):
    """Seed built-in relationship types for user if not yet present."""
    existing = {
        r.name for r in db.query(models.RelationshipTypeSchema).filter(
            models.RelationshipTypeSchema.user_id == user_id
        ).all()
    }
    for rt in BUILTIN_REL_TYPES:
        if rt["name"] not in existing:
            db.add(models.RelationshipTypeSchema(
                id=str(uuid.uuid4()),
                user_id=user_id,
                name=rt["name"],
                label_en=rt["label_en"],
                label_ru=rt["label_ru"],
                emoji=rt["emoji"],
                color=rt["color"],
                is_builtin=True,
                created_at=datetime.utcnow(),
            ))
    db.commit()


def _schema_out(s: models.RelationshipTypeSchema) -> schemas.RelationshipTypeSchemaOut:
    fields = json.loads(s.fields) if s.fields else None
    return schemas.RelationshipTypeSchemaOut(
        id=s.id,
        name=s.name,
        label_en=s.label_en,
        label_ru=s.label_ru,
        description=s.description,
        emoji=s.emoji,
        color=s.color,
        fields=[schemas.FieldDefinition(**f) for f in fields] if fields else None,
        is_builtin=s.is_builtin,
        created_at=s.created_at,
    )


@router.get("", response_model=List[schemas.RelationshipTypeSchemaOut])
def list_relationship_types(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    _ensure_builtins(db, user.id)
    rows = db.query(models.RelationshipTypeSchema).filter(
        models.RelationshipTypeSchema.user_id == user.id
    ).order_by(
        models.RelationshipTypeSchema.is_builtin.desc(),
        models.RelationshipTypeSchema.created_at,
    ).all()
    return [_schema_out(r) for r in rows]


@router.post("", response_model=schemas.RelationshipTypeSchemaOut, status_code=201)
def create_relationship_type(
    body: schemas.RelationshipTypeSchemaCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if db.query(models.RelationshipTypeSchema).filter(
        models.RelationshipTypeSchema.user_id == user.id,
        models.RelationshipTypeSchema.name == body.name,
    ).first():
        raise HTTPException(409, "Relationship type with this name already exists")
    fields_json = json.dumps([f.model_dump() for f in body.fields]) if body.fields else None
    row = models.RelationshipTypeSchema(
        id=str(uuid.uuid4()),
        user_id=user.id,
        name=body.name,
        label_en=body.label_en,
        label_ru=body.label_ru,
        description=body.description,
        emoji=body.emoji or "🔗",
        color=body.color,
        fields=fields_json,
        is_builtin=False,
        created_at=datetime.utcnow(),
    )
    db.add(row); db.commit(); db.refresh(row)
    return _schema_out(row)


@router.patch("/{type_id}", response_model=schemas.RelationshipTypeSchemaOut)
def update_relationship_type(
    type_id: str,
    body: schemas.RelationshipTypeSchemaUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    row = db.query(models.RelationshipTypeSchema).filter(
        models.RelationshipTypeSchema.id == type_id,
        models.RelationshipTypeSchema.user_id == user.id,
    ).first()
    if not row:
        raise HTTPException(404, "Relationship type not found")
    if body.label_en is not None:
        row.label_en = body.label_en
    if body.label_ru is not None:
        row.label_ru = body.label_ru
    if body.description is not None:
        row.description = body.description
    if body.emoji is not None:
        row.emoji = body.emoji
    if body.color is not None:
        row.color = body.color
    if body.fields is not None:
        row.fields = json.dumps([f.model_dump() for f in body.fields])
    db.commit(); db.refresh(row)
    return _schema_out(row)


@router.delete("/{type_id}", status_code=204)
def delete_relationship_type(
    type_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    row = db.query(models.RelationshipTypeSchema).filter(
        models.RelationshipTypeSchema.id == type_id,
        models.RelationshipTypeSchema.user_id == user.id,
    ).first()
    if not row:
        raise HTTPException(404, "Relationship type not found")
    db.delete(row); db.commit()
