from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import List
import base64, uuid
from datetime import datetime
from ..database import get_db
from .. import models, schemas
from ..deps import get_current_user

router = APIRouter(prefix="/attachments", tags=["attachments"])

MAX_SIZE = 20 * 1024 * 1024  # 20 MB per file


@router.get("/entity/{entity_id}", response_model=List[schemas.AttachmentOut])
def list_attachments(
    entity_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    return db.query(models.EntityAttachment).filter(
        models.EntityAttachment.entity_id == entity_id,
        models.EntityAttachment.user_id == user.id,
    ).all()


@router.post("/entity/{entity_id}", response_model=schemas.AttachmentOut, status_code=201)
def upload_attachment(
    entity_id: str,
    body: schemas.AttachmentCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    entity = db.query(models.Entity).filter(
        models.Entity.id == entity_id,
        models.Entity.user_id == user.id,
    ).first()
    if not entity:
        raise HTTPException(404, "Entity not found")
    if body.size_bytes > MAX_SIZE:
        raise HTTPException(413, "File too large (max 20 MB)")

    att = models.EntityAttachment(
        id=str(uuid.uuid4()),
        entity_id=entity_id,
        user_id=user.id,
        filename=body.filename,
        mimetype=body.mimetype,
        size_bytes=body.size_bytes,
        data_b64=body.data_b64,
        created_at=datetime.utcnow(),
    )
    db.add(att); db.commit(); db.refresh(att)
    return att


@router.get("/{att_id}/download")
def download_attachment(
    att_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    att = db.query(models.EntityAttachment).filter(
        models.EntityAttachment.id == att_id,
        models.EntityAttachment.user_id == user.id,
    ).first()
    if not att:
        raise HTTPException(404, "Attachment not found")
    data = base64.b64decode(att.data_b64)
    return Response(
        content=data,
        media_type=att.mimetype,
        headers={"Content-Disposition": f'attachment; filename="{att.filename}"'},
    )


@router.delete("/{att_id}", status_code=204)
def delete_attachment(
    att_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    att = db.query(models.EntityAttachment).filter(
        models.EntityAttachment.id == att_id,
        models.EntityAttachment.user_id == user.id,
    ).first()
    if not att:
        raise HTTPException(404, "Attachment not found")
    db.delete(att); db.commit()
