from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from .. import crud, schemas, models
from ..deps import get_current_user

router = APIRouter(prefix="/relationships", tags=["relationships"])


@router.post("", response_model=schemas.RelationshipOut, status_code=201)
def create_relationship(
    body: schemas.RelationshipCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    # Verify both entities belong to this user
    if not crud.get_entity(db, body.source_entity_id, user.id):
        raise HTTPException(404, "Source entity not found")
    if not crud.get_entity(db, body.target_entity_id, user.id):
        raise HTTPException(404, "Target entity not found")
    return crud.create_relationship(db, body, user.id)


@router.delete("/{rel_id}", status_code=204)
def delete_relationship(
    rel_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if not crud.delete_relationship(db, rel_id, user.id):
        raise HTTPException(404, "Relationship not found")
