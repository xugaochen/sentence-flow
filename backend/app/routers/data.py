import csv
import io
import json
from datetime import datetime, timezone
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import delete, select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import (
    ReviewLog,
    Sentence,
    Tag,
    Word,
    sentence_tags,
    sentence_words,
    word_tags,
)
from ..schemas import SentenceOut, TrashOut, WordOut


router = APIRouter(tags=["data"])


def iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


@router.get("/trash", response_model=TrashOut)
async def trash(db: Session = Depends(get_db)):
    sentences = db.scalars(
        select(Sentence).where(Sentence.deleted_at.is_not(None)).order_by(Sentence.deleted_at.desc())
    ).all()
    words = db.scalars(
        select(Word).where(Word.deleted_at.is_not(None)).order_by(Word.deleted_at.desc())
    ).all()
    return TrashOut(sentences=list(sentences), words=list(words))


@router.post("/trash/sentences/{sentence_id}/restore", response_model=SentenceOut)
async def restore_sentence(sentence_id: int, db: Session = Depends(get_db)):
    sentence = db.scalar(
        select(Sentence).options(selectinload(Sentence.tags), selectinload(Sentence.words)).where(
            Sentence.id == sentence_id,
            Sentence.deleted_at.is_not(None),
        )
    )
    if sentence is None:
        raise HTTPException(status_code=404, detail="回收站中没有这句话")
    sentence.deleted_at = None
    db.commit()
    db.refresh(sentence)
    return sentence


@router.post("/trash/words/{word_id}/restore", response_model=WordOut)
async def restore_word(word_id: int, db: Session = Depends(get_db)):
    word = db.scalar(
        select(Word).options(selectinload(Word.tags), selectinload(Word.sentences)).where(
            Word.id == word_id,
            Word.deleted_at.is_not(None),
        )
    )
    if word is None:
        raise HTTPException(status_code=404, detail="回收站中没有这个单词")
    word.deleted_at = None
    db.commit()
    db.refresh(word)
    return word


def purge_review_logs(db: Session, item_type: str, item_id: int) -> None:
    db.execute(delete(ReviewLog).where(ReviewLog.item_type == item_type, ReviewLog.item_id == item_id))


@router.delete("/trash/sentences/{sentence_id}", status_code=204)
async def purge_sentence(sentence_id: int, db: Session = Depends(get_db)):
    sentence = db.scalar(select(Sentence).where(Sentence.id == sentence_id, Sentence.deleted_at.is_not(None)))
    if sentence is None:
        raise HTTPException(status_code=404, detail="回收站中没有这句话")
    purge_review_logs(db, "sentence", sentence_id)
    db.delete(sentence)
    db.commit()
    return Response(status_code=204)


@router.delete("/trash/words/{word_id}", status_code=204)
async def purge_word(word_id: int, db: Session = Depends(get_db)):
    word = db.scalar(select(Word).where(Word.id == word_id, Word.deleted_at.is_not(None)))
    if word is None:
        raise HTTPException(status_code=404, detail="回收站中没有这个单词")
    purge_review_logs(db, "word", word_id)
    db.delete(word)
    db.commit()
    return Response(status_code=204)


@router.delete("/trash")
async def empty_trash(db: Session = Depends(get_db)):
    sentence_ids = list(db.scalars(select(Sentence.id).where(Sentence.deleted_at.is_not(None))).all())
    word_ids = list(db.scalars(select(Word.id).where(Word.deleted_at.is_not(None))).all())
    if sentence_ids:
        db.execute(delete(ReviewLog).where(ReviewLog.item_type == "sentence", ReviewLog.item_id.in_(sentence_ids)))
        db.execute(delete(Sentence).where(Sentence.id.in_(sentence_ids)))
    if word_ids:
        db.execute(delete(ReviewLog).where(ReviewLog.item_type == "word", ReviewLog.item_id.in_(word_ids)))
        db.execute(delete(Word).where(Word.id.in_(word_ids)))
    db.commit()
    return {"sentences": len(sentence_ids), "words": len(word_ids)}


