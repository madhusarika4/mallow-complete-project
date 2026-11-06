from __future__ import annotations

from services.age_policy import build_system_prompt


def test_child_voice_prompt_requests_calm_emotional_delivery() -> None:
    prompt = build_system_prompt("7-9", "English,Telugu,Hinglish")
    assert "calm, warm, emotionally attentive" in prompt
    assert "not sound hyper" in prompt
    assert "Match the emotional moment" in prompt


def test_infant_care_schema_has_tracking_fields(db) -> None:
    columns = {
        row["name"]
        for row in db.query("PRAGMA table_info(infant_care)")
    }
    assert {"amount_ml", "duration_minutes", "details"} <= columns
