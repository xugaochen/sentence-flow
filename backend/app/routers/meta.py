from datetime import datetime, time, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import and_, distinct, exists, func, or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ReviewLog, Sentence, Tag, Word, sentence_tags, word_tags
from ..schemas import StatsOut


router = APIRouter(tags=["meta"])


@router.get("/stats", response_model=StatsOut)
async def stats(db: Session = Depends(get_db)):
    local_now = datetime.now().astimezone()
    local_start = datetime.combine(local_now.date(), time.min, tzinfo=local_now.tzinfo)
    today_start = local_start.astimezone(timezone.utc)
    return StatsOut(
        sentence_total=db.scalar(select(func.count(Sentence.id)).where(Sentence.deleted_at.is_(None))) or 0,
        sentence_ja=db.scalar(select(func.count(Sentence.id)).where(Sentence.language == "ja", Sentence.deleted_at.is_(None))) or 0,
        sentence_es=db.scalar(select(func.count(Sentence.id)).where(Sentence.language == "es", Sentence.deleted_at.is_(None))) or 0,
        word_total=db.scalar(select(func.count(Word.id)).where(Word.deleted_at.is_(None))) or 0,
        reviewed_today=db.scalar(
            select(func.count(ReviewLog.id)).where(
                ReviewLog.reviewed_at >= today_start,
                or_(
                    and_(
                        ReviewLog.item_type == "sentence",
                        exists(select(Sentence.id).where(Sentence.id == ReviewLog.item_id, Sentence.deleted_at.is_(None))),
                    ),
                    and_(
                        ReviewLog.item_type == "word",
                        exists(select(Word.id).where(Word.id == ReviewLog.item_id, Word.deleted_at.is_(None))),
                    ),
                ),
            )
        ) or 0,
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
