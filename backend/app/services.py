import random
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Tag


MASTERY_WEIGHTS = {"unknown": 5, "fuzzy": 3, "known": 1}


def tags_for_names(db: Session, names: list[str]) -> list[Tag]:
    tags: list[Tag] = []
    for name in names:
        clean_name = name.strip()
        if not clean_name:
            continue
        tag = db.scalar(select(Tag).where(Tag.name == clean_name))
        if tag is None:
            tag = Tag(name=clean_name)
            db.add(tag)
            db.flush()
        tags.append(tag)
    return tags


def weighted_sample(items: Sequence, limit: int | None) -> list:
    """Weighted sampling without replacement, using the item's mastery."""
    pool = list(items)
    result = []
    wanted = len(pool) if limit is None else min(limit, len(pool))
    while pool and len(result) < wanted:
        weights = [MASTERY_WEIGHTS.get(item.mastery, 3) for item in pool]
        chosen = random.choices(pool, weights=weights, k=1)[0]
        result.append(chosen)
        pool.remove(chosen)
    return result