def export_rows(db: Session) -> dict[str, list[dict]]:
    sentences = list(db.scalars(select(Sentence).order_by(Sentence.id)).all())
    words = list(db.scalars(select(Word).order_by(Word.id)).all())
    tags = list(db.scalars(select(Tag).order_by(Tag.id)).all())
    reviews = list(db.scalars(select(ReviewLog).order_by(ReviewLog.id)).all())
    sentence_tag_rows = [dict(row) for row in db.execute(select(sentence_tags)).mappings().all()]
    word_tag_rows = [dict(row) for row in db.execute(select(word_tags)).mappings().all()]
    sentence_word_rows = [dict(row) for row in db.execute(select(sentence_words)).mappings().all()]
    return {
        "sentences": [
            {
                "id": item.id,
                "chinese_text": item.chinese_text,
                "target_text": item.target_text,
                "notes": item.notes,
                "language": item.language,
                "mastery": item.mastery,
                "created_at": iso(item.created_at),
                "updated_at": iso(item.updated_at),
                "last_reviewed_at": iso(item.last_reviewed_at),
                "review_count": item.review_count,
                "deleted_at": iso(item.deleted_at),
            }
            for item in sentences
        ],
        "words": [
            {
                "id": item.id,
                "word": item.word,
                "meaning": item.meaning,
                "notes": item.notes,
                "language": item.language,
                "part_of_speech": item.part_of_speech,
                "mastery": item.mastery,
                "created_at": iso(item.created_at),
                "updated_at": iso(item.updated_at),
                "last_reviewed_at": iso(item.last_reviewed_at),
                "review_count": item.review_count,
                "deleted_at": iso(item.deleted_at),
            }
            for item in words
        ],
        "tags": [{"id": item.id, "name": item.name} for item in tags],
        "sentence_tags": sentence_tag_rows,
        "word_tags": word_tag_rows,
        "sentence_words": sentence_word_rows,
        "review_logs": [
            {
                "id": item.id,
                "item_type": item.item_type,
                "item_id": item.item_id,
                "result": item.result,
                "reviewed_at": iso(item.reviewed_at),
            }
            for item in reviews
        ],
    }


def export_document(db: Session) -> dict:
    return {
        "schema_version": 1,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        **export_rows(db),
    }


@router.get("/export/json")
async def export_json(db: Session = Depends(get_db)):
    document = export_document(db)
    body = json.dumps(document, ensure_ascii=False, indent=2).encode("utf-8")
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return Response(
        content=body,
        media_type="application/json; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="sentence-flow-{stamp}.json"'},
    )


CSV_FIELDS = {
    "sentences": ["id", "chinese_text", "target_text", "notes", "language", "mastery", "created_at", "updated_at", "last_reviewed_at", "review_count", "deleted_at"],
    "words": ["id", "word", "meaning", "notes", "language", "part_of_speech", "mastery", "created_at", "updated_at", "last_reviewed_at", "review_count", "deleted_at"],
    "tags": ["id", "name"],
    "sentence_tags": ["sentence_id", "tag_id"],
    "word_tags": ["word_id", "tag_id"],
    "sentence_words": ["sentence_id", "word_id"],
    "review_logs": ["id", "item_type", "item_id", "result", "reviewed_at"],
}


def csv_bytes(rows: list[dict], fieldnames: list[str]) -> bytes:
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue().encode("utf-8-sig")


@router.get("/export/csv")
async def export_csv(db: Session = Depends(get_db)):
    document = export_document(db)
    memory = io.BytesIO()
    with ZipFile(memory, "w", ZIP_DEFLATED) as archive:
        manifest = {"schema_version": document.pop("schema_version"), "exported_at": document.pop("exported_at")}
        archive.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2).encode("utf-8"))
        for name, rows in document.items():
            archive.writestr(f"{name}.csv", csv_bytes(rows, CSV_FIELDS[name]))
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return Response(
        content=memory.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="sentence-flow-{stamp}.zip"'},
    )
