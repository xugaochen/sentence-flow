import random
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from app.services import sample_review_items, smart_weight


@dataclass(eq=False)
class ReviewItem:
    id: int
    mastery: str = "unknown"
    review_count: int = 0
    last_reviewed_at: datetime | None = None


def test_uniform_sampling_uses_replacement_without_immediate_repeats():
    items = [ReviewItem(1), ReviewItem(2), ReviewItem(3)]
    result = sample_review_items(items, 20, "uniform", rng=random.Random(7))

    assert len(result) == 20
    assert len({item.id for item in result}) < len(result)
    assert all(left.id != right.id for left, right in zip(result, result[1:]))

    only_item = ReviewItem(9)
    repeated = sample_review_items([only_item], 4, "uniform", rng=random.Random(1))
    assert [item.id for item in repeated] == [9, 9, 9, 9]


def test_all_items_and_without_replacement_modes():
    items = [ReviewItem(index) for index in range(5)]
    uniform = sample_review_items(items, 2, "uniform", all_items=True, rng=random.Random(3))
    assert len(uniform) == len(items)

    for mode in ("weighted", "smart", "new_first"):
        result = sample_review_items(items, 20, mode, rng=random.Random(3))
        assert len(result) == len(items)
        assert len({item.id for item in result}) == len(items)


def test_new_items_are_strictly_first():
    items = [ReviewItem(1, review_count=3), ReviewItem(2), ReviewItem(3, review_count=1), ReviewItem(4)]
    result = sample_review_items(items, 3, "new_first", rng=random.Random(5))

    assert {item.id for item in result[:2]} == {2, 4}
    assert result[2].id in {1, 3}


def test_smart_weight_combines_mastery_recency_and_review_count():
    now = datetime(2026, 9, 14, tzinfo=timezone.utc)
    just_reviewed = ReviewItem(1, mastery="unknown", review_count=0, last_reviewed_at=now)
    old_known = ReviewItem(2, mastery="known", review_count=0, last_reviewed_at=now - timedelta(days=30))
    frequent = ReviewItem(3, mastery="fuzzy", review_count=8, last_reviewed_at=now - timedelta(days=7))
    infrequent = ReviewItem(4, mastery="fuzzy", review_count=0, last_reviewed_at=now - timedelta(days=7))
    never_reviewed = ReviewItem(5, mastery="unknown", review_count=0)

    assert smart_weight(just_reviewed, now) < smart_weight(old_known, now)
    assert smart_weight(frequent, now) < smart_weight(infrequent, now)
    assert smart_weight(never_reviewed, now) == 10

    naive_time = ReviewItem(6, last_reviewed_at=(now - timedelta(days=1)).replace(tzinfo=None))
    assert smart_weight(naive_time, now) > 0
