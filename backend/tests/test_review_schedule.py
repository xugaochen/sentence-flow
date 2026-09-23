import asyncio
import os
import random
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.models import ReviewLog, Sentence, Word
from app.review_schedule import (
    review_counts_today, sample_scheduled_items, scheduled_review_pool, today_review_stats,
)
from app.routers import meta, reviews
from app.time_utils import local_day_utc_bounds


@dataclass
class Item:
    id: int
    mastery: str = "unknown"
    last_reviewed_at: datetime | None = None


NOW = datetime(2026, 9, 23, 12, tzinfo=timezone.utc)


def ids(items):
    return [item.id for item in items]


def test_seven_day_boundary_current_mastery_and_no_creation_age():
    items = [
        Item(1),
        Item(2, "fuzzy", NOW - timedelta(days=7) + timedelta(microseconds=1)),
        Item(3, "unknown", NOW - timedelta(days=7)),
        Item(4, "known", NOW - timedelta(days=30)),
        Item(5, "known", NOW - timedelta(hours=1)),
        Item(6, "known"),
        Item(7, "fuzzy", (NOW - timedelta(days=1)).replace(tzinfo=None)),
    ]
    assert ids(scheduled_review_pool(items, "recent", {}, now=NOW).items) == [1, 2, 7]
    assert ids(scheduled_review_pool(items, "older", {}, now=NOW).items) == [3, 4]
    items[4].mastery = "unknown"
    items[0].mastery = "known"
    assert ids(scheduled_review_pool(items, "recent", {}, now=NOW).items) == [2, 5, 7]


def test_first_coverage_layer_is_not_padded_by_repeat_items():
    items = [Item(1), Item(2), Item(3)]
    pool = scheduled_review_pool(items, "recent", {2: 1, 3: 2}, now=NOW)
    assert pool.overview() == {
        "available_count": 1, "candidate_count": 3, "daily_limit_count": 1,
        "empty_reason": None, "round_kind": "first",
    }
    assert ids(sample_scheduled_items(pool, "recent", 30, now=NOW)) == [1]
    assert ids(sample_scheduled_items(pool, "recent", 1, all_items=True, now=NOW)) == [1]
    repeat_pool = scheduled_review_pool(items, "recent", {1: 1, 2: 1, 3: 2}, now=NOW)
    assert repeat_pool.round_kind == "repeat"
    assert set(ids(repeat_pool.items)) == {1, 2}
    exhausted = scheduled_review_pool(items, "recent", {1: 2, 2: 3, 3: 2}, now=NOW)
    assert exhausted.items == []
    assert exhausted.empty_reason == "daily_limit"
    assert exhausted.daily_limit_count == 3
    assert exhausted.round_kind is None


def test_new_modes_shuffle_without_replacement_and_order_old_day_tiers():
    items = [Item(i, last_reviewed_at=NOW - timedelta(days=days)) for i, days in enumerate([9.1, 12.1, 9.8, 12.8, 8.9])]
    pool = scheduled_review_pool(items, "older", {}, now=NOW)
    orders = set()
    for seed in range(8):
        result = sample_scheduled_items(pool, "older", 30, now=NOW, rng=random.Random(seed))
        assert len(result) == len(set(ids(result))) == 5
        assert set(ids(result[:2])) == {1, 3}
        assert set(ids(result[2:4])) == {0, 2}
        assert result[-1].id == 4
        orders.add(tuple(ids(result)))
    assert len(orders) > 1
    recent_pool = scheduled_review_pool([Item(i) for i in range(5)], "recent", {}, now=NOW)
    result = sample_scheduled_items(recent_pool, "recent", 30, now=NOW, rng=random.Random(1))
    assert len(result) == len(set(ids(result))) == 5
    assert ids(result) != list(range(5))
    assert len(sample_scheduled_items(recent_pool, "recent", 2, now=NOW)) == 2
    assert len(sample_scheduled_items(recent_pool, "recent", 2, all_items=True, now=NOW)) == 5


def test_empty_reasons_and_older_daily_exclusion():
    older = Item(1, "unknown", NOW - timedelta(days=8))
    known = Item(2, "known", NOW - timedelta(days=1))
    assert scheduled_review_pool([], "recent", {}, now=NOW).empty_reason == "no_items"
    assert scheduled_review_pool([older], "recent", {}, now=NOW).empty_reason == "no_recent"
    assert scheduled_review_pool([known], "recent", {}, now=NOW).empty_reason == "all_known"
    assert scheduled_review_pool([known], "older", {}, now=NOW).empty_reason == "no_older"
    pool = scheduled_review_pool([older], "older", {1: 1}, now=NOW)
    assert pool.empty_reason == "already_reviewed_today"
    assert pool.candidate_count == pool.daily_limit_count == 1


