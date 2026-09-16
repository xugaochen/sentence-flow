import os
import asyncio
import csv
import io
import json
from zipfile import ZipFile
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
            "conjugation": "辞书形：別れる；ます形：別れます。",
            "part_of_speech": "动词",
            "tags": ["日常"],
        })
        assert word_response.status_code == 201
        word = word_response.json()
        assert word["sentences"][0]["id"] == sentence["id"]
        assert word["notes"].startswith("一段动词")
        assert word["conjugation"].startswith("辞书形")
        assert [item["id"] for item in (await client.get("/api/words?q=ます形")).json()] == [word["id"]]

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

        english_response = await client.post("/api/sentences", json={
            "chinese_text": "我每天学习英语。",
            "target_text": "I study English every day.",
            "language": "en",
            "notes": "一般现在时。",
            "tags": ["日常"],
        })
        assert english_response.status_code == 201
        english_sentence = english_response.json()
        english_word_response = await client.post(f"/api/sentences/{english_sentence['id']}/words", json={
            "word": "study",
            "meaning": "学习",
            "language": "en",
            "notes": "",
            "part_of_speech": "动词",
            "tags": ["常用"],
        })
        assert english_word_response.status_code == 201
        english_word = english_word_response.json()
        assert [item["id"] for item in (await client.get("/api/reviews/sentences?language=en&limit=10")).json()] == [english_sentence["id"]]

        for kind, item_id in (("sentences", english_sentence["id"]), ("words", english_word["id"])):
            uniform = (await client.get(f"/api/reviews/{kind}?language=en&mode=uniform&limit=3")).json()
            assert [item["id"] for item in uniform] == [item_id, item_id, item_id]
            uniform_all = (await client.get(f"/api/reviews/{kind}?language=en&mode=uniform&limit=30&all_items=true")).json()
            assert [item["id"] for item in uniform_all] == [item_id]
            assert (await client.get(f"/api/reviews/{kind}?mode=invalid")).status_code == 422

        stats = (await client.get("/api/stats")).json()
        assert stats == {
            "sentence_total": 3,
            "sentence_ja": 2,
            "sentence_es": 0,
            "sentence_en": 1,
            "word_total": 3,
            "word_ja": 2,
            "word_es": 0,
            "word_en": 1,
            "reviewed_today": 1,
        }

        sentences = (await client.get("/api/sentences?tag=日常&mastery=known")).json()
        assert len(sentences) == 1
        sentence_id = sentences[0]["id"]
        assert (await client.delete(f"/api/sentences/{sentence_id}")).status_code == 204
        words = (await client.get("/api/words?q=別れる")).json()
        assert len(words) == 1
        assert [source["id"] for source in words[0]["sentences"]] == [second["id"]]
        assert "比较" not in (await client.get("/api/tags")).json()


def test_sentence_word_review_filter_and_deletion_flow():
    asyncio.run(request_flow())


