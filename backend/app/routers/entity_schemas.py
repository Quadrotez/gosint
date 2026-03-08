from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from .. import crud, schemas, models
from ..deps import get_current_user

router = APIRouter(prefix="/entity-schemas", tags=["entity-schemas"])


@router.get("", response_model=List[schemas.EntityTypeSchemaOut])
def list_schemas(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    return crud.get_entity_type_schemas(db, user.id)


@router.post("", response_model=schemas.EntityTypeSchemaOut, status_code=201)
def create_schema(
    body: schemas.EntityTypeSchemaCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    existing = [s for s in crud.get_entity_type_schemas(db, user.id) if s.name == body.name]
    if existing:
        raise HTTPException(409, "Schema name already exists")
    return crud.create_entity_type_schema(db, body, user.id)


@router.put("/{schema_id}", response_model=schemas.EntityTypeSchemaOut)
def update_schema(
    schema_id: str, body: schemas.EntityTypeSchemaUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    result = crud.update_entity_type_schema(db, schema_id, body, user.id)
    if not result:
        raise HTTPException(404, "Schema not found")
    return result


@router.delete("/{schema_id}", status_code=204)
def delete_schema(
    schema_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Delete a schema — builtin types can also be deleted to remove them from this user's type list."""
    if not crud.delete_entity_type_schema(db, schema_id, user.id):
        raise HTTPException(404, "Schema not found")