@pytest.mark.skipif(not hasattr(time, "tzset"), reason="Requires changing the process timezone")
@pytest.mark.parametrize("tz,now,start,end", [
    ("Asia/Shanghai", "2026-09-23T00:30:00+00:00", "2026-09-22T16:00:00+00:00", "2026-09-23T16:00:00+00:00"),
    ("America/New_York", "2026-03-08T12:00:00+00:00", "2026-03-08T05:00:00+00:00", "2026-03-09T04:00:00+00:00"),
    ("America/New_York", "2026-11-01T12:00:00+00:00", "2026-11-01T04:00:00+00:00", "2026-11-02T05:00:00+00:00"),
])
def test_local_day_bounds_follow_timezone_and_dst(tz, now, start, end):
    previous = os.environ.get("TZ")
    try:
        os.environ["TZ"] = tz
        time.tzset()
        assert local_day_utc_bounds(datetime.fromisoformat(now)) == (
            datetime.fromisoformat(start), datetime.fromisoformat(end),
        )
    finally:
        if previous is None:
            os.environ.pop("TZ", None)
        else:
            os.environ["TZ"] = previous
        time.tzset()


@pytest.fixture
def isolated_app(tmp_path):
    # Never run the production app lifespan or access its configured database.
    engine = create_engine(f"sqlite:///{tmp_path / 'reviews.db'}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    app = FastAPI()
    app.include_router(reviews.router, prefix="/api")
    app.include_router(meta.router, prefix="/api")

    async def isolated_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = isolated_db
    yield app, factory
    engine.dispose()


def sentence(db, **overrides):
    item = Sentence(chinese_text="例句", target_text="Una frase.", language="es", **overrides)
    db.add(item)
    db.flush()
    return item


def word(db, **overrides):
    values = {"word": "ejemplo", "meaning": "例子", "language": "es", "part_of_speech": "名词"}
    values.update(overrides)
    item = Word(**values)
    db.add(item)
    db.flush()
    return item


def log(db, item_type, item_id, at, result="fuzzy"):
    db.add(ReviewLog(item_type=item_type, item_id=item_id, result=result, reviewed_at=at))


def test_daily_counts_use_half_open_day_and_separate_item_types(isolated_app):
    _, factory = isolated_app
    start, end = local_day_utc_bounds(NOW)
    with factory() as db:
        s = sentence(db)
        w = word(db)
        assert s.id == w.id
        for at in (start - timedelta(microseconds=1), start, end - timedelta(microseconds=1), end):
            log(db, "sentence", s.id, at)
        log(db, "word", w.id, start)
        db.commit()
    with factory() as db:
        assert review_counts_today(db, "sentence", now=NOW) == {s.id: 2}
        assert review_counts_today(db, "word", now=NOW) == {w.id: 1}
        assert today_review_stats(db, now=NOW) == {"sentence_count": 1, "word_count": 1, "review_count": 3}
        assert review_counts_today(db, "sentence", now=end) == {s.id: 1}
        assert review_counts_today(db, "word", now=end) == {}


def test_review_rounds_share_persistent_limits_and_transition_between_modes(isolated_app):
    app, factory = isolated_app
    with factory() as db:
        a, b = sentence(db), sentence(db)
        old = sentence(db, mastery="known", last_reviewed_at=datetime.now(timezone.utc) - timedelta(days=20), review_count=5)
        db.commit()

    async def flow():
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            path = "/api/reviews/sentences"
            async def get_ids(mode="recent"):
                response = await client.get(path, params={"mode": mode, "all_items": True})
                assert response.status_code == 200
                return [item["id"] for item in response.json()]

            assert set(await get_ids()) == {a.id, b.id}
            assert await get_ids("older") == [old.id]
            assert (await client.get(f"{path}/overview")).json()["today"]["review_count"] == 0
            assert (await client.post(f"{path}/{a.id}", json={"mastery": "fuzzy"})).status_code == 200
            assert await get_ids() == [b.id]  # A second pass never pads B's first pass.
            assert (await client.post(f"{path}/{b.id}", json={"mastery": "unknown"})).status_code == 200
            overview = (await client.get(f"{path}/overview")).json()
            assert overview["recent"]["round_kind"] == "repeat"
            assert set(await get_ids()) == {a.id, b.id}
            assert (await client.post(f"{path}/{a.id}", json={"mastery": "unknown"})).status_code == 200
            assert await get_ids() == [b.id]
            assert (await client.post(f"{path}/{b.id}", json={"mastery": "known"})).status_code == 200
            assert await get_ids() == []
            overview = (await client.get(f"{path}/overview")).json()
            assert overview["recent"]["empty_reason"] == "daily_limit"
            assert overview["today"] == {"sentence_count": 2, "word_count": 0, "review_count": 4}

            # A successful old-item answer immediately moves an unfamiliar item into consolidation.
            assert (await client.post(f"{path}/{old.id}", json={"mastery": "fuzzy"})).status_code == 200
            assert await get_ids("older") == []
            assert await get_ids() == [old.id]
            assert (await client.post(f"{path}/{old.id}", json={"mastery": "invalid"})).status_code == 422
            assert (await client.post(f"{path}/9999", json={"mastery": "known"})).status_code == 404
            assert await get_ids() == [old.id]
            assert (await client.get(f"{path}/overview")).json()["today"]["review_count"] == 5
            stats = (await client.get("/api/stats")).json()
            assert stats["reviewed_today"] == 5
            assert stats["reviewed_sentences_today"] == 3
            assert stats["reviewed_words_today"] == 0

            # Legacy callers still see the full active pool, regardless of daily caps.
            for mode in (None, "weighted", "smart", "new_first"):
                params = {"all_items": True}
                if mode:
                    params["mode"] = mode
                response = await client.get(path, params=params)
                assert {item["id"] for item in response.json()} == {a.id, b.id, old.id}
            uniform = (await client.get(path, params={"mode": "uniform", "limit": 20})).json()
            assert len(uniform) == 20

    asyncio.run(flow())
    with factory() as db:
        assert db.scalar(select(func.count(ReviewLog.id))) == 5


def test_overview_language_pos_soft_delete_and_word_session_are_consistent(isolated_app):
    app, factory = isolated_app
    now = datetime.now(timezone.utc)
    with factory() as db:
        s = sentence(db)
        verb = word(db, word="hablar", part_of_speech="动词")
        noun = word(db)
        ja = word(db, word="勉強する", language="ja", part_of_speech="动词")
        deleted = word(db, word="borrar", part_of_speech="动词", deleted_at=now)
        old = word(db, word="volver", part_of_speech="动词", mastery="known", last_reviewed_at=now - timedelta(days=8))
        for item in (noun, ja, deleted):
            log(db, "word", item.id, now)
        log(db, "sentence", s.id, now)
        log(db, "sentence", s.id, now)
        db.commit()

    async def flow():
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            filters = {"language": "es", "part_of_speech": "动词"}
            overview = (await client.get("/api/reviews/words/overview", params=filters)).json()
            assert overview["recent"]["available_count"] == 1
            assert overview["older"]["available_count"] == 1
            assert overview["today"] == {"sentence_count": 1, "word_count": 0, "review_count": 2}
            for mode, expected in (("recent", verb.id), ("older", old.id)):
                response = await client.get("/api/reviews/words", params={**filters, "mode": mode, "limit": 30})
                assert [item["id"] for item in response.json()] == [expected]
            assert (await client.post(f"/api/reviews/words/{verb.id}", json={"mastery": "fuzzy"})).status_code == 200
            overview = (await client.get("/api/reviews/words/overview", params=filters)).json()
            assert overview["recent"]["round_kind"] == "repeat"
            assert overview["today"] == {"sentence_count": 1, "word_count": 1, "review_count": 3}
            assert (await client.post(f"/api/reviews/words/{verb.id}", json={"mastery": "unknown"})).status_code == 200
            assert (await client.get("/api/reviews/words", params={**filters, "mode": "recent"})).json() == []
            assert (await client.post(f"/api/reviews/words/{deleted.id}", json={"mastery": "unknown"})).status_code == 404
            stats = (await client.get("/api/stats")).json()
            assert stats["reviewed_today"] == 6
            assert stats["reviewed_sentences_today"] == 1
            assert stats["reviewed_words_today"] == 3
            empty = (await client.get("/api/reviews/words/overview", params={"language": "en"})).json()
            assert empty["recent"]["empty_reason"] == empty["older"]["empty_reason"] == "no_items"

    asyncio.run(flow())
