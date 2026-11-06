"""Versioned, repeatable SQLite migrations for Mallow.

Rules:
* Never drop or rewrite existing user rows.
* Every step is idempotent (checks before altering) and recorded in
  ``schema_migrations`` so it runs once.
* A one-time file backup is taken before the first new migration touches an
  existing database.
"""

from __future__ import annotations

import shutil
import sqlite3
from datetime import datetime
from pathlib import Path


def _columns(conn: sqlite3.Connection, table: str) -> set[str]:
    return {row[1] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}


def _add_column(conn: sqlite3.Connection, table: str, name: str, definition: str) -> None:
    if name not in _columns(conn, table):
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {name} {definition}")


def _m1_children_profile(conn: sqlite3.Connection) -> None:
    _add_column(conn, "children", "dob", "TEXT")
    _add_column(conn, "children", "dob_exact", "INTEGER NOT NULL DEFAULT 0")
    _add_column(conn, "children", "is_demo", "INTEGER NOT NULL DEFAULT 0")
    _add_column(conn, "children", "avatar", "TEXT NOT NULL DEFAULT ''")
    _add_column(conn, "children", "preferred_language", "TEXT NOT NULL DEFAULT ''")
    _add_column(conn, "children", "story_mode_ok", "INTEGER NOT NULL DEFAULT 1")


def _m2_infant_columns(conn: sqlite3.Connection) -> None:
    _add_column(conn, "infant_care", "subtype", "TEXT NOT NULL DEFAULT ''")
    _add_column(conn, "infant_care", "end_timestamp", "TEXT")
    _add_column(conn, "infant_care", "is_sample", "INTEGER NOT NULL DEFAULT 0")
    # Backfill subtype from the legacy "Type · note" details prefix.
    rows = conn.execute(
        "SELECT id, event_type, details FROM infant_care WHERE subtype = ''"
    ).fetchall()
    known = {
        "feeding": {"bottle", "breastfeeding", "solids", "other"},
        "diaper": {"wet", "dirty", "both", "other"},
    }
    for row in rows:
        kind = row[1]
        if kind not in known:
            continue
        prefix = (row[2] or "").split("·")[0].strip().lower()
        if prefix in known[kind]:
            conn.execute(
                "UPDATE infant_care SET subtype = ? WHERE id = ?", (prefix, row[0])
            )


