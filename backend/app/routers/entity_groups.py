from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import json
from ..database import get_db
from .. import schemas, models
from ..deps import get_current_user
from ..encryption import derive_key, decrypt_field

router = APIRouter(prefix="/entity-groups", tags=["entity-groups"])


def _get_enc_key(user: models.User):
    if not user.enc_salt:
        return None
    return derive_key(user.password_hash, user.enc_salt)


def _dec(key, value):
    return decrypt_field(key, value) if (key and value) else value


def _group_out(g: models.EntityGroup, db: Session) -> schemas.EntityGroupOut:
    ids = json.loads(g.entity_ids) if g.entity_ids else []
    pub = db.query(models.PublishedGroup).filter(models.PublishedGroup.group_id == g.id).first()
    return schemas.EntityGroupOut(
        id=g.id, name=g.name, description=g.description,
        entity_ids=ids, is_published=bool(pub),
        is_imported=g.is_imported,
        source_published_group_id=g.source_published_group_id,
        created_at=g.created_at, updated_at=g.updated_at,
    )


def _snapshot_entities(group: models.EntityGroup, pub: models.PublishedGroup,
                       user: models.User, db: Session) -> None:
    """Decrypt and store plaintext copies of all entities in the group."""
    key = _get_enc_key(user)
    entity_ids = json.loads(group.entity_ids) if group.entity_ids else []
    for eid in entity_ids:
        ent = db.query(models.Entity).filter(models.Entity.id == eid).first()
        if not ent:
            continue
        existing = db.query(models.PublishedEntity).filter(
            models.PublishedEntity.published_group_id == pub.id,
            models.PublishedEntity.original_entity_id == eid,
        ).first()
        if existing:
            continue
        pe = models.PublishedEntity(
            published_group_id=pub.id,
            original_entity_id=eid,
            type=ent.type,
            value=_dec(key, ent.value) or "",
            metadata_=_dec(key, ent.metadata_),
            notes=_dec(key, ent.notes),
        )
        db.add(pe)


@router.get("", response_model=List[schemas.EntityGroupOut])
def list_groups(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    groups = db.query(models.EntityGroup).filter(
        models.EntityGroup.user_id == user.id
    ).order_by(models.EntityGroup.created_at.desc()).all()
    return [_group_out(g, db) for g in groups]


@router.post("", response_model=schemas.EntityGroupOut, status_code=201)
def create_group(body: schemas.EntityGroupCreate, db: Session = Depends(get_db),
                 user: models.User = Depends(get_current_user)):
    g = models.EntityGroup(
        user_id=user.id, name=body.name, description=body.description,
        entity_ids=json.dumps(body.entity_ids or []),
    )
    db.add(g)
    db.commit()
    db.refresh(g)
    return _group_out(g, db)


@router.get("/{group_id}", response_model=schemas.EntityGroupOut)
def get_group(group_id: str, db: Session = Depends(get_db),
              user: models.User = Depends(get_current_user)):
    g = db.query(models.EntityGroup).filter(
        models.EntityGroup.id == group_id, models.EntityGroup.user_id == user.id
    ).first()
    if not g:
        raise HTTPException(404, "Group not found")
    return _group_out(g, db)


@router.patch("/{group_id}", response_model=schemas.EntityGroupOut)
def update_group(group_id: str, body: schemas.EntityGroupUpdate,
                 db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    g = db.query(models.EntityGroup).filter(
        models.EntityGroup.id == group_id, models.EntityGroup.user_id == user.id
    ).first()
    if not g:
        raise HTTPException(404, "Group not found")
    if body.name is not None:
        g.name = body.name
    if body.description is not None:
        g.description = body.description
    if body.entity_ids is not None:
        g.entity_ids = json.dumps(body.entity_ids)
    db.commit()
    db.refresh(g)
    return _group_out(g, db)


@router.delete("/{group_id}", status_code=204)
def delete_group(group_id: str, db: Session = Depends(get_db),
                 user: models.User = Depends(get_current_user)):
    g = db.query(models.EntityGroup).filter(
        models.EntityGroup.id == group_id, models.EntityGroup.user_id == user.id
    ).first()
    if not g:
        raise HTTPException(404, "Group not found")

    # If this is an imported group — delete entities that were imported with it
    if g.is_imported:
        db.query(models.Entity).filter(
            models.Entity.user_id == user.id,
            models.Entity.imported_from_group_id == group_id,
        ).delete(synchronize_session=False)

    db.delete(g)
    db.commit()


@router.post("/{group_id}/publish", response_model=schemas.EntityGroupOut)
def publish_group(group_id: str, db: Session = Depends(get_db),
                  user: models.User = Depends(get_current_user)):
    g = db.query(models.EntityGroup).filter(
        models.EntityGroup.id == group_id, models.EntityGroup.user_id == user.id
    ).first()
    if not g:
        raise HTTPException(404, "Group not found")

    existing_pub = db.query(models.PublishedGroup).filter(
        models.PublishedGroup.group_id == group_id
    ).first()

    if not existing_pub:
        pub = models.PublishedGroup(group_id=group_id, publisher_user_id=user.id)
        db.add(pub)
        db.flush()
        _snapshot_entities(g, pub, user, db)
        db.commit()
    else:
        # Re-snapshot: replace old plaintext copies
        db.query(models.PublishedEntity).filter(
            models.PublishedEntity.published_group_id == existing_pub.id
        ).delete(synchronize_session=False)
        db.flush()
        _snapshot_entities(g, existing_pub, user, db)
        db.commit()

    return _group_out(g, db)


@router.delete("/{group_id}/publish", response_model=schemas.EntityGroupOut)
def unpublish_group(group_id: str, db: Session = Depends(get_db),
                    user: models.User = Depends(get_current_user)):
    g = db.query(models.EntityGroup).filter(
        models.EntityGroup.id == group_id, models.EntityGroup.user_id == user.id
    ).first()
    if not g:
        raise HTTPException(404, "Group not found")

    pub = db.query(models.PublishedGroup).filter(
        models.PublishedGroup.group_id == group_id
    ).first()
    if pub:
        # PublishedEntity records cascade-delete via ORM relationship
        db.delete(pub)
        db.commit()

    return _group_out(g, db)
