import random
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Literal

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from .models import ReviewLog, Sentence, Tag, Word
from .time_utils import as_utc, local_day_utc_bounds


ScheduleMode = Literal["recent", "older"]


@dataclass
class ReviewPool:
    items: list
    candidate_count: int
    daily_limit_count: int = 0
    empty_reason: str | None = None
    round_kind: str | None = None

    def overview(self) -> dict:
        return {
            "available_count": len(self.items),
            "candidate_count": self.candidate_count,
            "daily_limit_count": self.daily_limit_count,
            "empty_reason": self.empty_reason,
            "round_kind": self.round_kind,
        }


def review_items(
    db: Session,
    item_type: str,
    *,
    language: str | None = None,
    part_of_speech: str | None = None,
    tag: str | None = None,
) -> list:
    model = Sentence if item_type == "sentence" else Word
    related = Sentence.words if model is Sentence else Word.sentences
    stmt = select(model).where(model.deleted_at.is_(None)).options(
        selectinload(model.tags), selectinload(related),
    )
    if language:
        stmt = stmt.where(model.language == language)
    if model is Word and part_of_speech:
        stmt = stmt.where(Word.part_of_speech == part_of_speech)
    if tag:
        stmt = stmt.join(model.tags).where(Tag.name == tag)
    return list(db.scalars(stmt).unique().all())


def review_counts_today(db: Session, item_type: str, *, now: datetime | None = None) -> dict[int, int]:
    start, end = local_day_utc_bounds(now)
    return dict(db.execute(
        select(ReviewLog.item_id, func.count(ReviewLog.id)).where(
            ReviewLog.item_type == item_type,
            ReviewLog.reviewed_at >= start,
            ReviewLog.reviewed_at < end,
        ).group_by(ReviewLog.item_id)
    ).all())


def today_review_stats(
    db: Session,
    *,
    language: str | None = None,
    part_of_speech: str | None = None,
    now: datetime | None = None,
) -> dict[str, int]:
    start, end = local_day_utc_bounds(now)
    totals = {"sentence_count": 0, "word_count": 0, "review_count": 0}
    for item_type, model in (("sentence", Sentence), ("word", Word)):
        stmt = select(func.count(func.distinct(ReviewLog.item_id)), func.count(ReviewLog.id)).join(
            model, model.id == ReviewLog.item_id,
        ).where(
            ReviewLog.item_type == item_type,
            ReviewLog.reviewed_at >= start,
            ReviewLog.reviewed_at < end,
            model.deleted_at.is_(None),
        )
        if language:
            stmt = stmt.where(model.language == language)
        if model is Word and part_of_speech:
            stmt = stmt.where(Word.part_of_speech == part_of_speech)
        unique_count, review_count = db.execute(stmt).one()
        totals[f"{item_type}_count"] = unique_count
        totals["review_count"] += review_count
    return totals


def scheduled_review_pool(
    items: Sequence,
    mode: ScheduleMode,
    today_counts: Mapping[int, int],
    *,
    now: datetime | None = None,
) -> ReviewPool:
    """Classify by review recency and select exactly one daily coverage layer."""
    if not items:
        return ReviewPool([], 0, empty_reason="no_items")
    cutoff = as_utc(now or datetime.now(timezone.utc)) - timedelta(days=7)
    if mode == "recent":
        recent = [item for item in items if item.last_reviewed_at is None or as_utc(item.last_reviewed_at) > cutoff]
        candidates = [item for item in recent if item.mastery != "known"]
        if not candidates:
            return ReviewPool([], 0, empty_reason="all_known" if recent else "no_recent")
        available = [item for item in candidates if today_counts.get(item.id, 0) < 2]
        first = [item for item in available if today_counts.get(item.id, 0) == 0]
        return ReviewPool(
            first or available,
            len(candidates),
            daily_limit_count=len(candidates) - len(available),
            empty_reason=None if available else "daily_limit",
            round_kind=("first" if first else "repeat") if available else None,
        )
    if mode == "older":
        candidates = [item for item in items if item.last_reviewed_at is not None and as_utc(item.last_reviewed_at) <= cutoff]
        available = [item for item in candidates if today_counts.get(item.id, 0) == 0]
        return ReviewPool(
            available,
            len(candidates),
            daily_limit_count=len(candidates) - len(available),
            empty_reason=None if available else ("already_reviewed_today" if candidates else "no_older"),
            round_kind="first" if available else None,
        )
    raise ValueError(f"Unknown scheduled review mode: {mode}")


def sample_scheduled_items(
    pool: ReviewPool,
    mode: ScheduleMode,
    limit: int,
    *,
    all_items: bool = False,
    now: datetime | None = None,
    rng=random,
) -> list:
    items = list(pool.items)
    rng.shuffle(items)
    if mode == "older":
        current = as_utc(now or datetime.now(timezone.utc))
        # A stable sort preserves the random order within each elapsed-day tier.
        items.sort(key=lambda item: (current - as_utc(item.last_reviewed_at)).days, reverse=True)
    return items if all_items else items[:limit]
