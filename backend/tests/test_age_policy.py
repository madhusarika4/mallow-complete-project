from __future__ import annotations

from services.age_policy import BANDS, build_system_prompt, get_policy, limit_reply


def test_bands_change_prompt_and_caps() -> None:
    prompts = {
        band: build_system_prompt(band, "English", "stories", "dinosaurs", "HELPLINE")
        for band in BANDS
    }
    assert len(set(prompts.values())) == 3
    for band, prompt in prompts.items():
        assert band in prompt or BANDS[band].age_range in prompt
        assert str(BANDS[band].max_words) in prompt
    assert BANDS["4-6"].max_words < BANDS["7-9"].max_words < BANDS["10-12"].max_words
    assert BANDS["4-6"].max_sentences < BANDS["10-12"].max_sentences


def test_unknown_band_falls_back() -> None:
    assert get_policy("99").key == "7-9"


def test_limit_reply_enforces_words_and_sentences() -> None:
    long_text = " ".join(["word"] * 500)
    result = limit_reply(long_text, "4-6")
    assert len(result.split()) <= BANDS["4-6"].max_words
    assert result.endswith(".")


def test_limit_reply_keeps_short_text() -> None:
    assert limit_reply("A tiny story about a cat.", "7-9") == "A tiny story about a cat."


def test_chat_pipeline_uses_band_limit(chat, child, mocks) -> None:
    child = dict(child)
    child["age_band"] = "4-6"
    mocks["llm"].responses = ["This is a very long story. " * 60]
    session_id = chat.controls.start_session(int(child["id"]), "English")
    result = chat.respond(child, "Tell me a story", "English", session_id)
    assert len(result.reply.split()) <= BANDS["4-6"].max_words
    system_prompt = mocks["llm"].calls[0]["messages"][0]["content"]
    assert "4-6" in system_prompt
