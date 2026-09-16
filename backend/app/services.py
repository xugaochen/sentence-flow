import random
from datetime import datetime, timezone
from math import sqrt
from collections.abc import Sequence
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Tag


MASTERY_WEIGHTS = {"unknown": 5, "fuzzy": 3, "known": 1}
ReviewMode = Literal["smart", "weighted", "uniform", "new_first"]


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


def weighted_sample(items: Sequence, limit: int | None, *, weight_for=None, rng=random) -> list:
    """Sample without replacement using mastery or a custom weight function."""
    pool = list(items)
    result = []
    wanted = len(pool) if limit is None else min(limit, len(pool))
    while pool and len(result) < wanted:
        weights = [weight_for(item) if weight_for else MASTERY_WEIGHTS.get(item.mastery, 3) for item in pool]
        chosen = rng.choices(pool, weights=weights, k=1)[0]
        result.append(chosen)
        pool.remove(chosen)
    return result


def smart_weight(item, now: datetime | None = None) -> float:
    """Combine mastery, recency, and exposure into a review probability."""
    current_time = now or datetime.now(timezone.utc)
    last_reviewed = item.last_reviewed_at
    if last_reviewed is None:
        recency_weight = 2.0
    else:
        if last_reviewed.tzinfo is None:
            last_reviewed = last_reviewed.replace(tzinfo=timezone.utc)
        else:
            last_reviewed = last_reviewed.astimezone(timezone.utc)
        elapsed_days = max(0.0, (current_time - last_reviewed).total_seconds() / 86400)
        recency_weight = min(3.0, 0.25 + elapsed_days / 7)
    mastery_weight = MASTERY_WEIGHTS.get(item.mastery, 3)
    exposure_weight = 1 / sqrt(max(0, item.review_count) + 1)
    return mastery_weight * recency_weight * exposure_weight


def uniform_sample_with_replacement(items: Sequence, wanted: int, *, rng=random) -> list:
    """Sample uniformly with replacement while avoiding immediate repeats when possible."""
    pool = list(items)
    if not pool or wanted <= 0:
        return []
    result = []
    previous = None
    for _ in range(wanted):
        candidates = pool if previous is None or len(pool) == 1 else [item for item in pool if item is not previous]
        chosen = rng.choice(candidates)
        result.append(chosen)
        previous = chosen
    return result


def sample_review_items(
    items: Sequence,
    limit: int,
    mode: ReviewMode = "weighted",
    *,
    all_items: bool = False,
    now: datetime | None = None,
    rng=random,
) -> list:
    pool = list(items)
    wanted = len(pool) if all_items else limit
    if mode == "uniform":
        return uniform_sample_with_replacement(pool, wanted, rng=rng)
    wanted = min(wanted, len(pool))
    if mode == "weighted":
        return weighted_sample(pool, wanted, rng=rng)
    if mode == "smart":
        return weighted_sample(pool, wanted, weight_for=lambda item: smart_weight(item, now), rng=rng)
    if mode == "new_first":
        new_items = [item for item in pool if item.review_count == 0]
        reviewed_items = [item for item in pool if item.review_count != 0]
        rng.shuffle(new_items)
        rng.shuffle(reviewed_items)
        return (new_items + reviewed_items)[:wanted]
    raise ValueError(f"Unknown review mode: {mode}")
