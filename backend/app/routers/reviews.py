from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import ReviewLog, Sentence, Tag, Word
from ..schemas import ReviewResult, SentenceOut, WordOut
from ..services import sample_review_items


router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.get("/sentences", response_model=list[SentenceOut])
async def sentence_session(
    language: str | None = None,
    tag: str | None = None,
    limit: int = Query(10, ge=1, le=1000),
    mode: Literal["smart", "weighted", "uniform", "new_first"] = "weighted",
    all_items: bool = False,
    db: Session = Depends(get_db),
):
    stmt = select(Sentence).where(Sentence.deleted_at.is_(None)).options(selectinload(Sentence.tags), selectinload(Sentence.words))
    if language:
        stmt = stmt.where(Sentence.language == language)
    if tag:
        stmt = stmt.join(Sentence.tags).where(Tag.name == tag)
    return sample_review_items(db.scalars(stmt).unique().all(), limit, mode, all_items=all_items)


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
    mode: Literal["smart", "weighted", "uniform", "new_first"] = "weighted",
    all_items: bool = False,
    db: Session = Depends(get_db),
):
    stmt = select(Word).where(Word.deleted_at.is_(None)).options(selectinload(Word.tags), selectinload(Word.sentences))
    if language:
        stmt = stmt.where(Word.language == language)
    if part_of_speech:
        stmt = stmt.where(Word.part_of_speech == part_of_speech)
    if tag:
        stmt = stmt.join(Word.tags).where(Tag.name == tag)
    return sample_review_items(db.scalars(stmt).unique().all(), limit, mode, all_items=all_items)


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
