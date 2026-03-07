from fastapi import APIRouter, Depends
from typing import List
from sqlalchemy.orm import Session
from ..database import get_db
from .. import crud, schemas, models
from ..deps import get_current_user

router = APIRouter(prefix="/search", tags=["search"])


@router.get("", response_model=List[schemas.EntityOut])
def search(
    q: str, limit: int = 20,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if len(q.strip()) < 2:
        return []
    return crud.search_entities(db, q, user.id, limit=limit)
