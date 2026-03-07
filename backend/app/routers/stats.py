from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from .. import crud, schemas, models
from ..deps import get_current_user

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("", response_model=schemas.StatsResponse)
def get_stats(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    return crud.get_stats(db, user.id)
