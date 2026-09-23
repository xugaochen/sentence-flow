from fastapi import APIRouter, Depends
from sqlalchemy import distinct, func, or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Sentence, Tag, Word, sentence_tags, word_tags
from ..review_schedule import today_review_stats
from ..schemas import StatsOut


router = APIRouter(tags=["meta"])


@router.get("/stats", response_model=StatsOut)
async def stats(db: Session = Depends(get_db)):
    today = today_review_stats(db)
    return StatsOut(
        sentence_total=db.scalar(select(func.count(Sentence.id)).where(Sentence.deleted_at.is_(None))) or 0,
        sentence_ja=db.scalar(select(func.count(Sentence.id)).where(Sentence.language == "ja", Sentence.deleted_at.is_(None))) or 0,
        sentence_es=db.scalar(select(func.count(Sentence.id)).where(Sentence.language == "es", Sentence.deleted_at.is_(None))) or 0,
        sentence_en=db.scalar(select(func.count(Sentence.id)).where(Sentence.language == "en", Sentence.deleted_at.is_(None))) or 0,
        word_total=db.scalar(select(func.count(Word.id)).where(Word.deleted_at.is_(None))) or 0,
        word_ja=db.scalar(select(func.count(Word.id)).where(Word.language == "ja", Word.deleted_at.is_(None))) or 0,
        word_es=db.scalar(select(func.count(Word.id)).where(Word.language == "es", Word.deleted_at.is_(None))) or 0,
        word_en=db.scalar(select(func.count(Word.id)).where(Word.language == "en", Word.deleted_at.is_(None))) or 0,
        reviewed_today=today["review_count"],
        reviewed_sentences_today=today["sentence_count"],
        reviewed_words_today=today["word_count"],
    )


@router.get("/tags", response_model=list[str])
async def tags(kind: str | None = None, db: Session = Depends(get_db)):
    stmt = select(Tag.name).order_by(Tag.name)
    if kind == "sentence":
        stmt = stmt.join(sentence_tags).join(Sentence).where(Sentence.deleted_at.is_(None)).distinct()
    elif kind == "word":
        stmt = stmt.join(word_tags).join(Word).where(Word.deleted_at.is_(None)).distinct()
    else:
        stmt = stmt.where(or_(
            Tag.sentences.any(Sentence.deleted_at.is_(None)),
            Tag.words.any(Word.deleted_at.is_(None)),
        ))
    return list(db.scalars(stmt).all())


@router.get("/parts-of-speech", response_model=list[str])
async def parts_of_speech(db: Session = Depends(get_db)):
    return list(db.scalars(
        select(distinct(Word.part_of_speech)).where(Word.deleted_at.is_(None)).order_by(Word.part_of_speech)
    ).all())
