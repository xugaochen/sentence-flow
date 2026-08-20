from sqlalchemy import Engine, inspect


def ensure_schema(engine: Engine) -> None:
    """Apply tiny, additive SQLite migrations without touching existing data."""
    inspector = inspect(engine)
    additions = {
        "sentences": {"notes": "TEXT NOT NULL DEFAULT ''"},
        "words": {"notes": "TEXT NOT NULL DEFAULT ''"},
    }
    with engine.begin() as connection:
        for table, columns in additions.items():
            if not inspector.has_table(table):
                continue
            existing = {column["name"] for column in inspector.get_columns(table)}
            for name, definition in columns.items():
                if name not in existing:
                    connection.exec_driver_sql(f'ALTER TABLE "{table}" ADD COLUMN "{name}" {definition}')

