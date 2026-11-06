from __future__ import annotations


def test_multiple_child_profiles_keep_independent_settings(db, controls) -> None:
    first = controls.list_children()[0]
    second_id = db.create_child(
        nickname="Second child",
        age_band="10-12",
        languages="English,Telugu",
        voice_preset="en-IN-NeerjaNeural",
        activities="stories,quizzes",
        daily_minutes=45,
        voice_enabled=False,
    )
    second = controls.get_child(second_id)
    refreshed_first = controls.get_child(int(first["id"]))

    assert second is not None and refreshed_first is not None
    assert len(controls.list_children()) == 2
    assert second["age_band"] == "10-12"
    assert second["daily_minutes"] == 45
    assert second["voice_enabled"] == 0
    assert refreshed_first["age_band"] == first["age_band"]
    assert refreshed_first["voice_enabled"] == first["voice_enabled"]
