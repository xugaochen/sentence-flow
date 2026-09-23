from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


Language = Literal["ja", "es", "en"]
Mastery = Literal["unknown", "fuzzy", "known"]


class TagOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str


class SentenceBase(BaseModel):
    chinese_text: str = Field(min_length=1)
    target_text: str = Field(min_length=1)
    language: Language
    notes: str = ""
    tags: list[str] = Field(default_factory=list)

    @field_validator("chinese_text", "target_text")
    @classmethod
    def strip_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("内容不能为空")
        return value

    @field_validator("notes")
    @classmethod
    def strip_notes(cls, value: str) -> str:
        return value.strip()

    @field_validator("tags")
    @classmethod
    def clean_tags(cls, values: list[str]) -> list[str]:
        return list(dict.fromkeys(value.strip() for value in values if value.strip()))


class SentenceCreate(SentenceBase):
    mastery: Mastery = "unknown"


class SentenceUpdate(SentenceBase):
    mastery: Mastery


class WordBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    word: str
    meaning: str
    notes: str
    part_of_speech: str
    mastery: str


class SentenceBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    chinese_text: str
    target_text: str
    language: str
    notes: str


class SentenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    chinese_text: str
    target_text: str
    notes: str
    language: str
    mastery: str
    created_at: datetime
    updated_at: datetime
    last_reviewed_at: datetime | None
    review_count: int
    tags: list[TagOut]
    words: list[WordBrief] = Field(default_factory=list)

    @field_validator("words", mode="before")
    @classmethod
    def active_words(cls, values):
        return [value for value in values if getattr(value, "deleted_at", None) is None]


class WordBase(BaseModel):
    word: str = Field(min_length=1)
    meaning: str = Field(min_length=1)
    language: Language
    notes: str = ""
    conjugation: str = ""
    part_of_speech: str = "other"
    tags: list[str] = Field(default_factory=list)

    @field_validator("word", "meaning", "part_of_speech")
    @classmethod
    def strip_fields(cls, value: str) -> str:
        return value.strip()

    @field_validator("notes", "conjugation")
    @classmethod
    def strip_optional_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("tags")
    @classmethod
    def clean_tags(cls, values: list[str]) -> list[str]:
        return list(dict.fromkeys(value.strip() for value in values if value.strip()))


class WordCreate(WordBase):
    mastery: Mastery = "unknown"
    source_sentence_ids: list[int] = Field(default_factory=list)


class WordUpdate(WordBase):
    mastery: Mastery
    source_sentence_ids: list[int] = Field(default_factory=list)


class WordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    word: str
    meaning: str
    notes: str
    conjugation: str
    language: str
    part_of_speech: str
    mastery: str
    created_at: datetime
    updated_at: datetime
    last_reviewed_at: datetime | None
    review_count: int
    tags: list[TagOut]
    sentences: list[SentenceBrief] = Field(default_factory=list)

    @field_validator("sentences", mode="before")
    @classmethod
    def active_sentences(cls, values):
        return [value for value in values if getattr(value, "deleted_at", None) is None]


class TrashSentenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    chinese_text: str
    target_text: str
    language: str
    deleted_at: datetime


class TrashWordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    word: str
    meaning: str
    language: str
    deleted_at: datetime


class TrashOut(BaseModel):
    sentences: list[TrashSentenceOut] = Field(default_factory=list)
    words: list[TrashWordOut] = Field(default_factory=list)


class ReviewResult(BaseModel):
    mastery: Mastery


class ReviewModeOverview(BaseModel):
    available_count: int
    candidate_count: int
    daily_limit_count: int
    empty_reason: Literal["no_items", "all_known", "no_recent", "no_older", "daily_limit", "already_reviewed_today"] | None
    round_kind: Literal["first", "repeat"] | None


class TodayReviewStats(BaseModel):
    sentence_count: int
    word_count: int
    review_count: int


class ReviewOverview(BaseModel):
    recent: ReviewModeOverview
    older: ReviewModeOverview
    today: TodayReviewStats


class StatsOut(BaseModel):
    sentence_total: int
    sentence_ja: int
    sentence_es: int
    sentence_en: int
    word_total: int
    word_ja: int
    word_es: int
    word_en: int
    reviewed_today: int
    reviewed_sentences_today: int
    reviewed_words_today: int