async def data_safety_flow():
    async with app.router.lifespan_context(app):
      async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        sentence = (await client.post("/api/sentences", json={
            "chinese_text": "她是比我年长的人。",
            "target_text": "彼女は私より年上です。",
            "language": "ja",
            "notes": "",
            "tags": ["人物"],
        })).json()
        word_response = await client.post(f"/api/sentences/{sentence['id']}/words", json={
            "word": "年上",
            "meaning": "年纪比自己大的人",
            "language": "ja",
            "notes": "年齢が上であること。",
            "part_of_speech": "名词",
            "tags": ["人物"],
        })
        assert word_response.status_code == 201
        word = word_response.json()
        assert [item["id"] for item in (await client.get("/api/words?q=年纪比自己大")).json()] == [word["id"]]

        assert (await client.post(f"/api/reviews/sentences/{sentence['id']}", json={"mastery": "fuzzy"})).status_code == 200
        assert (await client.post(f"/api/reviews/words/{word['id']}", json={"mastery": "known"})).status_code == 200

        stats_before_delete = (await client.get("/api/stats")).json()
        assert (await client.delete(f"/api/sentences/{sentence['id']}")).status_code == 204
        assert (await client.get(f"/api/sentences/{sentence['id']}")).status_code == 404
        assert sentence["id"] not in {item["id"] for item in (await client.get("/api/sentences?q=年上")).json()}
        assert sentence["id"] not in {item["id"] for item in (await client.get("/api/reviews/sentences?limit=1000")).json()}
        assert sentence["id"] not in {item["id"] for item in (await client.get(f"/api/words/{word['id']}")).json()["sentences"]}
        stats_after_delete = (await client.get("/api/stats")).json()
        assert stats_after_delete["sentence_total"] == stats_before_delete["sentence_total"] - 1
        assert stats_after_delete["reviewed_today"] == stats_before_delete["reviewed_today"] - 1
        trash = (await client.get("/api/trash")).json()
        assert sentence["id"] in {item["id"] for item in trash["sentences"]}

        restored_sentence = await client.post(f"/api/trash/sentences/{sentence['id']}/restore", json={})
        assert restored_sentence.status_code == 200
        assert word["id"] in {item["id"] for item in restored_sentence.json()["words"]}

        assert (await client.delete(f"/api/words/{word['id']}")).status_code == 204
        assert word["id"] not in {item["id"] for item in (await client.get("/api/words?q=年上")).json()}
        assert word["id"] not in {item["id"] for item in (await client.get("/api/reviews/words?limit=1000")).json()}
        sentence_without_word = (await client.get(f"/api/sentences/{sentence['id']}")).json()
        assert word["id"] not in {item["id"] for item in sentence_without_word["words"]}

        json_export_response = await client.get("/api/export/json")
        assert json_export_response.status_code == 200
        document = json.loads(json_export_response.content)
        exported_word = next(item for item in document["words"] if item["id"] == word["id"])
        assert exported_word["word"] == "年上"
        assert "conjugation" in exported_word
        exported_verb = next(item for item in document["words"] if item["word"] == "別れる")
        assert exported_verb["conjugation"].startswith("辞书形")
        assert exported_word["deleted_at"] is not None
        assert {"schema_version", "sentences", "words", "sentence_words", "review_logs"}.issubset(document)

        csv_export_response = await client.get("/api/export/csv")
        assert csv_export_response.status_code == 200
        with ZipFile(io.BytesIO(csv_export_response.content)) as archive:
            assert {"manifest.json", "sentences.csv", "words.csv", "sentence_words.csv", "review_logs.csv"}.issubset(archive.namelist())
            rows = list(csv.DictReader(io.TextIOWrapper(archive.open("words.csv"), encoding="utf-8-sig")))
            assert next(item for item in rows if int(item["id"]) == word["id"])["word"] == "年上"
            assert "conjugation" in rows[0]

        restored_word = await client.post(f"/api/trash/words/{word['id']}/restore", json={})
        assert restored_word.status_code == 200
        assert sentence["id"] in {item["id"] for item in restored_word.json()["sentences"]}

        assert (await client.delete(f"/api/words/{word['id']}")).status_code == 204
        assert (await client.delete(f"/api/trash/words/{word['id']}")).status_code == 204
        assert (await client.get(f"/api/words/{word['id']}")).status_code == 404
        after_purge = json.loads((await client.get("/api/export/json")).content)
        assert not any(item["item_type"] == "word" and item["item_id"] == word["id"] for item in after_purge["review_logs"])
        assert (await client.get(f"/api/sentences/{sentence['id']}")).status_code == 200

        assert (await client.delete(f"/api/sentences/{sentence['id']}")).status_code == 204
        emptied = await client.delete("/api/trash")
        assert emptied.status_code == 200
        assert emptied.json()["sentences"] >= 1
        final_trash = (await client.get("/api/trash")).json()
        assert final_trash == {"sentences": [], "words": []}


def test_trash_restore_purge_and_exports():
    asyncio.run(data_safety_flow())


def test_frontend_fallback_and_api_404(tmp_path, monkeypatch):
    import app.main as main_module
    from fastapi import HTTPException
    from fastapi.responses import FileResponse

    index = tmp_path / "index.html"
    index.write_text("<!doctype html><title>Sentence Flow</title>", encoding="utf-8")
    monkeypatch.setattr(main_module, "FRONTEND_INDEX", index)

    async def call_frontend():
        root = await main_module.frontend_app("")
        nested = await main_module.frontend_app("sentences/128")
        assert isinstance(root, FileResponse)
        assert isinstance(nested, FileResponse)
        assert root.path == index
        assert nested.path == index

        try:
            await main_module.frontend_app("api/not-found")
        except HTTPException as error:
            assert error.status_code == 404
            assert error.detail == "接口不存在"
        else:
            raise AssertionError("不存在的 API 应返回 404")

        monkeypatch.setattr(main_module, "FRONTEND_INDEX", tmp_path / "missing.html")
        try:
            await main_module.frontend_app("")
        except HTTPException as error:
            assert error.status_code == 503
            assert "前端尚未构建" in error.detail
        else:
            raise AssertionError("缺少前端构建时应返回 503")

    asyncio.run(call_frontend())
