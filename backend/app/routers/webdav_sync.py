"""
WebDAV bidirectional sync for the OSINT Graph Platform.

Sync logic:
- Export current DB as backup ZIP → upload to WebDAV server
- Download existing backup from WebDAV → merge into local DB (same logic as /backup/import)
"""
import io
import json
import zipfile
import base64
import re
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from ..database import get_db
from .. import models
from ..deps import get_current_user
from .. import models
import urllib.request
import urllib.parse
import urllib.error
import ssl

router = APIRouter(prefix="/webdav", tags=["webdav"])


class WebDAVConfig(BaseModel):
    url: str          # e.g. https://cloud.example.com/remote.php/dav/files/user/osint/
    username: str
    password: str
    filename: Optional[str] = "osint_backup.zip"


def _make_opener(username: str, password: str):
    password_mgr = urllib.request.HTTPPasswordMgrWithDefaultRealm()
    password_mgr.add_password(None, "https://", username, password)
    password_mgr.add_password(None, "http://", username, password)
    auth_handler = urllib.request.HTTPBasicAuthHandler(password_mgr)
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    https_handler = urllib.request.HTTPSHandler(context=ctx)
    return urllib.request.build_opener(auth_handler, https_handler)


def _build_backup_zip(db: Session) -> bytes:
    """Reuse backup export logic to build zip bytes."""
    from .backup import _entity_to_dict, _rel_to_dict, _schema_to_dict
    entities = db.query(models.Entity).all()
    relationships = db.query(models.Relationship).all()
    entity_schemas = db.query(models.EntityTypeSchema).all()

    entities_data = [_entity_to_dict(e) for e in entities]
    rels_data = [_rel_to_dict(r) for r in relationships]
    schemas_data = [_schema_to_dict(s) for s in entity_schemas]

    photos: dict[str, str] = {}
    for e_dict in entities_data:
        meta = e_dict.get("metadata", {})
        photo = meta.get("photo", "")
        if photo and photo.startswith("data:image"):
            photos[e_dict["id"]] = photo
            e_dict["metadata"]["photo"] = f"__photo__{e_dict['id']}"

    export_data = {
        "version": "2.0",
        "exported_at": datetime.utcnow().isoformat(),
        "entities": entities_data,
        "relationships": rels_data,
        "schemas": schemas_data,
    }

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("data.json", json.dumps(export_data, ensure_ascii=False, indent=2))
        for entity_id, photo_data_uri in photos.items():
            match = re.match(r"data:(image/\w+);base64,(.+)", photo_data_uri)
            if match:
                mime = match.group(1)
                b64 = match.group(2)
                ext = mime.split("/")[1]
                zf.writestr(f"photos/{entity_id}.{ext}", base64.b64decode(b64))
    buf.seek(0)
    return buf.read()


def _merge_backup_zip(zip_bytes: bytes, db: Session) -> dict:
    """Merge a backup zip into current DB. Returns stats."""

    try:
        zf = zipfile.ZipFile(io.BytesIO(zip_bytes))
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Invalid ZIP received from WebDAV")

    if "data.json" not in zf.namelist():
        raise HTTPException(status_code=400, detail="data.json not in downloaded backup")

    data = json.loads(zf.read("data.json").decode("utf-8"))

    photo_map: dict[str, str] = {}
    for name in zf.namelist():
        if name.startswith("photos/"):
            entity_id = name.split("/")[1].rsplit(".", 1)[0]
            raw = zf.read(name)
            ext = name.rsplit(".", 1)[-1]
            b64 = base64.b64encode(raw).decode()
            photo_map[entity_id] = f"data:image/{ext};base64,{b64}"

    stats = {"entities": 0, "relationships": 0, "schemas": 0, "skipped": 0}

    existing_schema_names = {s.name for s in db.query(models.EntityTypeSchema).all()}
    for s in data.get("schemas", []):
        if s.get("is_builtin") or s["name"] in existing_schema_names:
            stats["skipped"] += 1
            continue
        new_s = models.EntityTypeSchema(
            id=s["id"], name=s["name"], label_en=s["label_en"],
            label_ru=s.get("label_ru"), icon=s.get("icon"), color=s.get("color"),
            fields=s.get("fields", "[]"), is_builtin=False,
        )
        try:
            db.add(new_s); db.commit(); stats["schemas"] += 1
        except Exception:
            db.rollback()

    existing_ids = {row[0] for row in db.query(models.Entity.id).all()}
    for e in data.get("entities", []):
        if e["id"] in existing_ids:
            stats["skipped"] += 1
            continue
        meta = e.get("metadata") or {}
        if meta.get("photo", "").startswith("__photo__"):
            eid = meta["photo"].replace("__photo__", "")
            if eid in photo_map:
                meta["photo"] = photo_map[eid]
            else:
                meta.pop("photo", None)
        new_e = models.Entity(
            id=e["id"], type=e["type"], value=e["value"],
            metadata_=json.dumps(meta, ensure_ascii=False) if meta else None,
            notes=e.get("notes") or None, canvas_layout=e.get("canvas_layout") or None,
        )
        if e.get("created_at"):
            try: new_e.created_at = datetime.fromisoformat(e["created_at"])
            except: pass
        try:
            db.add(new_e); db.commit(); stats["entities"] += 1
        except Exception:
            db.rollback()

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
            id=r["id"], source_entity_id=r["source_entity_id"],
            target_entity_id=r["target_entity_id"], type=r["type"],
        )
        if r.get("created_at"):
            try: new_r.created_at = datetime.fromisoformat(r["created_at"])
            except: pass
        try:
            db.add(new_r); db.commit(); stats["relationships"] += 1
        except Exception:
            db.rollback()

    return stats


