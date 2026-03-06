from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from .. import crud, schemas

router = APIRouter(prefix="/search", tags=["search"])


@router.get("", response_model=List[schemas.EntityOut])
def search(q: str = Query(..., min_length=1), limit: int = 50, db: Session = Depends(get_db)):
    return crud.search_entities(db, q, limit=limit)
