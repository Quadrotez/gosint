import json
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from . import models, schemas
from typing import Optional, List
import uuid
from datetime import datetime


# ── Helpers ───────────────────────────────────────────────────────────────────

def _entity_to_out(entity: models.Entity) -> schemas.EntityOut:
    return schemas.EntityOut(
        id=entity.id,
        type=entity.type,
        value=entity.value,
        metadata=json.loads(entity.metadata_) if entity.metadata_ else None,
        notes=entity.notes,
        canvas_layout=json.loads(entity.canvas_layout) if entity.canvas_layout else None,
        created_at=entity.created_at,
    )


def _rel_to_out(rel: models.Relationship) -> schemas.RelationshipOut:
    return schemas.RelationshipOut(
        id=rel.id,
        source_entity_id=rel.source_entity_id,
        target_entity_id=rel.target_entity_id,
        type=rel.type,
        metadata=json.loads(rel.metadata_) if rel.metadata_ else None,
        created_at=rel.created_at,
    )


# ── Entity Type Schemas ───────────────────────────────────────────────────────

def get_entity_type_schemas(db: Session) -> List[schemas.EntityTypeSchemaOut]:
    schemas_list = db.query(models.EntityTypeSchema).order_by(
        models.EntityTypeSchema.is_builtin.desc(),
        models.EntityTypeSchema.created_at
    ).all()
    result = []
    for s in schemas_list:
        fields = json.loads(s.fields) if s.fields else None
        result.append(schemas.EntityTypeSchemaOut(
            id=s.id,
            name=s.name,
            label_en=s.label_en,
            label_ru=s.label_ru,
            icon=s.icon,
            color=s.color,
            fields=[schemas.FieldDefinition(**f) for f in fields] if fields else None,
            is_builtin=s.is_builtin,
            created_at=s.created_at,
        ))
    return result


def create_entity_type_schema(db: Session, schema: schemas.EntityTypeSchemaCreate) -> schemas.EntityTypeSchemaOut:
    fields_json = json.dumps([f.model_dump() for f in schema.fields]) if schema.fields else None
    new_id = str(uuid.uuid4())
    db_schema = models.EntityTypeSchema(
        id=new_id,
        name=schema.name,
        label_en=schema.label_en,
        label_ru=schema.label_ru,
        icon=schema.icon,
        color=schema.color,
        fields=fields_json,
        is_builtin=False,
        created_at=datetime.utcnow(),
    )
    db.add(db_schema)
    db.commit()
    db.refresh(db_schema)
    fields_parsed = json.loads(db_schema.fields) if db_schema.fields else None
    return schemas.EntityTypeSchemaOut(
        id=db_schema.id,
        name=db_schema.name,
        label_en=db_schema.label_en,
        label_ru=db_schema.label_ru,
        icon=db_schema.icon,
        color=db_schema.color,
        fields=[schemas.FieldDefinition(**f) for f in fields_parsed] if fields_parsed else None,
        is_builtin=db_schema.is_builtin,
        created_at=db_schema.created_at,
    )


def update_entity_type_schema(db: Session, schema_id: str, update: schemas.EntityTypeSchemaUpdate) -> Optional[schemas.EntityTypeSchemaOut]:
    db_schema = db.query(models.EntityTypeSchema).filter(
        models.EntityTypeSchema.id == schema_id
    ).first()
    if not db_schema:
        return None
    if update.label_en is not None:
        db_schema.label_en = update.label_en
    if update.label_ru is not None:
        db_schema.label_ru = update.label_ru
    if update.icon is not None:
        db_schema.icon = update.icon
    if update.color is not None:
        db_schema.color = update.color
    if update.fields is not None:
        db_schema.fields = json.dumps([f.model_dump() for f in update.fields])
    db.commit()
    db.refresh(db_schema)
    fields_parsed = json.loads(db_schema.fields) if db_schema.fields else None
    return schemas.EntityTypeSchemaOut(
        id=db_schema.id,
        name=db_schema.name,
        label_en=db_schema.label_en,
        label_ru=db_schema.label_ru,
        icon=db_schema.icon,
        color=db_schema.color,
        fields=[schemas.FieldDefinition(**f) for f in fields_parsed] if fields_parsed else None,
        is_builtin=db_schema.is_builtin,
        created_at=db_schema.created_at,
    )


