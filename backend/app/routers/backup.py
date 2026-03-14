import io
import json
import zipfile
import base64
import re
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..database import get_db
from .. import models, crud
from ..deps import get_current_user
from ..encryption import decrypt_field, is_encrypted

router = APIRouter(prefix="/backup", tags=["backup"])

BACKUP_VERSION = "3.0"


# ── Helpers ──────────────────────────────────────────────────────────────────

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


def _fields_match(stored_fields_json: Optional[str], imported_fields: list) -> bool:
    """Check if stored field definitions are identical to imported ones."""
    try:
        stored = json.loads(stored_fields_json) if stored_fields_json else []
    except Exception:
        stored = []
    def canon(lst):
        return json.dumps(sorted(lst, key=lambda x: x.get("name", "")), sort_keys=True)
    return canon(stored) == canon(imported_fields)


# ── Export ────────────────────────────────────────────────────────────────────

@router.get("/export")
def export_backup(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    dec_key = crud._get_enc_key(user)

    entities      = db.query(models.Entity).filter(models.Entity.user_id == user.id).all()
    relationships = db.query(models.Relationship).filter(models.Relationship.user_id == user.id).all()
    ent_schemas   = db.query(models.EntityTypeSchema).filter(models.EntityTypeSchema.user_id == user.id).all()
    rel_schemas   = db.query(models.RelationshipTypeSchema).filter(models.RelationshipTypeSchema.user_id == user.id).all()
    groups        = db.query(models.EntityGroup).filter(models.EntityGroup.user_id == user.id).all()

    entities_data    = [_entity_to_dict(e, dec_key)      for e in entities]
    rels_data        = [_rel_to_dict(r, dec_key)          for r in relationships]
    ent_schemas_data = [_schema_to_dict(s)                for s in ent_schemas]
    rel_schemas_data = [_rel_type_schema_to_dict(s)       for s in rel_schemas]
    groups_data      = [_group_to_dict(g)                 for g in groups]

    photos = {}
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
        "schemas": ent_schemas_data,   # backward-compat alias
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


# ── Import ────────────────────────────────────────────────────────────────────

@router.post("/import")
async def import_backup(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
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

    # Restore photos
    photo_map = {}
    for name in zf.namelist():
        if name.startswith("photos/"):
            eid = name.split("/")[1].rsplit(".", 1)[0]
            ext = name.rsplit(".", 1)[-1]
            b64 = base64.b64encode(zf.read(name)).decode()
            photo_map[eid] = f"data:image/{ext};base64,{b64}"

    # We need the user_id as a plain string — capture it before any commits
    user_id = str(user.id)
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
    errors = []

    # ── Entity Type Schemas ──────────────────────────────────────────────────
    ent_schemas_import = data.get("entity_type_schemas") or data.get("schemas") or []
    existing_ent_schemas = {
        s.name: s for s in db.query(models.EntityTypeSchema)
        .filter(models.EntityTypeSchema.user_id == user_id).all()
    }
    for s in ent_schemas_import:
        if s.get("is_builtin"):
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
            existing.label_en   = s.get("label_en", existing.label_en)
            existing.label_ru   = s.get("label_ru") or existing.label_ru
            existing.icon       = s.get("icon") or existing.icon
            existing.color      = s.get("color") or existing.color
            existing.icon_image = s.get("icon_image") or existing.icon_image
            existing.fields     = json.dumps(imported_fields)
            db.flush()
            stats["overwritten"] += 1
        else:
            db.add(models.EntityTypeSchema(
                id=s["id"],
                user_id=user_id,
                name=s["name"],
                label_en=s["label_en"],
                label_ru=s.get("label_ru"),
                icon=s.get("icon"),
                color=s.get("color"),
                icon_image=s.get("icon_image"),
                fields=json.dumps(imported_fields) if imported_fields else None,
                is_builtin=False,
            ))
            db.flush()
            stats["entity_type_schemas"] += 1

    # ── Relationship Type Schemas ────────────────────────────────────────────
    rel_schemas_import = data.get("relationship_type_schemas") or []
    existing_rel_schemas = {
        s.name: s for s in db.query(models.RelationshipTypeSchema)
        .filter(models.RelationshipTypeSchema.user_id == user_id).all()
    }
    for s in rel_schemas_import:
        if s.get("is_builtin"):
            continue
        imported_fields = s.get("fields") or []
        existing = existing_rel_schemas.get(s["name"])
        if existing:
            if _fields_match(existing.fields, imported_fields):
                stats["skipped"] += 1
                continue
            existing.label_en        = s.get("label_en", existing.label_en)
            existing.label_ru        = s.get("label_ru") or existing.label_ru
            existing.description     = s.get("description") or existing.description
            existing.emoji           = s.get("emoji") or existing.emoji
            existing.color           = s.get("color") or existing.color
            existing.is_bidirectional = s.get("is_bidirectional", existing.is_bidirectional)
            existing.fields          = json.dumps(imported_fields) if imported_fields else None
            db.flush()
            stats["overwritten"] += 1
        else:
            db.add(models.RelationshipTypeSchema(
                id=s["id"],
                user_id=user_id,
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
            db.flush()
            stats["relationship_type_schemas"] += 1

    # ── Entities ──────────────────────────────────────────────────────────────
    #
    # Three cases for each entity ID from the backup:
    #   1. ID not in DB at all         → insert with original ID
    #   2. ID exists, owned by ME      → skip (already imported earlier)
    #   3. ID exists, owned by someone else → generate a fresh UUID, insert with new ID
    #
    # id_remap maps backup_id → actual_id_in_db so relationships use the right IDs.

    import uuid as _uuid_mod

    # Load (id → user_id) for all existing entities
    existing_entities_map = {row[0]: row[1] for row in db.execute(text("SELECT id, user_id FROM entities"))}
    # Track which backup IDs were successfully imported (or already mine) for rel linking
    # Maps backup_original_id → actual_id_used_in_this_db
    id_remap: dict = {}

    for e in data.get("entities", []):
        eid = e.get("id")
        if not eid:
            continue

        owner = existing_entities_map.get(eid)

        if owner == user_id:
            # Already mine — skip, but record mapping so rels still work
            id_remap[eid] = eid
            stats["skipped"] += 1
            continue

        # Pick the ID to use in the DB
        if owner is not None:
            # Taken by another user — mint a new UUID
            actual_id = str(_uuid_mod.uuid4())
        else:
            # Free — use original
            actual_id = eid

        # Restore photo
        meta = e.get("metadata") or {}
        if isinstance(meta.get("photo"), str) and meta["photo"].startswith("__photo__"):
            original_id = meta["photo"].replace("__photo__", "")
            restored = photo_map.get(original_id, "")
            if restored:
                meta["photo"] = restored
            else:
                meta.pop("photo", None)

        meta_json = json.dumps(meta, ensure_ascii=False) if meta else None
        value     = e.get("value") or ""
        notes     = e.get("notes") or None
        canvas    = e.get("canvas_layout") or None

        enc_value = crud._enc(enc_key, value)
        enc_meta  = crud._enc(enc_key, meta_json) if meta_json else None
        enc_notes = crud._enc(enc_key, notes) if notes else None

        created_at = datetime.utcnow()
        if e.get("created_at"):
            try:
                created_at = datetime.fromisoformat(e["created_at"])
            except Exception:
                pass

        try:
            db.execute(text("""
                INSERT INTO entities
                    (id, user_id, type, value, metadata, notes, canvas_layout, created_at)
                VALUES
                    (:id, :user_id, :type, :value, :metadata, :notes, :canvas_layout, :created_at)
            """), {
                "id":            actual_id,
                "user_id":       user_id,
                "type":          e["type"],
                "value":         enc_value,
                "metadata":      enc_meta,
                "notes":         enc_notes,
                "canvas_layout": canvas,
                "created_at":    created_at,
            })
            db.commit()
            id_remap[eid] = actual_id
            existing_entities_map[actual_id] = user_id
            stats["entities"] += 1
        except Exception as exc:
            errors.append(f"entity {eid[:8]}: {exc}")
            db.rollback()

    # ── Relationships ──────────────────────────────────────────────────────────
    # Use remapped IDs so relationships point to the correct entities in this DB.

    existing_rels_map = {row[0]: row[1] for row in db.execute(text("SELECT id, user_id FROM relationships"))}

    for r in data.get("relationships", []):
        rid = r.get("id")
        if not rid:
            continue

        # Remap source/target through id_remap
        src_orig = r.get("source_entity_id")
        tgt_orig = r.get("target_entity_id")
        src = id_remap.get(src_orig, src_orig)
        tgt = id_remap.get(tgt_orig, tgt_orig)

        # Skip if endpoints weren't successfully imported
        if src not in existing_entities_map or tgt not in existing_entities_map:
            stats["skipped"] += 1
            continue

        owner = existing_rels_map.get(rid)
        if owner == user_id:
            stats["skipped"] += 1
            continue

        # If RID taken by another user, mint a new one
        actual_rid = rid if owner is None else str(_uuid_mod.uuid4())

        notes     = r.get("notes") or None
        enc_notes = crud._enc(enc_key, notes) if notes else None

        created_at = datetime.utcnow()
        if r.get("created_at"):
            try:
                created_at = datetime.fromisoformat(r["created_at"])
            except Exception:
                pass

        try:
            db.execute(text("""
                INSERT INTO relationships
                    (id, user_id, source_entity_id, target_entity_id, type, notes, created_at)
                VALUES
                    (:id, :user_id, :src, :tgt, :type, :notes, :created_at)
            """), {
                "id":         actual_rid,
                "user_id":    user_id,
                "src":        src,
                "tgt":        tgt,
                "type":       r["type"],
                "notes":      enc_notes,
                "created_at": created_at,
            })
            db.commit()
            existing_rels_map[actual_rid] = user_id
            stats["relationships"] += 1
        except Exception as exc:
            errors.append(f"rel {rid[:8]}: {exc}")
            db.rollback()

    # ── Entity Groups ──────────────────────────────────────────────────────────
    existing_groups_map = {row[0]: row[1] for row in db.execute(text("SELECT id, user_id FROM entity_groups"))}
    for g in data.get("entity_groups", []):
        gid = g.get("id")
        if not gid:
            continue

        owner = existing_groups_map.get(gid)
        if owner == user_id:
            stats["skipped"] += 1
            continue

        actual_gid = gid if owner is None else str(_uuid_mod.uuid4())

        # Remap entity_ids through id_remap
        raw_eids = g.get("entity_ids") or []
        remapped_eids = [id_remap.get(i, i) for i in raw_eids]

        created_at = datetime.utcnow()
        if g.get("created_at"):
            try:
                created_at = datetime.fromisoformat(g["created_at"])
            except Exception:
                pass
        try:
            db.execute(text("""
                INSERT INTO entity_groups
                    (id, user_id, name, description, entity_ids, created_at, updated_at)
                VALUES (:id, :uid, :name, :desc, :eids, :ca, :ua)
            """), {
                "id":   actual_gid,
                "uid":  user_id,
                "name": g["name"],
                "desc": g.get("description"),
                "eids": json.dumps(remapped_eids),
                "ca":   created_at,
                "ua":   created_at,
            })
            db.commit()
            stats["entity_groups"] += 1
        except Exception as exc:
            errors.append(f"group {gid[:8]}: {exc}")
            db.rollback()

    # One final commit for all ORM changes (schemas)
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        errors.append(f"final commit: {exc}")

    return {"success": True, "imported": stats, "errors": errors}
