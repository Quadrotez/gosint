import io
import json
import zipfile
import base64
import re
from datetime import datetime
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, crud
from ..deps import get_current_user
from ..encryption import decrypt_field, is_encrypted, encrypt_field

router = APIRouter(prefix="/backup", tags=["backup"])

BACKUP_VERSION = "3.0"


def _decrypt_opt(key, value):
    if key and value and is_encrypted(value):
        return decrypt_field(key, value)
    return value


def _entity_to_dict(e: models.Entity, dec_key=None) -> dict:
    raw_meta = _decrypt_opt(dec_key, e.metadata_) or ""
    meta = {}
    if raw_meta:
        try:
            meta = json.loads(raw_meta)
        except Exception:
            meta = {}
    return {
        "id": e.id,
        "type": e.type,
        "value": _decrypt_opt(dec_key, e.value),
        "metadata": meta,
        "notes": _decrypt_opt(dec_key, e.notes) or "",
        "canvas_layout": e.canvas_layout or "",
        "created_at": e.created_at.isoformat() if e.created_at else None,
    }


def _rel_to_dict(r: models.Relationship, dec_key=None) -> dict:
    return {
        "id": r.id,
        "source_entity_id": r.source_entity_id,
        "target_entity_id": r.target_entity_id,
        "type": r.type,
        "notes": _decrypt_opt(dec_key, r.notes) or "",
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


def _schema_to_dict(s: models.EntityTypeSchema) -> dict:
    return {
        "id": s.id,
        "name": s.name,
        "label_en": s.label_en,
        "label_ru": s.label_ru or "",
        "icon": s.icon or "",
        "color": s.color or "",
        "icon_image": s.icon_image or "",
        "fields": json.loads(s.fields) if s.fields else [],
        "is_builtin": s.is_builtin,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


def _rel_type_schema_to_dict(s: models.RelationshipTypeSchema) -> dict:
    return {
        "id": s.id,
        "name": s.name,
        "label_en": s.label_en,
        "label_ru": s.label_ru or "",
        "description": s.description or "",
        "emoji": s.emoji or "🔗",
        "color": s.color or "",
        "fields": json.loads(s.fields) if s.fields else [],
        "is_bidirectional": bool(s.is_bidirectional),
        "is_builtin": s.is_builtin,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


def _group_to_dict(g: models.EntityGroup) -> dict:
    entity_ids = json.loads(g.entity_ids) if g.entity_ids else []
    return {
        "id": g.id,
        "name": g.name,
        "description": g.description or "",
        "entity_ids": entity_ids,
        "created_at": g.created_at.isoformat() if g.created_at else None,
    }


# ── Export ────────────────────────────────────────────────────────────────────

@router.get("/export")
def export_backup(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Full export: entities, relationships, entity-type schemas,
    relationship-type schemas, entity groups — all in one ZIP."""
    dec_key = crud._get_enc_key(user)

    entities      = db.query(models.Entity).filter(models.Entity.user_id == user.id).all()
    relationships = db.query(models.Relationship).filter(models.Relationship.user_id == user.id).all()
    ent_schemas   = db.query(models.EntityTypeSchema).filter(models.EntityTypeSchema.user_id == user.id).all()
    rel_schemas   = db.query(models.RelationshipTypeSchema).filter(models.RelationshipTypeSchema.user_id == user.id).all()
    groups        = db.query(models.EntityGroup).filter(models.EntityGroup.user_id == user.id).all()

    entities_data   = [_entity_to_dict(e, dec_key)      for e in entities]
    rels_data       = [_rel_to_dict(r, dec_key)          for r in relationships]
    ent_schemas_data = [_schema_to_dict(s)               for s in ent_schemas]
    rel_schemas_data = [_rel_type_schema_to_dict(s)      for s in rel_schemas]
    groups_data     = [_group_to_dict(g)                 for g in groups]

    # Extract embedded photos to separate files (keep data.json small)
    photos: dict[str, str] = {}
    for e_dict in entities_data:
        photo = e_dict.get("metadata", {}).get("photo", "")
        if photo and photo.startswith("data:image"):
            photos[e_dict["id"]] = photo
            e_dict["metadata"]["photo"] = f"__photo__{e_dict['id']}"

    export_data = {
        "version": BACKUP_VERSION,
        "exported_at": datetime.utcnow().isoformat(),
        "entities": entities_data,
        "relationships": rels_data,
        "entity_type_schemas": ent_schemas_data,
        "relationship_type_schemas": rel_schemas_data,
        "entity_groups": groups_data,
        # backward-compat alias
        "schemas": ent_schemas_data,
    }

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("data.json", json.dumps(export_data, ensure_ascii=False, indent=2))
        for entity_id, photo_uri in photos.items():
            m = re.match(r"data:(image/\w+);base64,(.+)", photo_uri)
            if m:
                ext = m.group(1).split("/")[1]
                zf.writestr(f"photos/{entity_id}.{ext}", base64.b64decode(m.group(2)))

    buf.seek(0)
    fname = f"osint_backup_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.zip"
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={fname}"},
    )


# ── Smart Import ──────────────────────────────────────────────────────────────

def _fields_match(stored_fields_json: str | None, imported_fields: list) -> bool:
    """Check if stored field definitions are identical to imported ones."""
    try:
        stored = json.loads(stored_fields_json) if stored_fields_json else []
    except Exception:
        stored = []
    # Compare by serialising to canonical JSON
    def canon(lst):
        return json.dumps(sorted(lst, key=lambda x: x.get("name", "")), sort_keys=True)
    return canon(stored) == canon(imported_fields)


@router.post("/import")
async def import_backup(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """
    Smart full-restore import.

    Rules:
    - Entity-type schemas: if name exists AND fields match → skip.
      If name exists but fields differ → overwrite. New name → create.
    - Relationship-type schemas: same logic.
    - Entities: if ID already in DB → skip (preserves existing data).
      New ID → create and encrypt.
    - Relationships: if ID exists → skip. New → create (only if both endpoints exist).
    - Entity groups: if ID exists → skip; new → create.
    """
    if not (file.filename or "").endswith(".zip"):
        raise HTTPException(status_code=400, detail="File must be a .zip backup")

    content = await file.read()
    try:
        zf = zipfile.ZipFile(io.BytesIO(content))
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Invalid ZIP file")

    if "data.json" not in zf.namelist():
        raise HTTPException(status_code=400, detail="data.json not found in archive")

    data = json.loads(zf.read("data.json").decode("utf-8"))

    # Restore photo map
    photo_map: dict[str, str] = {}
    for name in zf.namelist():
        if name.startswith("photos/"):
            entity_id = name.split("/")[1].rsplit(".", 1)[0]
            ext = name.rsplit(".", 1)[-1]
            b64 = base64.b64encode(zf.read(name)).decode()
            photo_map[entity_id] = f"data:image/{ext};base64,{b64}"

    enc_key = crud._get_enc_key(user)
    stats = {
        "entity_type_schemas": 0,
        "relationship_type_schemas": 0,
        "entities": 0,
        "relationships": 0,
        "entity_groups": 0,
        "skipped": 0,
        "overwritten": 0,
    }

    # ── Entity Type Schemas ──────────────────────────────────────────────────
    # Support both new key and v2 backup alias
    ent_schemas_import = data.get("entity_type_schemas") or data.get("schemas") or []
    existing_ent_schemas = {
        s.name: s for s in db.query(models.EntityTypeSchema)
        .filter(models.EntityTypeSchema.user_id == user.id).all()
    }
    for s in ent_schemas_import:
        if s.get("is_builtin"):
            stats["skipped"] += 1
            continue
        imported_fields = s.get("fields") or []
        if isinstance(imported_fields, str):
            try:
                imported_fields = json.loads(imported_fields)
            except Exception:
                imported_fields = []

        existing = existing_ent_schemas.get(s["name"])
        if existing:
            if _fields_match(existing.fields, imported_fields):
                stats["skipped"] += 1
                continue
            # Overwrite — fields differ
            existing.label_en    = s.get("label_en", existing.label_en)
            existing.label_ru    = s.get("label_ru") or existing.label_ru
            existing.icon        = s.get("icon") or existing.icon
            existing.color       = s.get("color") or existing.color
            existing.icon_image  = s.get("icon_image") or existing.icon_image
            existing.fields      = json.dumps(imported_fields)
            db.commit()
            stats["overwritten"] += 1
        else:
            db.add(models.EntityTypeSchema(
                id=s["id"],
                user_id=user.id,
                name=s["name"],
                label_en=s["label_en"],
                label_ru=s.get("label_ru"),
                icon=s.get("icon"),
                color=s.get("color"),
                icon_image=s.get("icon_image"),
                fields=json.dumps(imported_fields) if imported_fields else None,
                is_builtin=False,
            ))
            try:
                db.commit()
                stats["entity_type_schemas"] += 1
            except Exception:
                db.rollback()

    # ── Relationship Type Schemas ────────────────────────────────────────────
    rel_schemas_import = data.get("relationship_type_schemas") or []
    existing_rel_schemas = {
        s.name: s for s in db.query(models.RelationshipTypeSchema)
        .filter(models.RelationshipTypeSchema.user_id == user.id).all()
    }
    for s in rel_schemas_import:
        if s.get("is_builtin"):
            stats["skipped"] += 1
            continue
        imported_fields = s.get("fields") or []

        existing = existing_rel_schemas.get(s["name"])
        if existing:
            if _fields_match(existing.fields, imported_fields):
                stats["skipped"] += 1
                continue
            existing.label_en       = s.get("label_en", existing.label_en)
            existing.label_ru       = s.get("label_ru") or existing.label_ru
            existing.description    = s.get("description") or existing.description
            existing.emoji          = s.get("emoji") or existing.emoji
            existing.color          = s.get("color") or existing.color
            existing.is_bidirectional = s.get("is_bidirectional", existing.is_bidirectional)
            existing.fields         = json.dumps(imported_fields) if imported_fields else None
            db.commit()
            stats["overwritten"] += 1
        else:
            db.add(models.RelationshipTypeSchema(
                id=s["id"],
                user_id=user.id,
                name=s["name"],
                label_en=s["label_en"],
                label_ru=s.get("label_ru"),
                description=s.get("description"),
                emoji=s.get("emoji", "🔗"),
                color=s.get("color"),
                fields=json.dumps(imported_fields) if imported_fields else None,
                is_bidirectional=s.get("is_bidirectional", False),
                is_builtin=False,
            ))
            try:
                db.commit()
                stats["relationship_type_schemas"] += 1
            except Exception:
                db.rollback()

    # ── Entities ─────────────────────────────────────────────────────────────
    existing_ids = {row[0] for row in db.query(models.Entity.id).all()}
    for e in data.get("entities", []):
        if e["id"] in existing_ids:
            stats["skipped"] += 1
            continue

        meta = e.get("metadata") or {}
        if isinstance(meta.get("photo"), str) and meta["photo"].startswith("__photo__"):
            original_id = meta["photo"].replace("__photo__", "")
            restored = photo_map.get(original_id, "")
            if restored:
                meta["photo"] = restored
            else:
                meta.pop("photo", None)

        meta_json = json.dumps(meta, ensure_ascii=False) if meta else None
        value = e.get("value") or ""
        notes = e.get("notes") or None

        new_e = models.Entity(
            id=e["id"],
            user_id=user.id,
            type=e["type"],
            value=crud._enc(enc_key, value),
            metadata_=crud._enc(enc_key, meta_json) if meta_json else None,
            notes=crud._enc(enc_key, notes) if notes else None,
            canvas_layout=e.get("canvas_layout") or None,
        )
        if e.get("created_at"):
            try:
                new_e.created_at = datetime.fromisoformat(e["created_at"])
            except Exception:
                pass
        try:
            db.add(new_e)
            db.commit()
            stats["entities"] += 1
        except Exception:
            db.rollback()

    # ── Relationships ─────────────────────────────────────────────────────────
    existing_rel_ids  = {row[0] for row in db.query(models.Relationship.id).all()}
    all_entity_ids    = {row[0] for row in db.query(models.Entity.id).all()}
    for r in data.get("relationships", []):
        if r["id"] in existing_rel_ids:
            stats["skipped"] += 1
            continue
        if r["source_entity_id"] not in all_entity_ids or r["target_entity_id"] not in all_entity_ids:
            stats["skipped"] += 1
            continue
        notes = r.get("notes") or None
        new_r = models.Relationship(
            id=r["id"],
            user_id=user.id,
            source_entity_id=r["source_entity_id"],
            target_entity_id=r["target_entity_id"],
            type=r["type"],
            notes=crud._enc(enc_key, notes) if notes else None,
        )
        if r.get("created_at"):
            try:
                new_r.created_at = datetime.fromisoformat(r["created_at"])
            except Exception:
                pass
        try:
            db.add(new_r)
            db.commit()
            stats["relationships"] += 1
        except Exception:
            db.rollback()

    # ── Entity Groups ─────────────────────────────────────────────────────────
    existing_group_ids = {row[0] for row in db.query(models.EntityGroup.id).all()}
    for g in data.get("entity_groups", []):
        if g["id"] in existing_group_ids:
            stats["skipped"] += 1
            continue
        entity_ids_list = g.get("entity_ids") or []
        new_g = models.EntityGroup(
            id=g["id"],
            user_id=user.id,
            name=g["name"],
            description=g.get("description") or None,
            entity_ids=json.dumps(entity_ids_list),
        )
        if g.get("created_at"):
            try:
                new_g.created_at = datetime.fromisoformat(g["created_at"])
                new_g.updated_at = new_g.created_at
            except Exception:
                pass
        try:
            db.add(new_g)
            db.commit()
            stats["entity_groups"] += 1
        except Exception:
            db.rollback()

    return {"success": True, "imported": stats}