def delete_entity_type_schema(db: Session, schema_id: str) -> bool:
    db_schema = db.query(models.EntityTypeSchema).filter(
        models.EntityTypeSchema.id == schema_id,
        models.EntityTypeSchema.is_builtin == False
    ).first()
    if not db_schema:
        return False
    db.delete(db_schema)
    db.commit()
    return True


# ── Entities ──────────────────────────────────────────────────────────────────

def get_entities(db: Session, skip: int = 0, limit: int = 100, type_filter: Optional[str] = None) -> List[schemas.EntityOut]:
    q = db.query(models.Entity)
    if type_filter:
        q = q.filter(models.Entity.type == type_filter)
    entities = q.order_by(models.Entity.created_at.desc()).offset(skip).limit(limit).all()
    return [_entity_to_out(e) for e in entities]


def get_entity(db: Session, entity_id: str) -> Optional[schemas.EntityOut]:
    entity = db.query(models.Entity).filter(models.Entity.id == entity_id).first()
    return _entity_to_out(entity) if entity else None


def create_entity(db: Session, entity: schemas.EntityCreate) -> schemas.EntityOut:
    db_entity = models.Entity(
        id=str(uuid.uuid4()),
        type=entity.type,
        value=entity.value,
        metadata_=json.dumps(entity.metadata) if entity.metadata else None,
        notes=entity.notes,
        canvas_layout=json.dumps(entity.canvas_layout) if entity.canvas_layout else None,
        created_at=datetime.utcnow(),
    )
    db.add(db_entity)
    db.commit()
    db.refresh(db_entity)
    return _entity_to_out(db_entity)


def update_entity(db: Session, entity_id: str, update: schemas.EntityUpdate) -> Optional[schemas.EntityOut]:
    db_entity = db.query(models.Entity).filter(models.Entity.id == entity_id).first()
    if not db_entity:
        return None
    if update.value is not None:
        db_entity.value = update.value
    if update.metadata is not None:
        db_entity.metadata_ = json.dumps(update.metadata)
    if update.notes is not None:
        db_entity.notes = update.notes
    if update.canvas_layout is not None:
        db_entity.canvas_layout = json.dumps(update.canvas_layout)
    db.commit()
    db.refresh(db_entity)
    return _entity_to_out(db_entity)


def delete_entity(db: Session, entity_id: str) -> bool:
    db_entity = db.query(models.Entity).filter(models.Entity.id == entity_id).first()
    if not db_entity:
        return False
    db.delete(db_entity)
    db.commit()
    return True


def search_entities(db: Session, query: str, limit: int = 50) -> List[schemas.EntityOut]:
    entities = db.query(models.Entity).filter(
        or_(
            models.Entity.value.ilike(f"%{query}%"),
            models.Entity.type.ilike(f"%{query}%"),
        )
    ).limit(limit).all()
    return [_entity_to_out(e) for e in entities]


# ── Relationships ─────────────────────────────────────────────────────────────

def get_relationships(db: Session, skip: int = 0, limit: int = 100) -> List[schemas.RelationshipOut]:
    rels = db.query(models.Relationship).offset(skip).limit(limit).all()
    return [_rel_to_out(r) for r in rels]


def create_relationship(db: Session, rel: schemas.RelationshipCreate) -> schemas.RelationshipOut:
    db_rel = models.Relationship(
        id=str(uuid.uuid4()),
        source_entity_id=rel.source_entity_id,
        target_entity_id=rel.target_entity_id,
        type=rel.type,
        metadata_=json.dumps(rel.metadata) if rel.metadata else None,
        created_at=datetime.utcnow(),
    )
    db.add(db_rel)
    db.commit()
    db.refresh(db_rel)
    return _rel_to_out(db_rel)


def delete_relationship(db: Session, rel_id: str) -> bool:
    db_rel = db.query(models.Relationship).filter(models.Relationship.id == rel_id).first()
    if not db_rel:
        return False
    db.delete(db_rel)
    db.commit()
    return True


