import asyncio
import csv
import io
import json
from datetime import datetime, timedelta, timezone
from zipfile import ZipFile

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.models import ReviewLog, Sentence
from app.routers import data, reviews, sentences


@pytest.fixture
def isolated_app(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'english-test.db'}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)
    app = FastAPI()
    for router in (sentences.router, reviews.router, data.router):
        app.include_router(router, prefix="/api")

    async def database():
        with session() as db:
            yield db

    app.dependency_overrides[get_db] = database
    yield app, session
    engine.dispose()


def payload(**overrides):
    return {"chinese_text": "我饿了。", "target_text": "Tengo hambre.", "language": "es", **overrides}


def test_translation_crud_legacy_updates_search_links_trash_and_exports(isolated_app):
    app, _ = isolated_app

    async def flow():
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            created = await client.post("/api/sentences", json=payload(english_text="  I am hungry.  ", tags=["A1"]))
            assert created.status_code == 201
            item = created.json()
            assert item["english_text"] == "I am hungry."
            path = f"/api/sentences/{item['id']}"
            # Library mastery updates and older clients must not erase English.
            updated = await client.put(path, json=payload(notes="A note", mastery="fuzzy", tags=["A1"]))
            assert updated.json()["english_text"] == "I am hungry."
            found = (await client.get("/api/sentences", params={"q": "hungry"})).json()
            assert [row["id"] for row in found] == [item["id"]]
            word = await client.post(path + "/words", json={"word": "hambre", "meaning": "饿", "language": "es"})
            assert word.status_code == 201
            assert word.json()["sentences"][0]["english_text"] == "I am hungry."
            await client.post(f"/api/reviews/sentences/{item['id']}", json={"mastery": "fuzzy"})
            assert (await client.delete(path)).status_code == 204
            trashed = (await client.get("/api/trash")).json()["sentences"]
            assert trashed[0]["english_text"] == "I am hungry."
            assert (await client.get("/api/reviews/sentences", params={"language": "es", "prompt_language": "en"})).json() == []
            document = (await client.get("/api/export/json")).json()
            assert document["schema_version"] == 3
            assert document["sentences"][0]["english_text"] == "I am hungry."
            assert document["sentences"][0]["deleted_at"]
            assert len(document["sentence_words"]) == len(document["sentence_tags"]) == len(document["review_logs"]) == 1
            archive = ZipFile(io.BytesIO((await client.get("/api/export/csv")).content))
            assert json.loads(archive.read("manifest.json"))["schema_version"] == 3
            rows = list(csv.DictReader(io.StringIO(archive.read("sentences.csv").decode("utf-8-sig"))))
            assert rows[0]["english_text"] == document["sentences"][0]["english_text"]
            restored = await client.post(f"/api/trash/sentences/{item['id']}/restore")
            assert restored.json()["english_text"] == "I am hungry."
            assert len(restored.json()["words"]) == 1
            cleared = await client.put(path, json=payload(english_text="", mastery="fuzzy"))
            assert cleared.status_code == 200
            assert cleared.json()["english_text"] == ""

    asyncio.run(flow())


def test_prompt_filter_overview_missing_translations_and_validation(isolated_app):
    app, session = isolated_app
    with session() as db:
        db.add_all([
            Sentence(**payload(id=1, english_text="I am hungry.")),
            Sentence(**payload(id=2, english_text="")),
            Sentence(**payload(id=3, english_text="   ")),
            Sentence(**payload(id=4, english_text="Trashed", deleted_at=datetime.now(timezone.utc))),
            Sentence(**payload(id=5, language="ja", english_text="Japanese")),
        ])
        db.commit()

    async def flow():
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            params = {"language": "es", "prompt_language": "en", "mode": "recent", "all_items": True}
            result = (await client.get("/api/reviews/sentences", params=params)).json()
            assert [row["id"] for row in result] == [1]
            summary = (await client.get("/api/reviews/sentences/overview", params=params)).json()
            assert summary["recent"]["available_count"] == 1
            assert summary["missing_english_count"] == 2
            # Legacy calls and Chinese prompts still include untranslated sentences.
            legacy = (await client.get("/api/reviews/sentences", params={"language": "es"})).json()
            assert {row["id"] for row in legacy} == {1, 2, 3}
            for mode in ("weighted", "smart", "new_first", "uniform"):
                response = await client.get("/api/reviews/sentences", params={**params, "mode": mode})
                assert {row["id"] for row in response.json()} == {1}
            for path in ("/api/reviews/sentences", "/api/reviews/sentences/overview"):
                assert (await client.get(path, params={"prompt_language": "en"})).status_code == 400
                assert (await client.get(path, params={"language": "ja", "prompt_language": "en"})).status_code == 400
                assert (await client.get(path, params={"prompt_language": "fr"})).status_code == 422
            assert (await client.get("/api/reviews/words/overview", params={"language": "es", "prompt_language": "en"})).status_code == 400
            await client.delete("/api/sentences/1")
            summary = (await client.get("/api/reviews/sentences/overview", params=params)).json()
            assert summary["recent"]["empty_reason"] == "missing_translation"
            assert summary["older"]["empty_reason"] == "missing_translation"
            assert summary["recent"]["available_count"] == 0

    asyncio.run(flow())


def test_prompt_languages_share_daily_limits_and_existing_review_history(isolated_app):
    app, session = isolated_app
    with session() as db:
        db.add(Sentence(**payload(id=1, english_text="I am hungry.", last_reviewed_at=datetime.now(timezone.utc) - timedelta(days=8))))
        db.commit()

    async def flow():
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            params = {"language": "es", "prompt_language": "en", "mode": "older"}
            assert len((await client.get("/api/reviews/sentences", params=params)).json()) == 1
            await client.post("/api/reviews/sentences/1", json={"mastery": "fuzzy"})
            for prompt_language in ("zh", "en"):
                summary = (await client.get("/api/reviews/sentences/overview", params={**params, "prompt_language": prompt_language})).json()
                assert summary["recent"]["available_count"] == 1
                assert summary["recent"]["round_kind"] == "repeat"
                assert summary["older"]["available_count"] == 0
                assert summary["today"] == {"sentence_count": 1, "word_count": 0, "review_count": 1}
            await client.post("/api/reviews/sentences/1", json={"mastery": "unknown"})
            for prompt_language in ("zh", "en"):
                summary = (await client.get("/api/reviews/sentences/overview", params={**params, "prompt_language": prompt_language})).json()
                assert summary["recent"]["empty_reason"] == "daily_limit"
                assert summary["today"]["sentence_count"] == 1
                assert summary["today"]["review_count"] == 2
                assert (await client.get("/api/reviews/sentences", params={**params, "prompt_language": prompt_language, "mode": "recent"})).json() == []
            with session() as db:
                assert len(list(db.scalars(select(ReviewLog)))) == 2
                assert db.get(Sentence, 1).review_count == 2
                assert db.get(Sentence, 1).english_text == "I am hungry."

    asyncio.run(flow())
