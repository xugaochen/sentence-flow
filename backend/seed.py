"""Add a small, useful starter set. Safe to run more than once."""

from sqlalchemy import select

from app.database import Base, SessionLocal, engine
from app.models import Sentence, Word
from app.services import tags_for_names


SAMPLES = [
    {
        "chinese_text": "分手以后，她比以前开朗了。",
        "target_text": "別れてから、彼女は前より明るくなった。",
        "language": "ja",
        "notes": "「てから」表示前项动作完成后发生后项变化；「より」用于比较。",
        "tags": ["日常", "てから", "比较"],
        "words": [
            ("別れる", "分手", "动词", ["日常"], "一段动词；这里使用て形「別れて」。"),
            ("明るい", "开朗的；明亮的", "形容词", ["常用"], "既可以形容人的性格，也可以形容光线。"),
        ],
    },
    {
        "chinese_text": "旅行的时候，我喜欢早起逛城市。",
        "target_text": "Cuando viajo, me gusta madrugar para recorrer la ciudad.",
        "language": "es",
        "notes": "cuando 引导时间从句；para + 不定式表示目的。",
        "tags": ["旅行", "日常"],
        "words": [
            ("madrugar", "早起", "动词", ["旅行"], "不及物动词，常用于谈作息。"),
            ("recorrer", "走遍；游览", "动词", ["旅行"], "及物动词，后面直接接地点。"),
        ],
    },
]


def seed():
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        for sample in SAMPLES:
            sentence = db.scalar(select(Sentence).where(Sentence.target_text == sample["target_text"]))
            if sentence is None:
                sentence = Sentence(
                    chinese_text=sample["chinese_text"],
                    target_text=sample["target_text"],
                    language=sample["language"],
                    notes=sample["notes"],
                    tags=tags_for_names(db, sample["tags"]),
                )
                db.add(sentence)
                db.flush()
            for text, meaning, part, tag_names, notes in sample["words"]:
                word = db.scalar(select(Word).where(Word.word == text, Word.language == sample["language"]))
                if word is None:
                    word = Word(
                        word=text,
                        meaning=meaning,
                        language=sample["language"],
                        part_of_speech=part,
                        notes=notes,
                        tags=tags_for_names(db, tag_names),
                    )
                    db.add(word)
                if sentence not in word.sentences:
                    word.sentences.append(sentence)
        db.commit()
    print("示例数据已写入。")


if __name__ == "__main__":
    seed()
