from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import Sentence, Tag, Word
from ..schemas import WordCreate, WordOut, WordUpdate
from ..services import tags_for_names


router = APIRouter(prefix="/words", tags=["words"])


def word_query():
    return select(Word).options(
        selectinload(Word.tags),
        selectinload(Word.sentences),
    )


@router.get("", response_model=list[WordOut])
async def list_words(
    q: str | None = None,
    language: str | None = None,
    mastery: str | None = None,
    part_of_speech: str | None = None,
    tag: str | None = None,
    db: Session = Depends(get_db),
):
    stmt = word_query().order_by(Word.created_at.desc())
    if q:
        stmt = stmt.where(or_(Word.word.contains(q), Word.meaning.contains(q), Word.notes.contains(q)))
    if language:
        stmt = stmt.where(Word.language == language)
    if mastery:
        stmt = stmt.where(Word.mastery == mastery)
    if part_of_speech:
        stmt = stmt.where(Word.part_of_speech == part_of_speech)
    if tag:
        stmt = stmt.join(Word.tags).where(Tag.name == tag)
    return db.scalars(stmt).unique().all()


@router.post("", response_model=WordOut, status_code=status.HTTP_201_CREATED)
async def create_word(payload: WordCreate, db: Session = Depends(get_db)):
    language_words = db.scalars(word_query().where(Word.language == payload.language)).unique().all()
    normalized = payload.word.strip().casefold()
    existing = next((item for item in language_words if item.word.strip().casefold() == normalized), None)
    if existing is not None:
        sources = list(db.scalars(select(Sentence).where(Sentence.id.in_(payload.source_sentence_ids))).all()) if payload.source_sentence_ids else []
        for sentence in sources:
            if sentence not in existing.sentences:
                existing.sentences.append(sentence)
        db.commit()
        return db.scalar(word_query().where(Word.id == existing.id))

    values = payload.model_dump(exclude={"tags", "source_sentence_ids"})
    word = Word(**values, tags=tags_for_names(db, payload.tags))
    if payload.source_sentence_ids:
        word.sentences = list(db.scalars(select(Sentence).where(Sentence.id.in_(payload.source_sentence_ids))).all())
    db.add(word)
    db.commit()
    return db.scalar(word_query().where(Word.id == word.id))


@router.get("/{word_id}", response_model=WordOut)
async def get_word(word_id: int, db: Session = Depends(get_db)):
    word = db.scalar(word_query().where(Word.id == word_id))
    if word is None:
        raise HTTPException(status_code=404, detail="单词不存在")
    return word


@router.put("/{word_id}", response_model=WordOut)
async def update_word(word_id: int, payload: WordUpdate, db: Session = Depends(get_db)):
    word = db.get(Word, word_id)
    if word is None:
        raise HTTPException(status_code=404, detail="单词不存在")
    for key, value in payload.model_dump(exclude={"tags", "source_sentence_ids"}).items():
        setattr(word, key, value)
    word.tags = tags_for_names(db, payload.tags)
    word.sentences = list(db.scalars(select(Sentence).where(Sentence.id.in_(payload.source_sentence_ids))).all()) if payload.source_sentence_ids else []
    db.commit()
    return db.scalar(word_query().where(Word.id == word.id))


@router.delete("/{word_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_word(word_id: int, db: Session = Depends(get_db)):
    word = db.get(Word, word_id)
    if word is None:
        raise HTTPException(status_code=404, detail="单词不存在")
    db.delete(word)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
