import json
import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from . import models, schemas


# ── Helpers ───────────────────────────────────────────────────────────────────

def _entity_out(e: models.Entity) -> schemas.EntityOut:
    return schemas.EntityOut(
        id=e.id, type=e.type, value=e.value,
        metadata=json.loads(e.metadata_) if e.metadata_ else None,
        notes=e.notes,
        canvas_layout=json.loads(e.canvas_layout) if e.canvas_layout else None,
        created_at=e.created_at,
    )


def _rel_out(r: models.Relationship) -> schemas.RelationshipOut:
    return schemas.RelationshipOut(
        id=r.id,
        source_entity_id=r.source_entity_id,
        target_entity_id=r.target_entity_id,
        type=r.type,
        metadata=json.loads(r.metadata_) if r.metadata_ else None,
        created_at=r.created_at,
    )


def _schema_out(s: models.EntityTypeSchema) -> schemas.EntityTypeSchemaOut:
    fields = json.loads(s.fields) if s.fields else None
    return schemas.EntityTypeSchemaOut(
        id=s.id, name=s.name, label_en=s.label_en, label_ru=s.label_ru,
        icon=s.icon, color=s.color, is_builtin=s.is_builtin, created_at=s.created_at,
        fields=[schemas.FieldDefinition(**f) for f in fields] if fields else None,
    )


# ── Storage ───────────────────────────────────────────────────────────────────

def get_user_storage_bytes(db: Session, user_id: str) -> int:
    entities = db.query(models.Entity).filter(models.Entity.user_id == user_id).all()
    return sum(
        len(e.metadata_ or "") + len(e.notes or "") + len(e.canvas_layout or "") + len(e.value or "")
        for e in entities
    )


def get_user_effective_limit_mb(db: Session, user: models.User) -> int:
    if user.memory_limit_mb is not None:
        return user.memory_limit_mb
    settings = db.query(models.SiteSettings).filter(models.SiteSettings.id == "main").first()
    return settings.default_memory_limit_mb if settings else 512


def check_storage_limit(db: Session, user: models.User) -> None:
    from fastapi import HTTPException
    limit_mb = get_user_effective_limit_mb(db, user)
    used = get_user_storage_bytes(db, user.id)
    if used >= limit_mb * 1024 * 1024:
        raise HTTPException(status_code=507, detail=f"Storage limit reached ({limit_mb} MB)")


# ── Entity Type Schemas ───────────────────────────────────────────────────────

def get_entity_type_schemas(db: Session, user_id: str) -> List[schemas.EntityTypeSchemaOut]:
    rows = db.query(models.EntityTypeSchema).filter(
        models.EntityTypeSchema.user_id == user_id
    ).order_by(models.EntityTypeSchema.is_builtin.desc(), models.EntityTypeSchema.created_at).all()
    return [_schema_out(s) for s in rows]


def create_entity_type_schema(db: Session, data: schemas.EntityTypeSchemaCreate, user_id: str) -> schemas.EntityTypeSchemaOut:
    fields_json = json.dumps([f.model_dump() for f in data.fields]) if data.fields else None
    s = models.EntityTypeSchema(
        id=str(uuid.uuid4()), user_id=user_id,
        name=data.name, label_en=data.label_en, label_ru=data.label_ru,
        icon=data.icon, color=data.color, fields=fields_json, is_builtin=False,
        created_at=datetime.utcnow(),
    )
    db.add(s); db.commit(); db.refresh(s)
    return _schema_out(s)


def update_entity_type_schema(db: Session, schema_id: str, data: schemas.EntityTypeSchemaUpdate, user_id: str) -> Optional[schemas.EntityTypeSchemaOut]:
    s = db.query(models.EntityTypeSchema).filter(
        models.EntityTypeSchema.id == schema_id,
        models.EntityTypeSchema.user_id == user_id,
    ).first()
    if not s:
        return None
    if data.label_en is not None: s.label_en = data.label_en
    if data.label_ru is not None: s.label_ru = data.label_ru
    if data.icon is not None: s.icon = data.icon
    if data.color is not None: s.color = data.color
    if data.fields is not None: s.fields = json.dumps([f.model_dump() for f in data.fields])
    db.commit(); db.refresh(s)
    return _schema_out(s)


