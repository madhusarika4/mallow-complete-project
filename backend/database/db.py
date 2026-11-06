"""SQLite storage for Mallow. All SQL is parameterised."""

from __future__ import annotations

import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Sequence

from database.migrations import LATEST_VERSION, backup_existing_database, run_migrations
from services.age import age_in_years, band_for_age, parse_dob

SCHEMA_PATH = Path(__file__).resolve().parent / "schema.sql"


def utcnow_iso() -> str:
    """Return a sortable UTC timestamp."""

    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Database:
    """Small SQLite wrapper that opens a fresh connection per operation."""

    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.initialise()

    def connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    INFANT_CARE_COLUMNS = (
        ("amount_ml", "INTEGER"),
        ("duration_minutes", "INTEGER"),
        ("details", "TEXT NOT NULL DEFAULT ''"),
    )
    CHILD_VOICE_COLUMNS = (
        ("voice_engine", "TEXT NOT NULL DEFAULT ''"),
        ("voice_id", "TEXT NOT NULL DEFAULT ''"),
        ("voice_language", "TEXT NOT NULL DEFAULT ''"),
        ("voice_locale", "TEXT NOT NULL DEFAULT ''"),
    )

    def initialise(self) -> None:
        with closing(self.connect()) as connection:
            existing_tables = {
                row[0]
                for row in connection.execute(
                    "SELECT name FROM sqlite_master WHERE type = 'table'"
                ).fetchall()
            }
            has_user_data = any(
                table in existing_tables
                and connection.execute(f"SELECT 1 FROM {table} LIMIT 1").fetchone()
                for table in ("children", "settings", "sessions", "messages")
            )
            has_migrations = "schema_migrations" in existing_tables
            current_version = (
                connection.execute("SELECT MAX(version) FROM schema_migrations").fetchone()[0]
                if has_migrations
                else 0
            )
            # executescript may create tables and indexes, so preserve a populated
            # legacy DB before applying even the base schema.
            backup_created = backup_existing_database(
                connection,
                self.path if self.path.exists() else None,
                has_user_data=has_user_data,
                migration_pending=int(current_version or 0) < LATEST_VERSION,
            )
            connection.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
            existing = {
                row["name"]
                for row in connection.execute("PRAGMA table_info(children)").fetchall()
            }
            infant_columns = {
                row["name"]
                for row in connection.execute("PRAGMA table_info(infant_care)").fetchall()
            }
            for name, definition in self.INFANT_CARE_COLUMNS:
                if name not in infant_columns:
                    connection.execute(
                        f"ALTER TABLE infant_care ADD COLUMN {name} {definition}"
                    )
            for name, definition in self.CHILD_VOICE_COLUMNS:
                if name not in existing:
                    connection.execute(
                        f"ALTER TABLE children ADD COLUMN {name} {definition}"
                    )
            connection.commit()
            run_migrations(connection, self.path, backup_created=backup_created)

    def execute(self, sql: str, params: Sequence[Any] = ()) -> int:
        with closing(self.connect()) as connection:
            cursor = connection.execute(sql, params)
            connection.commit()
            return int(cursor.lastrowid or 0)

    def execute_many(self, sql: str, rows: Iterable[Sequence[Any]]) -> None:
        with closing(self.connect()) as connection:
            connection.executemany(sql, rows)
            connection.commit()

    def query(self, sql: str, params: Sequence[Any] = ()) -> list[dict[str, Any]]:
        with closing(self.connect()) as connection:
            rows = connection.execute(sql, params).fetchall()
            return [dict(row) for row in rows]

    def query_one(self, sql: str, params: Sequence[Any] = ()) -> dict[str, Any] | None:
        rows = self.query(sql, params)
        return rows[0] if rows else None

    def get_setting(self, key: str, default: str | None = None) -> str | None:
        row = self.query_one("SELECT value FROM settings WHERE key = ?", (key,))
        return row["value"] if row else default

    def set_setting(self, key: str, value: str) -> None:
        self.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, value),
        )

    def delete_setting(self, key: str) -> None:
        self.execute("DELETE FROM settings WHERE key = ?", (key,))

    def create_child(
        self,
        nickname: str,
        age_band: str,
        languages: str,
        voice_preset: str,
        activities: str,
        blocked_topics: str = "",
        daily_minutes: int = 30,
        voice_enabled: bool = True,
        voice_engine: str = "",
        voice_id: str = "",
        voice_language: str = "",
        voice_locale: str = "",
        dob: str | None = None,
        dob_exact: bool = False,
        is_demo: bool = False,
        preferred_language: str = "",
    ) -> int:
        return self.execute(
            "INSERT INTO children "
            "(nickname, age_band, languages, voice_preset, voice_engine, voice_id, "
            " voice_language, voice_locale, activities, blocked_topics, daily_minutes, "
            " voice_enabled, dob, dob_exact, is_demo, preferred_language) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                nickname,
                age_band,
                languages,
                voice_preset,
                voice_engine,
                voice_id,
                voice_language,
                voice_locale,
                activities,
                blocked_topics,
                daily_minutes,
                int(voice_enabled),
                dob,
                int(dob_exact),
                int(is_demo),
                preferred_language,
            ),
        )

    def ensure_default_child(self, voice_preset: str) -> dict[str, Any]:
        """Legacy helper kept for tests; the web app lets parents create profiles."""

        rows = self.list_children()
        if rows:
            return rows[0]
        self.create_child(
            nickname="Child",
            age_band="7-9",
            languages="English,Telugu,Hinglish",
            voice_preset=voice_preset or "default",
            activities="stories,riddles,quizzes,vocabulary,basic maths,simple science",
        )
        return self.list_children()[0]

    def _sync_age_band(self, child: dict[str, Any]) -> dict[str, Any]:
        """Keep age_band in step with the date of birth (children grow up)."""

        if not child.get("dob"):
            return child
        try:
            dob = parse_dob(child["dob"])
        except ValueError:
            return child
        if dob is None:
            return child
        age = age_in_years(dob)
        band = band_for_age(min(age, 12) if age > 12 else age)
        child["age"] = age
        if band != child.get("age_band"):
            self.execute("UPDATE children SET age_band = ? WHERE id = ?", (band, child["id"]))
            child["age_band"] = band
        return child

    def list_children(self, include_demo: bool = True) -> list[dict[str, Any]]:
        rows = self.query("SELECT * FROM children ORDER BY is_demo, id")
        rows = [self._sync_age_band(r) for r in rows]
        return rows if include_demo else [r for r in rows if not r.get("is_demo")]

    def get_child(self, child_id: int) -> dict[str, Any] | None:
        row = self.query_one("SELECT * FROM children WHERE id = ?", (child_id,))
        return self._sync_age_band(row) if row else None

    def delete_child(self, child_id: int) -> None:
        """Delete a child and (via ON DELETE CASCADE) every record tied to them."""

        self.execute("DELETE FROM children WHERE id = ?", (child_id,))

    def update_child(self, child_id: int, **fields: Any) -> None:
        allowed = {
            "nickname",
            "age_band",
            "languages",
            "voice_preset",
            "voice_engine",
            "voice_id",
            "voice_language",
            "voice_locale",
            "activities",
            "blocked_topics",
            "daily_minutes",
            "voice_enabled",
            "dob",
            "dob_exact",
            "is_demo",
            "avatar",
            "preferred_language",
            "story_mode_ok",
        }
        updates = {key: value for key, value in fields.items() if key in allowed}
        if not updates:
            return
        if "voice_enabled" in updates:
            updates["voice_enabled"] = int(bool(updates["voice_enabled"]))
        assignments = ", ".join(f"{key} = ?" for key in updates)
        self.execute(
            f"UPDATE children SET {assignments} WHERE id = ?",
            (*updates.values(), child_id),
        )

    def start_session(
        self, child_id: int, language: str, activity: str = "chat", purpose: str = "general"
    ) -> int:
        now = utcnow_iso()
        return self.execute(
            "INSERT INTO sessions (child_id, started_at, last_activity_at, language, activity, purpose) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (child_id, now, now, language, activity, purpose),
        )

    def increment_educational_turns(self, session_id: int) -> None:
        self.execute(
            "UPDATE sessions SET educational_turns = educational_turns + 1 WHERE id = ?",
            (session_id,),
        )

    def get_session(self, session_id: int) -> dict[str, Any] | None:
        return self.query_one("SELECT * FROM sessions WHERE id = ?", (session_id,))

    def touch_session(self, session_id: int, duration_seconds: int) -> None:
        self.execute(
            "UPDATE sessions SET last_activity_at = ?, duration_seconds = ? WHERE id = ?",
            (utcnow_iso(), max(0, duration_seconds), session_id),
        )

    def list_sessions(self, child_id: int | None = None) -> list[dict[str, Any]]:
        if child_id is None:
            return self.query("SELECT * FROM sessions ORDER BY started_at DESC")
        return self.query(
            "SELECT * FROM sessions WHERE child_id = ? ORDER BY started_at DESC",
            (child_id,),
        )

    def sessions_started_since(self, child_id: int, since_iso: str) -> list[dict[str, Any]]:
        return self.query(
            "SELECT * FROM sessions WHERE child_id = ? AND started_at >= ?",
            (child_id, since_iso),
        )

    def add_message(
        self,
        session_id: int,
        child_id: int,
        role: str,
        text: str,
        language: str,
        is_sample: bool = False,
    ) -> int:
        return self.execute(
            "INSERT INTO messages (session_id, child_id, role, text, language, is_sample) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (session_id, child_id, role, text, language, int(is_sample)),
        )

    def list_messages(self, session_id: int) -> list[dict[str, Any]]:
        return self.query(
            "SELECT * FROM messages WHERE session_id = ? ORDER BY id", (session_id,)
        )

    def add_event(
        self,
        child_id: int,
        event_type: str,
        category: str = "",
        detail: str = "",
        session_id: int | None = None,
        is_sample: bool = False,
    ) -> int:
        return self.execute(
            "INSERT INTO events (child_id, session_id, event_type, category, detail, is_sample) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (child_id, session_id, event_type, category, detail, int(is_sample)),
        )

    def list_events(self, child_id: int | None = None) -> list[dict[str, Any]]:
        if child_id is None:
            return self.query("SELECT * FROM events ORDER BY created_at DESC, id DESC")
        return self.query(
            "SELECT * FROM events WHERE child_id = ? ORDER BY created_at DESC, id DESC",
            (child_id,),
        )

    def delete_session(self, session_id: int) -> None:
        self.execute("DELETE FROM sessions WHERE id = ?", (session_id,))

    def delete_all_data(self) -> None:
        """Delete all user data in dependency order within one transaction."""
        tables = (
            "growth_records", "milestones", "reminders", "activities", "creations",
            "projects", "journal_entries",
            "companion_messages",
            "messages",
            "events",
            "safety_incidents",
            "infant_care",
            "infant_events",
            "sessions",
            "children",
            "settings",
        )  # remaining child tables are removed via ON DELETE CASCADE
        with closing(self.connect()) as connection:
            with connection:
                for table in tables:
                    connection.execute(f"DELETE FROM {table}")
