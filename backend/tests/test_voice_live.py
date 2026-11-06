"""Opt-in real Edge TTS checks. Run with NANI_RUN_LIVE_TTS=1."""

from __future__ import annotations

import os

import pytest

from services.voice_catalogue import EdgeTTSEngine

LIVE = os.getenv("NANI_RUN_LIVE_TTS") == "1"

pytestmark = pytest.mark.skipif(
    not LIVE, reason="Set NANI_RUN_LIVE_TTS=1 to make real Edge TTS calls"
)


@pytest.mark.parametrize(
    "voice_id,text",
    [
        ("en-IN-NeerjaNeural", "Hello, I am Mallow. This is an English voice test."),
        ("te-IN-ShrutiNeural", "నమస్తే, నేను నానీ. ఇది తెలుగు వాయిస్ పరీక్ష."),
        ("hi-IN-SwaraNeural", "नमस्ते, मैं नानी हूँ। यह हिंदी आवाज़ का परीक्षण है।"),
        (
            "te-IN-ShrutiNeural",
            "నమస్తే, ఇది Telugu మరియు English mixed sentence.",
        ),
        (
            "hi-IN-SwaraNeural",
            "Namaste, yeh Hinglish mixed sentence hai.",
        ),
    ],
)
def test_edge_synthesizes_audio(voice_id: str, text: str) -> None:
    audio = EdgeTTSEngine().synthesize(text, voice_id, "test")
    assert len(audio.data) > 1_000
    assert audio.mime_type == "audio/mpeg"
    assert audio.data[:2] in {b"\xff\xf3", b"\xff\xfb", b"ID"}
