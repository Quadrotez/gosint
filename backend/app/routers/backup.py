import io
import json
import zipfile
import base64
import re
from datetime import datetime
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..database import get_db
from .. import models, schemas, crud
from ..deps import get_current_user

router = APIRouter(prefix="/backup", tags=["backup"])


def _entity_to_dict(e: models.Entity) -> dict:
    meta = {}
    if e.metadata_:
        try:
            meta = json.loads(e.metadata_)
        except Exception:
            meta = {}
    return {
        "id": e.id,
        "type": e.type,
        "value": e.value,
        "metadata": meta,
        "notes": e.notes or "",
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


@router.get("/export")
def export_backup(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Export full database as a ZIP archive (data.json + embedded base64 photos)."""
    entities = db.query(models.Entity).filter(models.Entity.user_id == user.id).all()
    relationships = db.query(models.Relationship).all()
    entity_schemas = db.query(models.EntityTypeSchema).all()

    entities_data = [_entity_to_dict(e) for e in entities]
    relationships_data = [_rel_to_dict(r) for r in relationships]
    schemas_data = [_schema_to_dict(s) for s in entity_schemas]

    # Collect photo data URIs from entity metadata
    photos: dict[str, str] = {}
    for e_dict in entities_data:
        meta = e_dict.get("metadata", {})
        photo = meta.get("photo", "")
        if photo and photo.startswith("data:image"):
            # Store photo under entity ID, strip from inline metadata for smaller json
            photos[e_dict["id"]] = photo
            e_dict["metadata"]["photo"] = f"__photo__{e_dict['id']}"

    export_data = {
        "version": "2.0",
        "exported_at": datetime.utcnow().isoformat(),
        "entities": entities_data,
        "relationships": relationships_data,
        "schemas": schemas_data,
    }

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("data.json", json.dumps(export_data, ensure_ascii=False, indent=2))
        for entity_id, photo_data_uri in photos.items():
            # Extract base64 payload and mime type
            # data:image/jpeg;base64,XXXX
            match = re.match(r"data:(image/\w+);base64,(.+)", photo_data_uri)
            if match:
                mime = match.group(1)
                b64 = match.group(2)
                ext = mime.split("/")[1]
                zf.writestr(f"photos/{entity_id}.{ext}", base64.b64decode(b64))

    buf.seek(0)
    fname = f"osint_backup_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.zip"
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={fname}"},
    )


@router.post("/import")
async def import_backup(file: UploadFile = File(...), db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Import a backup ZIP. Merges entities/relationships by ID (skip existing)."""
    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="File must be a .zip backup")

    content = await file.read()
    try:
        zf = zipfile.ZipFile(io.BytesIO(content))
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Invalid ZIP file")

    if "data.json" not in zf.namelist():
        raise HTTPException(status_code=400, detail="data.json not found in archive")

    data = json.loads(zf.read("data.json").decode("utf-8"))

    # Load photos back from zip
    photo_map: dict[str, str] = {}
    for name in zf.namelist():
        if name.startswith("photos/"):
            entity_id = name.split("/")[1].rsplit(".", 1)[0]
            raw = zf.read(name)
            ext = name.rsplit(".", 1)[-1]
            mime = f"image/{ext}"
            b64 = base64.b64encode(raw).decode()
            photo_map[entity_id] = f"data:{mime};base64,{b64}"

    stats = {"entities": 0, "relationships": 0, "schemas": 0, "skipped": 0}

    # Import schemas (skip builtins, skip existing names)
    existing_schema_names = {s.name for s in db.query(models.EntityTypeSchema).all()}
    for s in data.get("schemas", []):
        if s.get("is_builtin"):
            continue
        if s["name"] in existing_schema_names:
            stats["skipped"] += 1
            continue
        new_s = models.EntityTypeSchema(
            id=s["id"],
            name=s["name"],
            label_en=s["label_en"],
            label_ru=s.get("label_ru"),
            icon=s.get("icon"),
            color=s.get("color"),
            fields=s.get("fields", "[]"),
            is_builtin=False,
        )
        try:
            db.add(new_s)
            db.commit()
            stats["schemas"] += 1
        except Exception:
            db.rollback()

    # Import entities
    existing_ids = {row[0] for row in db.query(models.Entity.id).all()}
    for e in data.get("entities", []):
        if e["id"] in existing_ids:
            stats["skipped"] += 1
            continue
        meta = e.get("metadata") or {}
        # Restore photo
        if meta.get("photo", "").startswith("__photo__"):
            entity_id = meta["photo"].replace("__photo__", "")
            if entity_id in photo_map:
                meta["photo"] = photo_map[entity_id]
            else:
                del meta["photo"]

        new_e = models.Entity(
            id=e["id"],
            type=e["type"],
            value=e["value"],
            metadata_=json.dumps(meta, ensure_ascii=False) if meta else None,
            notes=e.get("notes") or None,
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

    # Import relationships
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
