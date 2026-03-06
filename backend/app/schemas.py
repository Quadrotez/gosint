from pydantic import BaseModel
from typing import Optional, Any, Dict, List
from datetime import datetime


# ── Entity Type Schemas ────────────────────────────────────────────────────────

class FieldDefinition(BaseModel):
    name: str          # internal key, e.g. "username"
    label_en: str      # English label
    label_ru: Optional[str] = None  # Russian label
    field_type: str = "text"  # text | date | url | number
    required: bool = False


class EntityTypeSchemaBase(BaseModel):
    name: str
    label_en: str
    label_ru: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    fields: Optional[List[FieldDefinition]] = None


class EntityTypeSchemaUpdate(BaseModel):
    label_en: Optional[str] = None
    label_ru: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    fields: Optional[List[FieldDefinition]] = None


class EntityTypeSchemaCreate(EntityTypeSchemaBase):
    pass


class EntityTypeSchemaUpdate(BaseModel):
    label_en: Optional[str] = None
    label_ru: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    fields: Optional[List[FieldDefinition]] = None


class EntityTypeSchemaOut(EntityTypeSchemaBase):
    id: str
    is_builtin: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ── Entities ──────────────────────────────────────────────────────────────────
class EntityBase(BaseModel):
    type: str
    value: str
    metadata: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None
    canvas_layout: Optional[Dict[str, Any]] = None


class EntityCreate(EntityBase):
    pass


class EntityUpdate(BaseModel):
    value: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None
    canvas_layout: Optional[Dict[str, Any]] = None


class EntityOut(EntityBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True


class RelationshipBase(BaseModel):
    source_entity_id: str
    target_entity_id: str
    type: str
    metadata: Optional[Dict[str, Any]] = None


class RelationshipCreate(RelationshipBase):
    pass


class RelationshipOut(RelationshipBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True


class RelationshipWithEntities(RelationshipOut):
    source_entity: Optional[EntityOut] = None
    target_entity: Optional[EntityOut] = None


class GraphNode(BaseModel):
    id: str
    type: str
    value: str
    metadata: Optional[Dict[str, Any]] = None


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    type: str
    metadata: Optional[Dict[str, Any]] = None


class GraphResponse(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]


class StatsResponse(BaseModel):
    total_entities: int
    total_relationships: int
    entities_by_type: Dict[str, int]
    recent_entities: List[EntityOut]
