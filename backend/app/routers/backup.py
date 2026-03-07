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
from ..encryption import decrypt_field, is_encrypted

router = APIRouter(prefix="/backup", tags=["backup"])


def _decrypt_opt(key, value):
    """Decrypt value if key present and value is encrypted, else return as-is."""
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


def _rel_to_dict(r: models.Relationship) -> dict:
    return {
        "id": r.id,
        "source_entity_id": r.source_entity_id,
        "target_entity_id": r.target_entity_id,
        "type": r.type,
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
        "fields": s.fields or "[]",
        "is_builtin": s.is_builtin,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


# ── Export ────────────────────────────────────────────────────────────────────

@router.get("/export")
def export_backup(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Export all user data as ZIP (plaintext — decrypted on export)."""
    dec_key = crud._get_enc_key(user)

    entities = db.query(models.Entity).filter(models.Entity.user_id == user.id).all()
    # Only export this user's relationships
    relationships = db.query(models.Relationship).filter(models.Relationship.user_id == user.id).all()
    schemas_list = db.query(models.EntityTypeSchema).filter(models.EntityTypeSchema.user_id == user.id).all()

    entities_data = [_entity_to_dict(e, dec_key) for e in entities]
    rels_data = [_rel_to_dict(r) for r in relationships]
    schemas_data = [_schema_to_dict(s) for s in schemas_list]

    # Pull out embedded photos to reduce data.json size
    photos: dict[str, str] = {}
    for e_dict in entities_data:
        photo = e_dict.get("metadata", {}).get("photo", "")
        if photo and photo.startswith("data:image"):
            photos[e_dict["id"]] = photo
            e_dict["metadata"]["photo"] = f"__photo__{e_dict['id']}"

    export_data = {
        "version": "2.1",
        "exported_at": datetime.utcnow().isoformat(),
        "entities": entities_data,
        "relationships": rels_data,
        "schemas": schemas_data,
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
    """Import a backup ZIP — entities are assigned to the importing user and encrypted."""
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
    stats = {"entities": 0, "relationships": 0, "schemas": 0, "skipped": 0}

    # ── Schemas ──────────────────────────────────────────────────────────────
    existing_schema_names = {
        s.name for s in db.query(models.EntityTypeSchema)
        .filter(models.EntityTypeSchema.user_id == user.id).all()
    }
    for s in data.get("schemas", []):
        if s.get("is_builtin"):
            continue
        if s["name"] in existing_schema_names:
            stats["skipped"] += 1
            continue
        db.add(models.EntityTypeSchema(
            id=s["id"],
            user_id=user.id,          # ← FIX: was missing
            name=s["name"],
            label_en=s["label_en"],
            label_ru=s.get("label_ru"),
            icon=s.get("icon"),
            color=s.get("color"),
            fields=s.get("fields", "[]"),
            is_builtin=False,
        ))
        try:
            db.commit()
            stats["schemas"] += 1
        except Exception:
            db.rollback()

    # ── Entities ─────────────────────────────────────────────────────────────
    existing_ids = {row[0] for row in db.query(models.Entity.id).all()}
    for e in data.get("entities", []):
        if e["id"] in existing_ids:
            stats["skipped"] += 1
            continue

        meta = e.get("metadata") or {}
        # Restore photo from ZIP
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
            user_id=user.id,          # ← FIX: was missing
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
    existing_rel_ids = {row[0] for row in db.query(models.Relationship.id).all()}
    all_entity_ids = {row[0] for row in db.query(models.Entity.id).all()}
    for r in data.get("relationships", []):
        if r["id"] in existing_rel_ids:
            stats["skipped"] += 1
            continue
        if r["source_entity_id"] not in all_entity_ids or r["target_entity_id"] not in all_entity_ids:
            stats["skipped"] += 1
            continue
        new_r = models.Relationship(
            id=r["id"],
            user_id=user.id,          # ← FIX: was missing
            source_entity_id=r["source_entity_id"],
            target_entity_id=r["target_entity_id"],
            type=r["type"],
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

    return {"success": True, "imported": stats}