@router.post("/test")
def test_connection(cfg: WebDAVConfig, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Test WebDAV connection credentials."""
    opener = _make_opener(cfg.username, cfg.password)
    url = cfg.url.rstrip("/") + "/"
    try:
        req = urllib.request.Request(url, method="PROPFIND")
        req.add_header("Depth", "0")
        with opener.open(req, timeout=10) as resp:
            return {"ok": True, "status": resp.status}
    except urllib.error.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"WebDAV error: {e.code} {e.reason}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Connection failed: {str(e)}")


@router.post("/push")
def push_to_webdav(cfg: WebDAVConfig, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Upload current DB backup to WebDAV."""
    zip_bytes = _build_backup_zip(db)
    url = cfg.url.rstrip("/") + "/" + cfg.filename
    opener = _make_opener(cfg.username, cfg.password)
    try:
        req = urllib.request.Request(url, data=zip_bytes, method="PUT")
        req.add_header("Content-Type", "application/zip")
        req.add_header("Content-Length", str(len(zip_bytes)))
        with opener.open(req, timeout=60) as resp:
            return {"ok": True, "status": resp.status, "bytes": len(zip_bytes)}
    except urllib.error.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"WebDAV PUT failed: {e.code} {e.reason}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Push failed: {str(e)}")


@router.post("/pull")
def pull_from_webdav(cfg: WebDAVConfig, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Download backup from WebDAV and merge into local DB."""
    url = cfg.url.rstrip("/") + "/" + cfg.filename
    opener = _make_opener(cfg.username, cfg.password)
    try:
        req = urllib.request.Request(url, method="GET")
        with opener.open(req, timeout=60) as resp:
            zip_bytes = resp.read()
    except urllib.error.HTTPError as e:
        if e.code == 404:
            raise HTTPException(status_code=404, detail="No backup file found on WebDAV server")
        raise HTTPException(status_code=502, detail=f"WebDAV GET failed: {e.code} {e.reason}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Pull failed: {str(e)}")

    stats = _merge_backup_zip(zip_bytes, db)
    return {"ok": True, "merged": stats}


@router.post("/sync")
def sync_webdav(cfg: WebDAVConfig, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Bidirectional sync: pull from WebDAV (merge), then push updated DB back."""
    pull_result = {"skipped": 0, "entities": 0, "relationships": 0, "schemas": 0}

    # Step 1: pull and merge
    url = cfg.url.rstrip("/") + "/" + cfg.filename
    opener = _make_opener(cfg.username, cfg.password)
    try:
        req = urllib.request.Request(url, method="GET")
        with opener.open(req, timeout=60) as resp:
            zip_bytes = resp.read()
        pull_result = _merge_backup_zip(zip_bytes, db)
    except urllib.error.HTTPError as e:
        if e.code != 404:
            raise HTTPException(status_code=502, detail=f"Pull failed: {e.code} {e.reason}")
        # 404 is fine — no remote backup yet, we'll push
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Pull failed: {str(e)}")

    # Step 2: push merged DB
    zip_bytes = _build_backup_zip(db)
    try:
        req = urllib.request.Request(url, data=zip_bytes, method="PUT")
        req.add_header("Content-Type", "application/zip")
        req.add_header("Content-Length", str(len(zip_bytes)))
        with opener.open(req, timeout=60) as resp:
            push_status = resp.status
    except urllib.error.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Push failed after pull: {e.code} {e.reason}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Push failed: {str(e)}")

    return {"ok": True, "pulled": pull_result, "pushed_bytes": len(zip_bytes), "push_status": push_status}
