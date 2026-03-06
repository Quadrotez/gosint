from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models import EntityTypeSchema
from .. import crud, schemas

router = APIRouter(prefix="/entity-schemas", tags=["entity-schemas"])


@router.get("", response_model=List[schemas.EntityTypeSchemaOut])
def list_schemas(db: Session = Depends(get_db)):
    return crud.get_entity_type_schemas(db)


@router.post("", response_model=schemas.EntityTypeSchemaOut, status_code=201)
def create_schema(schema: schemas.EntityTypeSchemaCreate, db: Session = Depends(get_db)):
    exists = db.query(EntityTypeSchema).filter(EntityTypeSchema.name == schema.name).first()
    if exists:
        raise HTTPException(status_code=409, detail=f"Entity type '{schema.name}' already exists")
    return crud.create_entity_type_schema(db, schema)


@router.put("/{schema_id}", response_model=schemas.EntityTypeSchemaOut)
def update_schema(schema_id: str, data: schemas.EntityTypeSchemaUpdate, db: Session = Depends(get_db)):
    result = crud.update_entity_type_schema(db, schema_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Schema not found")
    return result


@router.put("/{schema_id}", response_model=schemas.EntityTypeSchemaOut)
def update_schema(schema_id: str, update: schemas.EntityTypeSchemaUpdate, db: Session = Depends(get_db)):
    result = crud.update_entity_type_schema(db, schema_id, update)
    if not result:
        raise HTTPException(status_code=404, detail="Schema not found")
    return result


@router.delete("/{schema_id}", status_code=204)
def delete_schema(schema_id: str, db: Session = Depends(get_db)):
    if not crud.delete_entity_type_schema(db, schema_id):
        raise HTTPException(status_code=404, detail="Schema not found or is a built-in type")
