from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import Sentence, Tag, Word
from ..schemas import SentenceCreate, SentenceOut, SentenceUpdate, WordCreate, WordOut
from ..services import tags_for_names


router = APIRouter(prefix="/sentences", tags=["sentences"])


def sentence_query():
    return select(Sentence).where(Sentence.deleted_at.is_(None)).options(
        selectinload(Sentence.tags),
        selectinload(Sentence.words),
    )


@router.get("", response_model=list[SentenceOut])
async def list_sentences(
    q: str | None = None,
    language: str | None = None,
    mastery: str | None = None,
    tag: str | None = None,
    db: Session = Depends(get_db),
):
    stmt = sentence_query().order_by(Sentence.created_at.desc())
    if q:
        stmt = stmt.where(or_(Sentence.chinese_text.contains(q), Sentence.target_text.contains(q), Sentence.notes.contains(q)))
    if language:
        stmt = stmt.where(Sentence.language == language)
    if mastery:
        stmt = stmt.where(Sentence.mastery == mastery)
    if tag:
        stmt = stmt.join(Sentence.tags).where(Tag.name == tag)
    return db.scalars(stmt).unique().all()


@router.post("", response_model=SentenceOut, status_code=status.HTTP_201_CREATED)
async def create_sentence(payload: SentenceCreate, db: Session = Depends(get_db)):
    values = payload.model_dump(exclude={"tags"})
    sentence = Sentence(**values, tags=tags_for_names(db, payload.tags))
    db.add(sentence)
    db.commit()
    return db.scalar(sentence_query().where(Sentence.id == sentence.id))


@router.get("/{sentence_id}", response_model=SentenceOut)
async def get_sentence(sentence_id: int, db: Session = Depends(get_db)):
    sentence = db.scalar(sentence_query().where(Sentence.id == sentence_id))
    if sentence is None:
        raise HTTPException(status_code=404, detail="句子不存在")
    return sentence


@router.put("/{sentence_id}", response_model=SentenceOut)
async def update_sentence(sentence_id: int, payload: SentenceUpdate, db: Session = Depends(get_db)):
    sentence = db.scalar(select(Sentence).where(Sentence.id == sentence_id, Sentence.deleted_at.is_(None)))
    if sentence is None:
        raise HTTPException(status_code=404, detail="句子不存在")
    for key, value in payload.model_dump(exclude={"tags"}).items():
        setattr(sentence, key, value)
    sentence.tags = tags_for_names(db, payload.tags)
    db.commit()
    return db.scalar(sentence_query().where(Sentence.id == sentence.id))


@router.delete("/{sentence_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sentence(sentence_id: int, db: Session = Depends(get_db)):
    sentence = db.scalar(select(Sentence).where(Sentence.id == sentence_id, Sentence.deleted_at.is_(None)))
    if sentence is None:
        raise HTTPException(status_code=404, detail="句子不存在")
    sentence.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{sentence_id}/words", response_model=WordOut, status_code=status.HTTP_201_CREATED)
async def add_word_to_sentence(sentence_id: int, payload: WordCreate, db: Session = Depends(get_db)):
    sentence = db.scalar(
        select(Sentence).options(selectinload(Sentence.words)).where(
            Sentence.id == sentence_id,
            Sentence.deleted_at.is_(None),
        )
    )
    if sentence is None:
        raise HTTPException(status_code=404, detail="句子不存在")
    if payload.language != sentence.language:
        raise HTTPException(status_code=400, detail="单词语言需要与来源句一致")

    language_words = db.scalars(
        select(Word).options(selectinload(Word.sentences)).where(Word.language == payload.language)
    ).unique().all()
    normalized = payload.word.strip().casefold()
    matches = [item for item in language_words if item.word.strip().casefold() == normalized]
    word = next((item for item in matches if item.deleted_at is None), None)
    if word is None and matches:
        raise HTTPException(status_code=409, detail="这个单词在回收站中，请先恢复后再关联")
    if word is None:
        values = payload.model_dump(exclude={"tags", "source_sentence_ids"})
        word = Word(**values, tags=tags_for_names(db, payload.tags))
        db.add(word)
    if sentence not in word.sentences:
        word.sentences.append(sentence)
    db.commit()
    from .words import word_query

    return db.scalar(word_query().where(Word.id == word.id))


@router.post("/{sentence_id}/words/{word_id}", response_model=WordOut)
async def link_existing_word(sentence_id: int, word_id: int, db: Session = Depends(get_db)):
    sentence = db.scalar(
        select(Sentence).options(selectinload(Sentence.words)).where(
            Sentence.id == sentence_id,
            Sentence.deleted_at.is_(None),
        )
    )
    word = db.scalar(
        select(Word).options(selectinload(Word.sentences)).where(
            Word.id == word_id,
            Word.deleted_at.is_(None),
        )
    )
    if sentence is None:
        raise HTTPException(status_code=404, detail="句子不存在")
    if word is None:
        raise HTTPException(status_code=404, detail="单词不存在")
    if word.language != sentence.language:
        raise HTTPException(status_code=400, detail="单词语言需要与来源句一致")
    if word not in sentence.words:
        sentence.words.append(word)
        db.commit()
    from .words import word_query

    return db.scalar(word_query().where(Word.id == word.id))