def delete_entity_type_schema(db: Session, schema_id: str, user_id: str) -> bool:
    s = db.query(models.EntityTypeSchema).filter(
        models.EntityTypeSchema.id == schema_id,
        models.EntityTypeSchema.user_id == user_id,
        models.EntityTypeSchema.is_builtin == False,
    ).first()
    if not s:
        return False
    db.delete(s); db.commit()
    return True


# ── Entities ──────────────────────────────────────────────────────────────────

def get_entities(db: Session, user_id: str, skip: int = 0, limit: int = 100, type_filter: Optional[str] = None) -> List[schemas.EntityOut]:
    q = db.query(models.Entity).filter(models.Entity.user_id == user_id)
    if type_filter:
        q = q.filter(models.Entity.type == type_filter)
    return [_entity_out(e) for e in q.order_by(models.Entity.created_at.desc()).offset(skip).limit(limit)]


def get_entity(db: Session, entity_id: str, user_id: str) -> Optional[schemas.EntityOut]:
    e = db.query(models.Entity).filter(
        models.Entity.id == entity_id,
        models.Entity.user_id == user_id,
    ).first()
    return _entity_out(e) if e else None


def create_entity(db: Session, data: schemas.EntityCreate, user_id: str) -> schemas.EntityOut:
    e = models.Entity(
        id=str(uuid.uuid4()), user_id=user_id,
        type=data.type, value=data.value,
        metadata_=json.dumps(data.metadata) if data.metadata else None,
        notes=data.notes,
        canvas_layout=json.dumps(data.canvas_layout) if data.canvas_layout else None,
        created_at=datetime.utcnow(),
    )
    db.add(e); db.commit(); db.refresh(e)
    return _entity_out(e)


def update_entity(db: Session, entity_id: str, data: schemas.EntityUpdate, user_id: str) -> Optional[schemas.EntityOut]:
    e = db.query(models.Entity).filter(
        models.Entity.id == entity_id,
        models.Entity.user_id == user_id,
    ).first()
    if not e:
        return None
    if data.value is not None: e.value = data.value
    if data.metadata is not None: e.metadata_ = json.dumps(data.metadata)
    if data.notes is not None: e.notes = data.notes
    if data.canvas_layout is not None: e.canvas_layout = json.dumps(data.canvas_layout)
    db.commit(); db.refresh(e)
    return _entity_out(e)


def delete_entity(db: Session, entity_id: str, user_id: str) -> bool:
    e = db.query(models.Entity).filter(
        models.Entity.id == entity_id,
        models.Entity.user_id == user_id,
    ).first()
    if not e:
        return False
    db.delete(e); db.commit()
    return True


def search_entities(db: Session, query: str, user_id: str, limit: int = 50) -> List[schemas.EntityOut]:
    rows = db.query(models.Entity).filter(
        models.Entity.user_id == user_id,
        or_(
            models.Entity.value.ilike(f"%{query}%"),
            models.Entity.type.ilike(f"%{query}%"),
        ),
    ).limit(limit).all()
    return [_entity_out(e) for e in rows]


# ── Relationships ─────────────────────────────────────────────────────────────

def get_entity_relationships(db: Session, entity_id: str, user_id: str) -> List[schemas.RelationshipWithEntities]:
    rels = db.query(models.Relationship).filter(
        models.Relationship.user_id == user_id,
        or_(
            models.Relationship.source_entity_id == entity_id,
            models.Relationship.target_entity_id == entity_id,
        ),
    ).all()
    return [
        schemas.RelationshipWithEntities(
            id=r.id, source_entity_id=r.source_entity_id, target_entity_id=r.target_entity_id,
            type=r.type,
            metadata=json.loads(r.metadata_) if r.metadata_ else None,
            created_at=r.created_at,
            source_entity=_entity_out(r.source_entity) if r.source_entity else None,
            target_entity=_entity_out(r.target_entity) if r.target_entity else None,
        )
        for r in rels
    ]


