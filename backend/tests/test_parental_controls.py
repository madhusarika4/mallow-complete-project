from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from services.errors import VoiceDisabledError


def test_pin_is_hashed_and_verifies(controls) -> None:
    controls.set_pin("2468")
    stored = controls.db.get_setting("pin_hash")
    assert stored
    assert "2468" not in stored
    assert controls.verify_pin("2468") is True
    assert controls.verify_pin("0000") is False


def test_short_pin_rejected(controls) -> None:
    with pytest.raises(ValueError):
        controls.set_pin("12")


def test_session_limit_enforced(controls, child) -> None:
    controls.update_child(int(child["id"]), daily_minutes=1)
    child = controls.get_child(int(child["id"]))
    assert child is not None
    session_id = controls.start_session(int(child["id"]), "English")
    started = (datetime.now(timezone.utc) - timedelta(minutes=2)).isoformat(timespec="seconds")
    controls.db.execute("UPDATE sessions SET started_at = ? WHERE id = ?", (started, session_id))
    status = controls.check_time_limit(child, session_id)
    assert status.allowed is False
    assert status.limit_seconds == 60


def test_voice_off_backend_rejects(controls, child, chat) -> None:
    controls.update_child(int(child["id"]), voice_enabled=False)
    child = controls.get_child(int(child["id"]))
    assert child is not None
    assert controls.voice_allowed(child) is False
    with pytest.raises(VoiceDisabledError):
        controls.assert_voice_allowed(child)
    session_id = controls.start_session(int(child["id"]), "English")
    with pytest.raises(VoiceDisabledError):
        chat.transcribe(child, b"audio", "clip.wav", "English")
    with pytest.raises(VoiceDisabledError):
        chat.speak(child, "hello", "English")
    assert session_id > 0


def test_consent_roundtrip(controls) -> None:
    assert controls.has_consent() is False
    controls.accept_consent()
    assert controls.has_consent() is True


def test_delete_all_data(controls, child) -> None:
    controls.accept_consent()
    controls.set_pin("2468")
    controls.delete_all_data()
    assert controls.has_consent() is False
    assert controls.is_pin_set() is False
    assert controls.list_children() == []
