from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from .. import crud, schemas

router = APIRouter(prefix="/relationships", tags=["relationships"])


@router.get("", response_model=List[schemas.RelationshipOut])
def list_relationships(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_relationships(db, skip=skip, limit=limit)


@router.post("", response_model=schemas.RelationshipOut, status_code=201)
def create_relationship(rel: schemas.RelationshipCreate, db: Session = Depends(get_db)):
    src = crud.get_entity(db, rel.source_entity_id)
    tgt = crud.get_entity(db, rel.target_entity_id)
    if not src:
        raise HTTPException(status_code=404, detail="Source entity not found")
    if not tgt:
        raise HTTPException(status_code=404, detail="Target entity not found")
    return crud.create_relationship(db, rel)


@router.delete("/{rel_id}", status_code=204)
def delete_relationship(rel_id: str, db: Session = Depends(get_db)):
    if not crud.delete_relationship(db, rel_id):
        raise HTTPException(status_code=404, detail="Relationship not found")
