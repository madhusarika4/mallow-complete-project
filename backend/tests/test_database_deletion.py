from __future__ import annotations


def test_delete_all_data_clears_new_and_existing_tables(db, child) -> None:
    child_id = int(child["id"])
    session_id = db.start_session(child_id, "English")
    db.add_message(session_id, child_id, "user", "hello", "English")
    db.add_event(child_id, "test", detail="sample")
    db.execute(
        "INSERT INTO safety_incidents (child_id, session_id, category, detail) "
        "VALUES (?, ?, ?, ?)",
        (child_id, session_id, "test", "minimal test detail"),
    )
    db.execute(
        "INSERT INTO infant_care (child_id, event_type, note) VALUES (?, ?, ?)",
        (child_id, "feeding", "test"),
    )
    db.execute("INSERT INTO infant_events (event_type, note) VALUES (?, ?)", ("sleep", "test"))
    db.set_setting("test_setting", "value")

    db.delete_all_data()

    for table in (
        "messages", "events", "safety_incidents", "infant_care",
        "infant_events", "sessions", "children", "settings",
    ):
        assert db.query_one(f"SELECT COUNT(*) AS count FROM {table}")["count"] == 0
