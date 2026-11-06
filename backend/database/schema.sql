PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS children (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nickname TEXT NOT NULL,
    age_band TEXT NOT NULL,
    languages TEXT NOT NULL,
    voice_preset TEXT NOT NULL,
    voice_engine TEXT NOT NULL DEFAULT '',
    voice_id TEXT NOT NULL DEFAULT '',
    voice_language TEXT NOT NULL DEFAULT '',
    voice_locale TEXT NOT NULL DEFAULT '',
    activities TEXT NOT NULL,
    blocked_topics TEXT NOT NULL DEFAULT '',
    daily_minutes INTEGER NOT NULL DEFAULT 30,
    voice_enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    child_id INTEGER NOT NULL,
    started_at TEXT NOT NULL,
    last_activity_at TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    language TEXT NOT NULL,
    activity TEXT NOT NULL DEFAULT 'chat',
    purpose TEXT NOT NULL DEFAULT 'general',
    educational_turns INTEGER NOT NULL DEFAULT 0,
    summary TEXT,
    is_sample INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (child_id) REFERENCES children (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    child_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    text TEXT NOT NULL,
    language TEXT NOT NULL,
    is_sample INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE,
    FOREIGN KEY (child_id) REFERENCES children (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    child_id INTEGER NOT NULL,
    session_id INTEGER,
    event_type TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT '',
    detail TEXT NOT NULL DEFAULT '',
    is_sample INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (child_id) REFERENCES children (id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS infant_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table for safety incident logs (separate from generic events)
CREATE TABLE IF NOT EXISTS safety_incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    child_id INTEGER NOT NULL,
    session_id INTEGER,
    category TEXT NOT NULL DEFAULT '',
    detail TEXT NOT NULL DEFAULT '',
    notification_status TEXT NOT NULL DEFAULT 'not_required',
    notification_channel TEXT NOT NULL DEFAULT '',
    notification_recipient TEXT NOT NULL DEFAULT '',
    notification_attempted_at TEXT,
    notification_delivered_at TEXT,
    notification_error TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (child_id) REFERENCES children (id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE SET NULL
);

-- Table for infant‑care logs (feeding, sleep, diaper)
CREATE TABLE IF NOT EXISTS infant_care (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    child_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,           -- feeding | sleep | diaper
    timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    note TEXT NOT NULL DEFAULT '',
    amount_ml INTEGER,
    duration_minutes INTEGER,
    details TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (child_id) REFERENCES children (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_child ON sessions (child_id, started_at);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages (session_id);
CREATE INDEX IF NOT EXISTS idx_events_child ON events (child_id, created_at);
