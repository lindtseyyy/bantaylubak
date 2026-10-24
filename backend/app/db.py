import json
import sqlite3
from contextlib import closing
from pathlib import Path


def init_db(db_path: Path) -> None:
    with closing(sqlite3.connect(db_path)) as connection, connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                label TEXT NOT NULL,
                confidence REAL NOT NULL,
                image_file TEXT,
                polygon TEXT NOT NULL,
                box TEXT NOT NULL,
                detector TEXT NOT NULL
            )
            """
        )


def insert_event(
    db_path: Path,
    *,
    created_at: str,
    label: str,
    confidence: float,
    polygon: list,
    box: tuple,
    detector: str,
) -> int:
    with closing(sqlite3.connect(db_path)) as connection, connection:
        cursor = connection.execute(
            """
            INSERT INTO events (created_at, label, confidence, polygon, box, detector)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (created_at, label, confidence, json.dumps(polygon), json.dumps(box), detector),
        )
        return cursor.lastrowid


def set_image_file(db_path: Path, event_id: int, image_file: str) -> None:
    with closing(sqlite3.connect(db_path)) as connection, connection:
        connection.execute(
            "UPDATE events SET image_file = ? WHERE id = ?", (image_file, event_id)
        )


def delete_event(db_path: Path, event_id: int) -> None:
    with closing(sqlite3.connect(db_path)) as connection, connection:
        connection.execute("DELETE FROM events WHERE id = ?", (event_id,))


def count_events(db_path: Path) -> int:
    with closing(sqlite3.connect(db_path)) as connection:
        return connection.execute("SELECT COUNT(*) FROM events").fetchone()[0]


def list_events(db_path: Path, limit: int, offset: int) -> list[sqlite3.Row]:
    with closing(sqlite3.connect(db_path)) as connection:
        connection.row_factory = sqlite3.Row
        return connection.execute(
            "SELECT * FROM events ORDER BY id DESC LIMIT ? OFFSET ?", (limit, offset)
        ).fetchall()


def get_event(db_path: Path, event_id: int) -> sqlite3.Row | None:
    with closing(sqlite3.connect(db_path)) as connection:
        connection.row_factory = sqlite3.Row
        return connection.execute(
            "SELECT * FROM events WHERE id = ?", (event_id,)
        ).fetchone()
