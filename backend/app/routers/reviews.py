from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import ReviewLog, Sentence, Word
from ..review_schedule import (
    review_counts_today, review_items, sample_scheduled_items,
    scheduled_review_pool, today_review_stats,
)
from ..schemas import ReviewOverview, ReviewResult, SentenceOut, WordOut
from ..services import sample_review_items


router = APIRouter(prefix="/reviews", tags=["reviews"])
ReviewMode = Literal["recent", "older", "smart", "weighted", "uniform", "new_first"]


def session_items(db, item_type, language, part_of_speech, tag, limit, mode, all_items):
    items = review_items(db, item_type, language=language, part_of_speech=part_of_speech, tag=tag)
    if mode in ("recent", "older"):
        now = datetime.now(timezone.utc)
        counts = review_counts_today(db, item_type, now=now)
        pool = scheduled_review_pool(items, mode, counts, now=now)
        return sample_scheduled_items(pool, mode, limit, all_items=all_items, now=now)
    return sample_review_items(items, limit, mode, all_items=all_items)


@router.get("/{kind}/overview", response_model=ReviewOverview)
async def review_overview(
    kind: Literal["sentences", "words"],
    language: str | None = None,
    part_of_speech: str | None = None,
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    item_type = "sentence" if kind == "sentences" else "word"
    items = review_items(db, item_type, language=language, part_of_speech=part_of_speech)
    counts = review_counts_today(db, item_type, now=now)
    return {
        "recent": scheduled_review_pool(items, "recent", counts, now=now).overview(),
        "older": scheduled_review_pool(items, "older", counts, now=now).overview(),
        "today": today_review_stats(db, language=language, part_of_speech=part_of_speech, now=now),
    }


@router.get("/sentences", response_model=list[SentenceOut])
async def sentence_session(
    language: str | None = None,
    tag: str | None = None,
    limit: int = Query(10, ge=1, le=1000),
    mode: ReviewMode = "weighted",
    all_items: bool = False,
    db: Session = Depends(get_db),
):
    return session_items(db, "sentence", language, None, tag, limit, mode, all_items)


@router.post("/sentences/{sentence_id}", response_model=SentenceOut)
async def review_sentence(sentence_id: int, payload: ReviewResult, db: Session = Depends(get_db)):
    sentence = db.scalar(
        select(Sentence).options(selectinload(Sentence.tags), selectinload(Sentence.words)).where(
            Sentence.id == sentence_id,
            Sentence.deleted_at.is_(None),
        )
    )
    if sentence is None:
        raise HTTPException(status_code=404, detail="句子不存在")
    sentence.mastery = payload.mastery
    sentence.review_count += 1
    sentence.last_reviewed_at = datetime.now(timezone.utc)
    db.add(ReviewLog(item_type="sentence", item_id=sentence.id, result=payload.mastery))
    db.commit()
    db.refresh(sentence)
    return sentence


@router.get("/words", response_model=list[WordOut])
async def word_session(
    language: str | None = None,
    part_of_speech: str | None = None,
    tag: str | None = None,
    limit: int = Query(10, ge=1, le=1000),
    mode: ReviewMode = "weighted",
    all_items: bool = False,
    db: Session = Depends(get_db),
):
    return session_items(db, "word", language, part_of_speech, tag, limit, mode, all_items)


@router.post("/words/{word_id}", response_model=WordOut)
async def review_word(word_id: int, payload: ReviewResult, db: Session = Depends(get_db)):
    word = db.scalar(
        select(Word).options(selectinload(Word.tags), selectinload(Word.sentences)).where(
            Word.id == word_id,
            Word.deleted_at.is_(None),
        )
    )
    if word is None:
        raise HTTPException(status_code=404, detail="单词不存在")
    word.mastery = payload.mastery
    word.review_count += 1
    word.last_reviewed_at = datetime.now(timezone.utc)
    db.add(ReviewLog(item_type="word", item_id=word.id, result=payload.mastery))
    db.commit()
    db.refresh(word)
    return word
