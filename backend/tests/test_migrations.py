import sqlite3
from pathlib import Path

from sqlalchemy import create_engine, inspect

from app.migrations import ensure_schema


def test_notes_migration_preserves_existing_rows(tmp_path: Path):
    database = tmp_path / "old.db"
    connection = sqlite3.connect(database)
    connection.executescript(
        """
        CREATE TABLE sentences (id INTEGER PRIMARY KEY, chinese_text TEXT NOT NULL);
        CREATE TABLE words (id INTEGER PRIMARY KEY, word TEXT NOT NULL);
        INSERT INTO sentences (chinese_text) VALUES ('原有句子');
        INSERT INTO words (word) VALUES ('原有单词');
        """
    )
    connection.commit()
    connection.close()

    engine = create_engine(f"sqlite:///{database}")
    ensure_schema(engine)

    inspector = inspect(engine)
    assert "notes" in {column["name"] for column in inspector.get_columns("sentences")}
    assert "notes" in {column["name"] for column in inspector.get_columns("words")}
    with engine.connect() as connection:
        assert connection.exec_driver_sql("SELECT chinese_text, notes FROM sentences").one() == ("原有句子", "")
        assert connection.exec_driver_sql("SELECT word, notes FROM words").one() == ("原有单词", "")
    engine.dispose()

