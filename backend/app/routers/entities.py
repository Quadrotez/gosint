from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from .. import crud, schemas, models
from ..deps import get_current_user

router = APIRouter(prefix="/entities", tags=["entities"])


@router.get("", response_model=List[schemas.EntityOut])
def list_entities(
    skip: int = 0, limit: int = 100, type: Optional[str] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    return crud.get_entities(db, user_id=user.id, skip=skip, limit=limit, type_filter=type)


@router.get("/{entity_id}", response_model=schemas.EntityOut)
def get_entity(
    entity_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    entity = crud.get_entity(db, entity_id, user.id)
    if not entity:
        raise HTTPException(404, "Entity not found")
    return entity


@router.post("", response_model=schemas.EntityOut, status_code=201)
def create_entity(
    body: schemas.EntityCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    crud.check_storage_limit(db, user)
    return crud.create_entity(db, body, user.id)


@router.put("/{entity_id}", response_model=schemas.EntityOut)
def update_entity(
    entity_id: str, body: schemas.EntityUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    entity = crud.update_entity(db, entity_id, body, user.id)
    if not entity:
        raise HTTPException(404, "Entity not found")
    return entity


@router.delete("/{entity_id}", status_code=204)
def delete_entity(
    entity_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if not crud.delete_entity(db, entity_id, user.id):
        raise HTTPException(404, "Entity not found")


@router.get("/{entity_id}/relationships", response_model=List[schemas.RelationshipWithEntities])
def get_relationships(
    entity_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if not crud.get_entity(db, entity_id, user.id):
        raise HTTPException(404, "Entity not found")
    return crud.get_entity_relationships(db, entity_id, user.id)


@router.get("/{entity_id}/graph", response_model=schemas.GraphResponse)
def get_graph(
    entity_id: str, depth: int = 2,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if not crud.get_entity(db, entity_id, user.id):
        raise HTTPException(404, "Entity not found")
    return crud.get_entity_graph(db, entity_id, user.id, depth=min(depth, 5))
