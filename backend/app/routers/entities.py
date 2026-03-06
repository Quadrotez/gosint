from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from .. import crud, schemas

router = APIRouter(prefix="/entities", tags=["entities"])


@router.get("", response_model=List[schemas.EntityOut])
def list_entities(skip: int = 0, limit: int = 100, type: Optional[str] = None, db: Session = Depends(get_db)):
    return crud.get_entities(db, skip=skip, limit=limit, type_filter=type)


@router.get("/{entity_id}", response_model=schemas.EntityOut)
def get_entity(entity_id: str, db: Session = Depends(get_db)):
    entity = crud.get_entity(db, entity_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    return entity


@router.post("", response_model=schemas.EntityOut, status_code=201)
def create_entity(entity: schemas.EntityCreate, db: Session = Depends(get_db)):
    return crud.create_entity(db, entity)


@router.put("/{entity_id}", response_model=schemas.EntityOut)
def update_entity(entity_id: str, update: schemas.EntityUpdate, db: Session = Depends(get_db)):
    entity = crud.update_entity(db, entity_id, update)
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    return entity


@router.delete("/{entity_id}", status_code=204)
def delete_entity(entity_id: str, db: Session = Depends(get_db)):
    if not crud.delete_entity(db, entity_id):
        raise HTTPException(status_code=404, detail="Entity not found")


@router.get("/{entity_id}/relationships", response_model=List[schemas.RelationshipWithEntities])
def get_entity_relationships(entity_id: str, db: Session = Depends(get_db)):
    if not crud.get_entity(db, entity_id):
        raise HTTPException(status_code=404, detail="Entity not found")
    return crud.get_entity_relationships(db, entity_id)


@router.get("/{entity_id}/graph", response_model=schemas.GraphResponse)
def get_entity_graph(entity_id: str, depth: int = 2, db: Session = Depends(get_db)):
    if not crud.get_entity(db, entity_id):
        raise HTTPException(status_code=404, detail="Entity not found")
    return crud.get_entity_graph(db, entity_id, depth=min(depth, 5))
