import csv
import io
import json
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from .. import crud, schemas, models
from ..deps import get_current_user

router = APIRouter(prefix="/import", tags=["import"])


@router.post("/csv", response_model=List[schemas.EntityOut])
async def import_csv(file: UploadFile = File(...), db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    content = await file.read()
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    created = []

    for row in reader:
        type_ = row.get("type", "").strip()
        value = row.get("value", "").strip()
        if not type_ or not value:
            continue

        metadata_str = row.get("metadata", "")
        metadata = None
        if metadata_str:
            try:
                metadata = json.loads(metadata_str)
            except Exception:
                metadata = {"raw": metadata_str}

        # Add extra columns as metadata
        extra = {k: v for k, v in row.items() if k not in ("type", "value", "metadata") and v}
        if extra:
            metadata = {**(metadata or {}), **extra}

        entity = crud.create_entity(db, schemas.EntityCreate(type=type_, value=value, metadata=metadata), user.id)
        created.append(entity)

    return created
