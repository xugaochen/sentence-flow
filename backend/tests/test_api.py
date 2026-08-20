import os
import asyncio
from pathlib import Path

TEST_DB = Path(__file__).parent / "test_language_study.db"
os.environ["LANGUAGE_STUDY_DATABASE_URL"] = f"sqlite:///{TEST_DB}"

from httpx import ASGITransport, AsyncClient

from app.database import Base, engine
from app.main import app


def setup_module():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def teardown_module():
    Base.metadata.drop_all(bind=engine)
    TEST_DB.unlink(missing_ok=True)


async def request_flow():
    async with app.router.lifespan_context(app):
      async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        sentence_response = await client.post("/api/sentences", json={
            "chinese_text": "分手以后，她比以前开朗了。",
            "target_text": "別れてから、彼女は前より明るくなった。",
            "language": "ja",
            "notes": "てから表示动作发生之后的状态变化。",
            "tags": ["日常", "比较"],
        })
        assert sentence_response.status_code == 201
        sentence = sentence_response.json()
        assert [tag["name"] for tag in sentence["tags"]] == ["日常", "比较"]
        assert sentence["notes"].startswith("てから")

        word_response = await client.post(f"/api/sentences/{sentence['id']}/words", json={
            "word": "別れる",
            "meaning": "分手",
            "language": "ja",
            "notes": "一段动词，て形是別れて。",
            "part_of_speech": "动词",
            "tags": ["日常"],
        })
        assert word_response.status_code == 201
        word = word_response.json()
        assert word["sentences"][0]["id"] == sentence["id"]
        assert word["notes"].startswith("一段动词")

        second_word_response = await client.post(f"/api/sentences/{sentence['id']}/words", json={
            "word": "明るい",
            "meaning": "开朗的；明亮的",
            "language": "ja",
            "notes": "既可以形容性格，也可以形容光线。",
            "part_of_speech": "形容词",
            "tags": ["常用"],
        })
        assert second_word_response.status_code == 201
        assert second_word_response.json()["id"] != word["id"]

        second_response = await client.post("/api/sentences", json={
            "chinese_text": "他们昨天分手了。",
            "target_text": "彼らは昨日別れた。",
            "language": "ja",
            "notes": "",
            "tags": ["过去式"],
        })
        second = second_response.json()
        reused_response = await client.post(f"/api/sentences/{second['id']}/words", json={
            "word": "別れる",
            "meaning": "离别（不应覆盖原释义）",
            "language": "ja",
            "notes": "不应覆盖原讲解",
            "part_of_speech": "其他",
            "tags": ["新标签"],
        })
        reused = reused_response.json()
        assert reused["id"] == word["id"]
        assert reused["meaning"] == "分手"
        assert reused["notes"] == "一段动词，て形是別れて。"
        assert {source["id"] for source in reused["sentences"]} == {sentence["id"], second["id"]}

        linked = await client.post(f"/api/sentences/{second['id']}/words/{word['id']}", json={})
        assert linked.status_code == 200
        assert len(linked.json()["sentences"]) == 2

        detail = (await client.get(f"/api/sentences/{sentence['id']}")).json()
        assert {entry["word"] for entry in detail["words"]} == {"別れる", "明るい"}

        session = (await client.get("/api/reviews/sentences?language=ja&limit=10")).json()
        assert len(session) == 2
        reviewed = (await client.post(f"/api/reviews/sentences/{sentence['id']}", json={"mastery": "known"})).json()
        assert reviewed["mastery"] == "known"
        assert reviewed["review_count"] == 1

        stats = (await client.get("/api/stats")).json()
        assert stats == {
            "sentence_total": 2,
            "sentence_ja": 2,
            "sentence_es": 0,
            "word_total": 2,
            "reviewed_today": 1,
        }

        sentences = (await client.get("/api/sentences?tag=日常&mastery=known")).json()
        assert len(sentences) == 1
        sentence_id = sentences[0]["id"]
        assert (await client.delete(f"/api/sentences/{sentence_id}")).status_code == 204
        words = (await client.get("/api/words?q=別れる")).json()
        assert len(words) == 1
        assert [source["id"] for source in words[0]["sentences"]] == [second["id"]]


def test_sentence_word_review_filter_and_deletion_flow():
    asyncio.run(request_flow())