def create_relationship(db: Session, data: schemas.RelationshipCreate, user_id: str) -> schemas.RelationshipOut:
    r = models.Relationship(
        id=str(uuid.uuid4()), user_id=user_id,
        source_entity_id=data.source_entity_id,
        target_entity_id=data.target_entity_id,
        type=data.type,
        metadata_=json.dumps(data.metadata) if data.metadata else None,
        created_at=datetime.utcnow(),
    )
    db.add(r); db.commit(); db.refresh(r)
    return _rel_out(r)


def delete_relationship(db: Session, rel_id: str, user_id: str) -> bool:
    r = db.query(models.Relationship).filter(
        models.Relationship.id == rel_id,
        models.Relationship.user_id == user_id,
    ).first()
    if not r:
        return False
    db.delete(r); db.commit()
    return True


# ── Graph ─────────────────────────────────────────────────────────────────────

def get_entity_graph(db: Session, entity_id: str, user_id: str, depth: int = 2) -> schemas.GraphResponse:
    visited_nodes: dict = {}
    visited_edges: dict = {}
    to_visit = [entity_id]

    for _ in range(depth):
        next_visit = []
        for eid in to_visit:
            entity = db.query(models.Entity).filter(
                models.Entity.id == eid,
                models.Entity.user_id == user_id,
            ).first()
            if entity and eid not in visited_nodes:
                visited_nodes[eid] = entity
                rels = db.query(models.Relationship).filter(
                    models.Relationship.user_id == user_id,
                    or_(
                        models.Relationship.source_entity_id == eid,
                        models.Relationship.target_entity_id == eid,
                    ),
                ).all()
                for r in rels:
                    if r.id not in visited_edges:
                        visited_edges[r.id] = r
                    neighbor_id = r.target_entity_id if r.source_entity_id == eid else r.source_entity_id
                    if neighbor_id not in visited_nodes:
                        next_visit.append(neighbor_id)
        to_visit = next_visit

    # CRITICAL: only include edges where BOTH endpoints are in the visited set
    node_ids = set(visited_nodes.keys())
    nodes = [
        schemas.GraphNode(
            id=e.id, type=e.type, value=e.value,
            metadata=json.loads(e.metadata_) if e.metadata_ else None,
        )
        for e in visited_nodes.values()
    ]
    edges = [
        schemas.GraphEdge(id=r.id, source=r.source_entity_id, target=r.target_entity_id, type=r.type)
        for r in visited_edges.values()
        if r.source_entity_id in node_ids and r.target_entity_id in node_ids
    ]
    return schemas.GraphResponse(nodes=nodes, edges=edges)


# ── Stats ─────────────────────────────────────────────────────────────────────

def get_stats(db: Session, user_id: str) -> schemas.StatsResponse:
    total_entities = db.query(func.count(models.Entity.id)).filter(models.Entity.user_id == user_id).scalar()
    total_relationships = db.query(func.count(models.Relationship.id)).filter(models.Relationship.user_id == user_id).scalar()
    type_counts = db.query(models.Entity.type, func.count(models.Entity.id)).filter(
        models.Entity.user_id == user_id
    ).group_by(models.Entity.type).all()
    recent = db.query(models.Entity).filter(models.Entity.user_id == user_id).order_by(
        models.Entity.created_at.desc()
    ).limit(5).all()
    return schemas.StatsResponse(
        total_entities=total_entities,
        total_relationships=total_relationships,
        entities_by_type={t: c for t, c in type_counts},
        recent_entities=[_entity_out(e) for e in recent],
    )
