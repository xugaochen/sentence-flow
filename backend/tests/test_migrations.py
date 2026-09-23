import sqlite3
from pathlib import Path

from sqlalchemy import create_engine, inspect

from app.migrations import ensure_schema


def test_additive_migration_preserves_existing_rows(tmp_path: Path):
    database = tmp_path / "old.db"
    connection = sqlite3.connect(database)
    connection.executescript(
        """
        CREATE TABLE sentences (id INTEGER PRIMARY KEY, chinese_text TEXT NOT NULL);
        CREATE TABLE words (id INTEGER PRIMARY KEY, word TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '');
        INSERT INTO sentences (chinese_text) VALUES ('原有句子');
        INSERT INTO words (word, notes) VALUES ('hablar', '规则动词。\n直陈式现在时：yo hablo；tú hablas。');
        """
    )
    connection.commit()
    connection.close()

    engine = create_engine(f"sqlite:///{database}")
    ensure_schema(engine)

    inspector = inspect(engine)
    sentence_columns = {column["name"] for column in inspector.get_columns("sentences")}
    word_columns = {column["name"] for column in inspector.get_columns("words")}
    assert {"notes", "deleted_at", "english_text"}.issubset(sentence_columns)
    assert {"notes", "conjugation", "deleted_at"}.issubset(word_columns)
    with engine.connect() as connection:
        assert connection.exec_driver_sql("SELECT chinese_text, notes, deleted_at FROM sentences").one() == ("原有句子", "", None)
        assert connection.exec_driver_sql("SELECT english_text FROM sentences").scalar_one() == ""
        assert connection.exec_driver_sql("SELECT word, notes, conjugation, deleted_at FROM words").one() == ("hablar", "规则动词。", "yo hablo；tú hablas。", None)
        indexes = {row[1] for row in connection.exec_driver_sql("PRAGMA index_list('words')")}
        assert "ix_words_deleted_at" in indexes
    with engine.begin() as connection:
        connection.exec_driver_sql("UPDATE sentences SET english_text = 'An existing translation.'")
    ensure_schema(engine)
    with engine.connect() as connection:
        assert connection.exec_driver_sql("SELECT english_text FROM sentences").scalar_one() == "An existing translation."
    engine.dispose()
