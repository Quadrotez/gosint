from pydantic import BaseModel, field_validator
from typing import Optional, Any, Dict, List
from datetime import datetime


# ── Auth ──────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    username: str
    password: str
    email: Optional[str] = None

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3 or len(v) > 32:
            raise ValueError("Username must be 3–32 characters")
        if not v.replace("_", "").replace("-", "").isalnum():
            raise ValueError("Only letters, digits, _ and - allowed")
        return v

    @field_validator("password")
    @classmethod
    def password_valid(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class UserOut(BaseModel):
    id: str
    username: str
    email: Optional[str]
    is_admin: bool
    is_active: bool
    session_lifetime_hours: int
    memory_limit_mb: Optional[int]
    created_at: datetime
    last_login: Optional[datetime]

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    current_password: Optional[str] = None
    session_lifetime_hours: Optional[int] = None


class AdminUserUpdate(BaseModel):
    is_active: Optional[bool] = None
    memory_limit_mb: Optional[int] = None
    is_admin: Optional[bool] = None
    password: Optional[str] = None


# ── Site Settings ─────────────────────────────────────────────────────────────

class SiteSettingsOut(BaseModel):
    default_language: str
    default_memory_limit_mb: int
    site_icon_b64: Optional[str]
    site_title: str
    registration_enabled: bool
    max_accounts_per_ip: int

    class Config:
        from_attributes = True


class SiteSettingsUpdate(BaseModel):
    default_language: Optional[str] = None
    default_memory_limit_mb: Optional[int] = None
    site_icon_b64: Optional[str] = None
    site_title: Optional[str] = None
    registration_enabled: Optional[bool] = None
    max_accounts_per_ip: Optional[int] = None


# ── Entity Type Schemas ───────────────────────────────────────────────────────

class FieldDefinition(BaseModel):
    name: str
    label_en: str
    label_ru: Optional[str] = None
    field_type: str = "text"
    required: bool = False


class EntityTypeSchemaBase(BaseModel):
    name: str
    label_en: str
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


# ── Relationships ─────────────────────────────────────────────────────────────

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


# ── Graph ─────────────────────────────────────────────────────────────────────

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


class GraphResponse(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]


# ── Stats ─────────────────────────────────────────────────────────────────────

class StatsResponse(BaseModel):
    total_entities: int
    total_relationships: int
    entities_by_type: Dict[str, int]
    recent_entities: List[EntityOut]


class StorageInfo(BaseModel):
    used_bytes: int
    used_mb: float
    limit_mb: int
    percent: float
