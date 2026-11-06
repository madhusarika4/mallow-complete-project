from __future__ import annotations

from config import DEFAULT_HELPLINE
from services.chat_service import ChatService
from services.llm_service import FallbackLLM, MockLLM
from services.safety_service import SafetyService


def test_disclosure_path_logs_flag(chat, child) -> None:
    session_id = chat.controls.start_session(int(child["id"]), "English")
    result = chat.respond(child, "my uncle hits me", "English", session_id)
    assert result.is_disclosure is True
    assert DEFAULT_HELPLINE in result.reply
    events = chat.db.list_events(int(child["id"]))
    assert any(event["event_type"] == "serious_disclosure" for event in events)


def test_blocked_topic_logged(chat, child) -> None:
    chat.controls.update_child(int(child["id"]), blocked_topics="dinosaurs")
    child = chat.controls.get_child(int(child["id"]))
    assert child is not None
    session_id = chat.controls.start_session(int(child["id"]), "English")
    result = chat.respond(child, "tell me about dinosaurs", "English", session_id)
    assert result.blocked is True
    events = chat.db.list_events(int(child["id"]))
    assert any(event["event_type"] == "blocked_topic" for event in events)


def test_unsafe_model_output_is_replaced(chat, child, mocks) -> None:
    mocks["llm"].responses = ["What is your name?"]
    session_id = chat.controls.start_session(int(child["id"]), "English")
    result = chat.respond(child, "tell me a story", "English", session_id)
    assert result.blocked is True
    assert "What is your name?" not in result.reply
    events = chat.db.list_events(int(child["id"]))
    assert any(event["event_type"] == "safety_filter" for event in events)


def test_time_limit_refuses_chat(chat, child) -> None:
    chat.controls.update_child(int(child["id"]), daily_minutes=0)
    child = chat.controls.get_child(int(child["id"]))
    assert child is not None
    session_id = chat.controls.start_session(int(child["id"]), "English")
    result = chat.respond(child, "hello", "English", session_id)
    assert result.limit_reached is True
    assert result.blocked is True


def test_text_only_fallback_is_labelled(db, config, controls, safety) -> None:
    chat = ChatService(db, config, controls, FallbackLLM(), safety, None, None)  # type: ignore[arg-type]
    child = controls.list_children()[0]
    session_id = controls.start_session(int(child["id"]), "English")
    result = chat.respond(child, "hello", "English", session_id)
    assert result.fallback_mode is True
    assert "text-only demo mode" in result.reply


def test_input_fail_closed_is_logged(db, config, controls, child) -> None:
    broken = MockLLM(error=RuntimeError("moderation down"), available=True)
    safety = SafetyService(llm=broken, moderation_model="mod", helpline_text=DEFAULT_HELPLINE)
    chat = ChatService(db, config, controls, broken, safety, None, None)  # type: ignore[arg-type]
    session_id = controls.start_session(int(child["id"]), "English")
    result = chat.respond(child, "hello there", "English", session_id)
    assert result.safety_layer == "fail_closed"
    events = db.list_events(int(child["id"]))
    assert any(event["event_type"] == "moderation_error" for event in events)


def test_transcripts_are_stored_without_audio(chat, child, tmp_path) -> None:
    session_id = chat.controls.start_session(int(child["id"]), "English")
    chat.respond(child, "tell me a story", "English", session_id)
    messages = chat.db.list_messages(session_id)
    assert [message["role"] for message in messages] == ["child", "assistant"]
    audio_files = list(tmp_path.glob("*.wav")) + list(tmp_path.glob("*.mp3"))
    assert audio_files == []


def test_hinglish_voice_prompt_keeps_roman_script_and_asks_when_unclear(
    chat, child, mocks
) -> None:
    session_id = chat.controls.start_session(int(child["id"]), "Hinglish")

    chat.respond(child, "डू प्लस टीन कितना होता है?", "Hinglish", session_id, source="voice")

    llm = mocks["llm"]
    system_prompt = llm.calls[-1]["messages"][0]["content"]
    assert "natural conversational Hinglish" in system_prompt
    assert "Latin/Roman letters" in system_prompt
    assert "Do not switch to full Hindi or Devanagari" in system_prompt
    assert "ask a brief clarification instead of guessing" in system_prompt
