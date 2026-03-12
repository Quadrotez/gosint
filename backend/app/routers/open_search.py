from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Set
import json
import uuid
from ..database import get_db
from .. import schemas, models
from ..deps import get_current_user
from ..encryption import derive_key, encrypt_field

router = APIRouter(prefix="/open-search", tags=["open-search"])


def _check_enabled(db: Session):
    s = db.query(models.SiteSettings).filter(models.SiteSettings.id == "main").first()
    if s and not s.open_search_enabled:
        raise HTTPException(403, "Open Search is disabled by administrator")


def _all_published_entity_ids(db: Session) -> Set[str]:
    """Return set of original_entity_ids that are currently published."""
    ids: Set[str] = set()
    for pe in db.query(models.PublishedEntity).all():
        ids.add(pe.original_entity_id)
    return ids


@router.get("/published", response_model=List[schemas.PublishedGroupOut])
def list_published(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    _check_enabled(db)
    all_pubs = db.query(models.PublishedGroup).all()
    result = []

    for pub in all_pubs:
        grp = db.query(models.EntityGroup).filter(models.EntityGroup.id == pub.group_id).first()
        if not grp:
            continue
        publisher = db.query(models.User).filter(models.User.id == pub.publisher_user_id).first()

        # Load plaintext snapshots
        pe_rows = db.query(models.PublishedEntity).filter(
            models.PublishedEntity.published_group_id == pub.id
        ).all()

        entities_out: List[schemas.PublishedEntityOut] = []
        for pe in pe_rows:
            try:
                meta = json.loads(pe.metadata_) if pe.metadata_ and pe.metadata_.strip() else None
            except Exception:
                meta = None
            entities_out.append(schemas.PublishedEntityOut(
                id=pe.original_entity_id,
                published_entity_id=pe.id,
                type=pe.type,
                value=pe.value,
                metadata=meta,
                notes=pe.notes,
                is_masked=False,
            ))

        result.append(schemas.PublishedGroupOut(
            id=pub.id,
            group_id=grp.id,
            group_name=grp.name,
            group_description=grp.description,
            publisher_username=publisher.username if publisher else "unknown",
            published_at=pub.published_at,
            entities=entities_out,
        ))

    return result


@router.get("/published/{group_id}/relationships")
def get_published_relationships(
    group_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Get relationships for a published group, masking non-published entities."""
    _check_enabled(db)

    pub = db.query(models.PublishedGroup).filter(models.PublishedGroup.group_id == group_id).first()
    if not pub:
        raise HTTPException(404, "Published group not found")

    # Build map: original_entity_id -> PublishedEntity for quick lookup
    all_pe = db.query(models.PublishedEntity).all()
    pe_by_orig: dict = {pe.original_entity_id: pe for pe in all_pe}
    all_published_orig_ids: Set[str] = set(pe_by_orig.keys())

    # Entity IDs in this specific group
    pe_in_group = db.query(models.PublishedEntity).filter(
        models.PublishedEntity.published_group_id == pub.id
    ).all()
    entity_ids_in_group = [pe.original_entity_id for pe in pe_in_group]

    rels_out = []
    seen_rel_ids: Set[str] = set()

    for eid in entity_ids_in_group:
        rels = db.query(models.Relationship).filter(
            (models.Relationship.source_entity_id == eid) |
            (models.Relationship.target_entity_id == eid)
        ).all()
        for rel in rels:
            if rel.id in seen_rel_ids:
                continue
            seen_rel_ids.add(rel.id)

            other_orig_id = rel.target_entity_id if rel.source_entity_id == eid else rel.source_entity_id
            is_masked = other_orig_id not in all_published_orig_ids
            other_pe = pe_by_orig.get(other_orig_id)

            rels_out.append({
                "id": rel.id,
                "source_entity_id": rel.source_entity_id,
                "target_entity_id": rel.target_entity_id,
                "type": rel.type,
                "other_entity": {
                    "id": other_orig_id,
                    "type": other_pe.type if other_pe and not is_masked else "unknown",
                    "value": other_pe.value if other_pe and not is_masked else "***",
                    "is_masked": is_masked,
                },
            })

    return {"relationships": rels_out}


# ── Import endpoints ───────────────────────────────────────────────────────────

def _enc_for_user(user: models.User, value: str) -> str:
    if not user.enc_salt or not value:
        return value
    key = derive_key(user.password_hash, user.enc_salt)
    return encrypt_field(key, value)


def _import_published_entities(
    pe_list: List[models.PublishedEntity],
    group_id: str,
    user: models.User,
    db: Session,
) -> List[str]:
    """Create encrypted Entity rows for the current user from published plaintext snapshots.
    Returns list of new entity IDs."""
    new_ids = []
    for pe in pe_list:
        new_id = str(uuid.uuid4())
        ent = models.Entity(
            id=new_id,
            user_id=user.id,
            type=pe.type,
            value=_enc_for_user(user, pe.value),
            metadata_=_enc_for_user(user, pe.metadata_) if pe.metadata_ else None,
            notes=_enc_for_user(user, pe.notes) if pe.notes else None,
            imported_from_group_id=group_id,
        )
        db.add(ent)
        new_ids.append(new_id)
    return new_ids


@router.post("/published/{published_group_id}/import", response_model=schemas.EntityGroupOut)
def import_published_group(
    published_group_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Import all entities from a published group into the current user's storage."""
    _check_enabled(db)

    pub = db.query(models.PublishedGroup).filter(models.PublishedGroup.id == published_group_id).first()
    if not pub:
        raise HTTPException(404, "Published group not found")

    grp = db.query(models.EntityGroup).filter(models.EntityGroup.id == pub.group_id).first()
    if not grp:
        raise HTTPException(404, "Group not found")

    # Check if user already imported this published group
    already = db.query(models.EntityGroup).filter(
        models.EntityGroup.user_id == user.id,
        models.EntityGroup.source_published_group_id == published_group_id,
        models.EntityGroup.is_imported == True,
    ).first()
    if already:
        raise HTTPException(409, "You have already imported this group")

    pe_rows = db.query(models.PublishedEntity).filter(
        models.PublishedEntity.published_group_id == published_group_id
    ).all()

    # Create the imported group first (we need its ID for imported_from_group_id)
    publisher = db.query(models.User).filter(models.User.id == pub.publisher_user_id).first()
    pub_name = grp.name
    if publisher:
        pub_name = f"{grp.name} (@{publisher.username})"

    imported_group = models.EntityGroup(
        user_id=user.id,
        name=pub_name,
        description=grp.description,
        entity_ids=json.dumps([]),
        is_imported=True,
        source_published_group_id=published_group_id,
    )
    db.add(imported_group)
    db.flush()

    new_ids = _import_published_entities(pe_rows, imported_group.id, user, db)
    imported_group.entity_ids = json.dumps(new_ids)
    db.commit()
    db.refresh(imported_group)

    pub_orm = db.query(models.PublishedGroup).filter(
        models.PublishedGroup.group_id == imported_group.id
    ).first()
    return schemas.EntityGroupOut(
        id=imported_group.id,
        name=imported_group.name,
        description=imported_group.description,
        entity_ids=new_ids,
        is_published=bool(pub_orm),
        is_imported=True,
        source_published_group_id=published_group_id,
        created_at=imported_group.created_at,
        updated_at=imported_group.updated_at,
    )


@router.post("/published/entities/{original_entity_id}/import", response_model=schemas.EntityGroupOut)
def import_published_entity(
    original_entity_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Import a single published entity + all directly connected published entities."""
    _check_enabled(db)

    # Find the published entity snapshot
    root_pe = db.query(models.PublishedEntity).filter(
        models.PublishedEntity.original_entity_id == original_entity_id
    ).first()
    if not root_pe:
        raise HTTPException(404, "Published entity not found")

    # Build set of all published original entity IDs for connection lookup
    all_pe = db.query(models.PublishedEntity).all()
    pe_by_orig: dict = {pe.original_entity_id: pe for pe in all_pe}
    all_published_orig_ids: Set[str] = set(pe_by_orig.keys())

    # Find directly connected published entities via Relationship table
    rels = db.query(models.Relationship).filter(
        (models.Relationship.source_entity_id == original_entity_id) |
        (models.Relationship.target_entity_id == original_entity_id)
    ).all()

    connected_orig_ids: Set[str] = set()
    for rel in rels:
        other = rel.target_entity_id if rel.source_entity_id == original_entity_id else rel.source_entity_id
        if other in all_published_orig_ids:
            connected_orig_ids.add(other)

    # Collect all PEs to import: root + connected published
    to_import_ids = {original_entity_id} | connected_orig_ids
    pe_to_import = [pe_by_orig[eid] for eid in to_import_ids if eid in pe_by_orig]

    # Determine group name from the published group of the root entity
    pub_grp = db.query(models.PublishedGroup).filter(
        models.PublishedGroup.id == root_pe.published_group_id
    ).first()
    grp_name = root_pe.value
    if pub_grp:
        src_grp = db.query(models.EntityGroup).filter(models.EntityGroup.id == pub_grp.group_id).first()
        publisher = db.query(models.User).filter(models.User.id == pub_grp.publisher_user_id).first()
        if src_grp:
            grp_name = f"{root_pe.value} (из {src_grp.name}"
            if publisher:
                grp_name += f" @{publisher.username}"
            grp_name += ")"

    imported_group = models.EntityGroup(
        user_id=user.id,
        name=grp_name,
        description=f"Импортировано: {root_pe.type} {root_pe.value}",
        entity_ids=json.dumps([]),
        is_imported=True,
        source_published_group_id=root_pe.published_group_id,
    )
    db.add(imported_group)
    db.flush()

    new_ids = _import_published_entities(pe_to_import, imported_group.id, user, db)
    imported_group.entity_ids = json.dumps(new_ids)
    db.commit()
    db.refresh(imported_group)

    return schemas.EntityGroupOut(
        id=imported_group.id,
        name=imported_group.name,
        description=imported_group.description,
        entity_ids=new_ids,
        is_published=False,
        is_imported=True,
        source_published_group_id=imported_group.source_published_group_id,
        created_at=imported_group.created_at,
        updated_at=imported_group.updated_at,
    )