def _m3_new_tables(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS growth_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            child_id INTEGER NOT NULL,
            measured_on TEXT NOT NULL,
            weight_kg REAL,
            length_cm REAL,
            head_cm REAL,
            note TEXT NOT NULL DEFAULT '',
            is_sample INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (child_id) REFERENCES children (id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS milestones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            child_id INTEGER NOT NULL,
            achieved_on TEXT NOT NULL,
            title TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT 'other',
            note TEXT NOT NULL DEFAULT '',
            is_sample INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (child_id) REFERENCES children (id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS reminders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            child_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            due_at TEXT NOT NULL,
            repeat TEXT NOT NULL DEFAULT 'none',
            done INTEGER NOT NULL DEFAULT 0,
            is_sample INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (child_id) REFERENCES children (id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            child_id INTEGER NOT NULL,
            session_id INTEGER,
            kind TEXT NOT NULL,
            title TEXT NOT NULL DEFAULT '',
            detail TEXT NOT NULL DEFAULT '',
            score INTEGER,
            max_score INTEGER,
            duration_seconds INTEGER NOT NULL DEFAULT 0,
            language TEXT NOT NULL DEFAULT 'English',
            is_sample INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (child_id) REFERENCES children (id) ON DELETE CASCADE,
            FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE SET NULL
        );
        CREATE TABLE IF NOT EXISTS creations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            child_id INTEGER NOT NULL,
            kind TEXT NOT NULL,
            title TEXT NOT NULL DEFAULT '',
            content TEXT NOT NULL DEFAULT '',
            is_sample INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (child_id) REFERENCES children (id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            child_id INTEGER NOT NULL,
            kind TEXT NOT NULL DEFAULT 'project',
            title TEXT NOT NULL,
            goal TEXT NOT NULL DEFAULT '',
            due_on TEXT,
            steps_json TEXT NOT NULL DEFAULT '[]',
            status TEXT NOT NULL DEFAULT 'active',
            is_sample INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (child_id) REFERENCES children (id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS journal_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            child_id INTEGER NOT NULL,
            text TEXT NOT NULL,
            mood TEXT NOT NULL DEFAULT '',
            is_sample INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (child_id) REFERENCES children (id) ON DELETE CASCADE
        );
        """
    )


def _m4_safety_columns(conn: sqlite3.Connection) -> None:
    _add_column(conn, "safety_incidents", "severity", "TEXT NOT NULL DEFAULT 'info'")
    _add_column(conn, "safety_incidents", "message_id", "INTEGER")
    _add_column(conn, "safety_incidents", "reviewed_at", "TEXT")
    _add_column(conn, "safety_incidents", "parent_note", "TEXT NOT NULL DEFAULT ''")
    _add_column(conn, "safety_incidents", "language", "TEXT NOT NULL DEFAULT ''")
    _add_column(conn, "safety_incidents", "is_sample", "INTEGER NOT NULL DEFAULT 0")
    _add_column(conn, "messages", "emotion", "TEXT NOT NULL DEFAULT ''")


def _m5_indexes(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE INDEX IF NOT EXISTS idx_messages_child ON messages (child_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_infant_child ON infant_care (child_id, event_type, timestamp);
        CREATE INDEX IF NOT EXISTS idx_growth_child ON growth_records (child_id, measured_on);
        CREATE INDEX IF NOT EXISTS idx_milestones_child ON milestones (child_id, achieved_on);
        CREATE INDEX IF NOT EXISTS idx_reminders_child ON reminders (child_id, due_at);
        CREATE INDEX IF NOT EXISTS idx_activities_child ON activities (child_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_creations_child ON creations (child_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_projects_child ON projects (child_id, status);
        CREATE INDEX IF NOT EXISTS idx_journal_child ON journal_entries (child_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_incidents_child ON safety_incidents (child_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_children_demo ON children (is_demo);
        """
    )


def _m7_safety_notifications(conn: sqlite3.Connection) -> None:
    """Record whether a high-severity incident reached the trusted adult."""

    _add_column(
        conn,
        "safety_incidents",
        "notification_status",
        "TEXT NOT NULL DEFAULT 'not_required'",
    )
    _add_column(conn, "safety_incidents", "notification_channel", "TEXT NOT NULL DEFAULT ''")
    _add_column(conn, "safety_incidents", "notification_recipient", "TEXT NOT NULL DEFAULT ''")
    _add_column(conn, "safety_incidents", "notification_attempted_at", "TEXT")
    _add_column(conn, "safety_incidents", "notification_delivered_at", "TEXT")
    _add_column(conn, "safety_incidents", "notification_error", "TEXT NOT NULL DEFAULT ''")
    # Older high-severity rows predate delivery tracking. Label them honestly
    # instead of presenting them as successfully notified.
    conn.execute(
        "UPDATE safety_incidents SET notification_status = 'not_attempted' "
        "WHERE severity = 'high' AND notification_status = 'not_required'"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_incidents_notification "
        "ON safety_incidents (notification_status, severity, reviewed_at)"
    )


def _m8_dashboard_only_is_not_delivery(conn: sqlite3.Connection) -> None:
    """Correct prior rows where dashboard visibility was mislabeled as delivery."""
    conn.execute(
        "UPDATE safety_incidents SET notification_status = 'dashboard_only', "
        "notification_delivered_at = NULL, notification_error = "
        "'No external trusted-adult notification provider is configured.' "
        "WHERE notification_channel = 'parent_dashboard' "
        "AND notification_status = 'delivered'"
    )


def _m9_educational_sessions(conn: sqlite3.Connection) -> None:
    _add_column(conn, "sessions", "purpose", "TEXT NOT NULL DEFAULT 'general'")
    _add_column(conn, "sessions", "educational_turns", "INTEGER NOT NULL DEFAULT 0")
    # Preserve historical learning chats as learning usage in the new dashboard.
    conn.execute(
        "UPDATE sessions SET purpose = 'educational', educational_turns = "
        "(SELECT COUNT(*) FROM messages WHERE messages.session_id = sessions.id AND messages.role = 'child') "
        "WHERE activity IN ('study', 'homework', 'explain')"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_sessions_child_purpose "
        "ON sessions (child_id, purpose, started_at)"
    )


def _m10_repair_educational_session_schema(conn: sqlite3.Connection) -> None:
    """Repair databases where schema.sql ran before migration 9 could add columns.

    Keep this as a separate version so databases that already recorded migration 9
    still receive a safe, idempotent check for both columns and the dependent index.
    """
    _add_column(conn, "sessions", "purpose", "TEXT NOT NULL DEFAULT 'general'")
    _add_column(conn, "sessions", "educational_turns", "INTEGER NOT NULL DEFAULT 0")
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_sessions_child_purpose "
        "ON sessions (child_id, purpose, started_at)"
    )


def _m6_companion_messages(conn: sqlite3.Connection) -> None:
    """Private parent and infant-care companion conversations.

    ``audience`` is 'parent' or 'infant'. ``child_id`` scopes infant
    conversations to one baby so information is never mixed between profiles.
    """

    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS companion_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            audience TEXT NOT NULL,
            child_id INTEGER,
            role TEXT NOT NULL,
            text TEXT NOT NULL,
            language TEXT NOT NULL DEFAULT 'English',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (child_id) REFERENCES children (id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_companion_audience
            ON companion_messages (audience, child_id, id);
        """
    )


MIGRATIONS = (
    (1, "children profile columns", _m1_children_profile),
    (2, "infant care columns", _m2_infant_columns),
    (3, "growth, milestones, reminders, activities, creations, projects, journal", _m3_new_tables),
    (4, "safety incident review columns", _m4_safety_columns),
    (5, "indexes", _m5_indexes),
    (6, "parent and infant companion messages", _m6_companion_messages),
    (7, "safety incident trusted-adult notification state", _m7_safety_notifications),
    (8, "dashboard visibility is not notification delivery", _m8_dashboard_only_is_not_delivery),
    (9, "educational conversation purpose", _m9_educational_sessions),
    (10, "repair educational session schema ordering", _m10_repair_educational_session_schema),
)
LATEST_VERSION = MIGRATIONS[-1][0]


def backup_existing_database(
    conn: sqlite3.Connection,
    db_path: Path | None,
    *,
    has_user_data: bool,
    migration_pending: bool,
) -> bool:
    """Back up an existing populated database before schema.sql can alter it."""
    if (
        not has_user_data
        or not migration_pending
        or db_path is None
        or not Path(db_path).is_file()
    ):
        return False
    backup = Path(f"{db_path}.pre-migration-{datetime.now():%Y%m%d-%H%M%S-%f}.bak")
    target = sqlite3.connect(backup)
    try:
        conn.backup(target)
    finally:
        target.close()
    return True


def run_migrations(
    conn: sqlite3.Connection,
    db_path: Path | None = None,
    *,
    backup_created: bool = False,
) -> list[int]:
    """Apply pending migrations. Returns the versions applied."""

    conn.execute(
        "CREATE TABLE IF NOT EXISTS schema_migrations ("
        "version INTEGER PRIMARY KEY, name TEXT NOT NULL, "
        "applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
    )
    done = {row[0] for row in conn.execute("SELECT version FROM schema_migrations")}
    pending = [m for m in MIGRATIONS if m[0] not in done]
    if not pending:
        return []
    has_user_data = bool(
        conn.execute("SELECT 1 FROM children LIMIT 1").fetchone()
        or conn.execute("SELECT 1 FROM settings LIMIT 1").fetchone()
    )
    if has_user_data and db_path and Path(db_path).exists() and not backup_created:
        backup = Path(f"{db_path}.pre-migration-{datetime.now():%Y%m%d-%H%M%S-%f}.bak")
        conn.commit()
        shutil.copy2(db_path, backup)
    applied: list[int] = []
    for version, name, fn in pending:
        fn(conn)
        conn.execute(
            "INSERT INTO schema_migrations (version, name) VALUES (?, ?)", (version, name)
        )
        conn.commit()
        applied.append(version)
    return applied
