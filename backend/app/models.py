from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Table, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


sentence_tags = Table(
    "sentence_tags",
    Base.metadata,
    Column("sentence_id", ForeignKey("sentences.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)

word_tags = Table(
    "word_tags",
    Base.metadata,
    Column("word_id", ForeignKey("words.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)

sentence_words = Table(
    "sentence_words",
    Base.metadata,
    Column("sentence_id", ForeignKey("sentences.id", ondelete="CASCADE"), primary_key=True),
    Column("word_id", ForeignKey("words.id", ondelete="CASCADE"), primary_key=True),
)


class Sentence(Base):
    __tablename__ = "sentences"

    id: Mapped[int] = mapped_column(primary_key=True)
    chinese_text: Mapped[str] = mapped_column(Text)
    target_text: Mapped[str] = mapped_column(Text)
    notes: Mapped[str] = mapped_column(Text, default="")
    language: Mapped[str] = mapped_column(String(12), index=True)
    mastery: Mapped[str] = mapped_column(String(12), default="unknown", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    last_reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    review_count: Mapped[int] = mapped_column(Integer, default=0)

    tags: Mapped[list["Tag"]] = relationship(secondary=sentence_tags, back_populates="sentences")
    words: Mapped[list["Word"]] = relationship(secondary=sentence_words, back_populates="sentences")


class Word(Base):
    __tablename__ = "words"

    id: Mapped[int] = mapped_column(primary_key=True)
    word: Mapped[str] = mapped_column(String(255), index=True)
    meaning: Mapped[str] = mapped_column(String(255), index=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    language: Mapped[str] = mapped_column(String(12), index=True)
    part_of_speech: Mapped[str] = mapped_column(String(40), default="other", index=True)
    mastery: Mapped[str] = mapped_column(String(12), default="unknown", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    last_reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    review_count: Mapped[int] = mapped_column(Integer, default=0)

    tags: Mapped[list["Tag"]] = relationship(secondary=word_tags, back_populates="words")
    sentences: Mapped[list[Sentence]] = relationship(secondary=sentence_words, back_populates="words")


class Tag(Base):
    __tablename__ = "tags"
    __table_args__ = (UniqueConstraint("name", name="uq_tag_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), index=True)

    sentences: Mapped[list[Sentence]] = relationship(secondary=sentence_tags, back_populates="tags")
    words: Mapped[list[Word]] = relationship(secondary=word_tags, back_populates="tags")


class ReviewLog(Base):
    __tablename__ = "review_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    item_type: Mapped[str] = mapped_column(String(12), index=True)
    item_id: Mapped[int] = mapped_column(Integer, index=True)
    result: Mapped[str] = mapped_column(String(12))
    reviewed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
