from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from .. import crud, schemas, models
from ..deps import get_current_user

router = APIRouter(prefix="/relationships", tags=["relationships"])


@router.get("", response_model=List[schemas.RelationshipOut])
def list_relationships(
    skip: int = 0, limit: int = 100,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    from sqlalchemy import or_
    rels = db.query(models.Relationship).filter(
        models.Relationship.user_id == user.id
    ).offset(skip).limit(limit).all()
    key = crud._get_enc_key(user)
    return [crud._rel_out(r, key) for r in rels]


@router.post("", response_model=schemas.RelationshipOut, status_code=201)
def create_relationship(
    body: schemas.RelationshipCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if not crud.get_entity(db, body.source_entity_id, user.id):
        raise HTTPException(404, "Source entity not found")
    if not crud.get_entity(db, body.target_entity_id, user.id):
        raise HTTPException(404, "Target entity not found")
    return crud.create_relationship(db, body, user.id)


@router.patch("/{rel_id}", response_model=schemas.RelationshipOut)
def update_relationship(
    rel_id: str,
    body: schemas.RelationshipUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    result = crud.update_relationship(db, rel_id, body, user.id)
    if not result:
        raise HTTPException(404, "Relationship not found")
    return result


@router.delete("/{rel_id}", status_code=204)
def delete_relationship(
    rel_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if not crud.delete_relationship(db, rel_id, user.id):
        raise HTTPException(404, "Relationship not found")