def get_entity_relationships(db: Session, entity_id: str) -> List[schemas.RelationshipWithEntities]:
    rels = db.query(models.Relationship).filter(
        or_(
            models.Relationship.source_entity_id == entity_id,
            models.Relationship.target_entity_id == entity_id,
        )
    ).all()
    result = []
    for r in rels:
        out = schemas.RelationshipWithEntities(
            id=r.id,
            source_entity_id=r.source_entity_id,
            target_entity_id=r.target_entity_id,
            type=r.type,
            metadata=json.loads(r.metadata_) if r.metadata_ else None,
            created_at=r.created_at,
            source_entity=_entity_to_out(r.source_entity) if r.source_entity else None,
            target_entity=_entity_to_out(r.target_entity) if r.target_entity else None,
        )
        result.append(out)
    return result


# ── Graph ─────────────────────────────────────────────────────────────────────

def get_entity_graph(db: Session, entity_id: str, depth: int = 2) -> schemas.GraphResponse:
    visited_nodes: dict = {}
    visited_edges: dict = {}
    to_visit = [entity_id]

    for _ in range(depth):
        next_visit = []
        for eid in to_visit:
            entity = db.query(models.Entity).filter(models.Entity.id == eid).first()
            if entity and eid not in visited_nodes:
                visited_nodes[eid] = entity
                rels = db.query(models.Relationship).filter(
                    or_(
                        models.Relationship.source_entity_id == eid,
                        models.Relationship.target_entity_id == eid,
                    )
                ).all()
                for r in rels:
                    if r.id not in visited_edges:
                        visited_edges[r.id] = r
                        neighbor_id = r.target_entity_id if r.source_entity_id == eid else r.source_entity_id
                        if neighbor_id not in visited_nodes:
                            next_visit.append(neighbor_id)
        to_visit = next_visit

    nodes = [
        schemas.GraphNode(
            id=e.id, type=e.type, value=e.value,
            metadata=json.loads(e.metadata_) if e.metadata_ else None,
        )
        for e in visited_nodes.values()
    ]
    edges = [
        schemas.GraphEdge(
            id=r.id, source=r.source_entity_id, target=r.target_entity_id,
            type=r.type,
            metadata=json.loads(r.metadata_) if r.metadata_ else None,
        )
        for r in visited_edges.values()
    ]
    return schemas.GraphResponse(nodes=nodes, edges=edges)


# ── Stats ─────────────────────────────────────────────────────────────────────

def get_stats(db: Session) -> schemas.StatsResponse:
    total_entities = db.query(func.count(models.Entity.id)).scalar()
    total_relationships = db.query(func.count(models.Relationship.id)).scalar()
    type_counts = db.query(models.Entity.type, func.count(models.Entity.id)).group_by(models.Entity.type).all()
    recent = db.query(models.Entity).order_by(models.Entity.created_at.desc()).limit(5).all()
    return schemas.StatsResponse(
        total_entities=total_entities,
        total_relationships=total_relationships,
        entities_by_type={t: c for t, c in type_counts},
        recent_entities=[_entity_to_out(e) for e in recent],
    )

def update_entity_type_schema(db: Session, schema_id: str, data: schemas.EntityTypeSchemaUpdate) -> schemas.EntityTypeSchemaOut | None:
    db_schema = db.query(models.EntityTypeSchema).filter(
        models.EntityTypeSchema.id == schema_id,
    ).first()
    if not db_schema:
        return None
    if data.label_en is not None:
        db_schema.label_en = data.label_en
    if data.label_ru is not None:
        db_schema.label_ru = data.label_ru
    if data.icon is not None:
        db_schema.icon = data.icon
    if data.color is not None:
        db_schema.color = data.color
    if data.fields is not None:
        db_schema.fields = json.dumps([f.model_dump() for f in data.fields])
    db.commit()
    db.refresh(db_schema)
    fields_parsed = json.loads(db_schema.fields) if db_schema.fields else None
    return schemas.EntityTypeSchemaOut(
        id=db_schema.id,
        name=db_schema.name,
        label_en=db_schema.label_en,
        label_ru=db_schema.label_ru,
        icon=db_schema.icon,
        color=db_schema.color,
        fields=[schemas.FieldDefinition(**f) for f in fields_parsed] if fields_parsed else None,
        is_builtin=db_schema.is_builtin,
        created_at=db_schema.created_at,
    )
