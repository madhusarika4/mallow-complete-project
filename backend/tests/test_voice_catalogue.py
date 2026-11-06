from __future__ import annotations

import sqlite3
from dataclasses import replace
from pathlib import Path

import pytest

from config import AppConfig
from database.db import Database
from services.chat_service import ChatService
from services.errors import ServiceError
from services.tts_service import MockTTS, SpeechAudio
from services.voice_catalogue import (
    ENGINE_PROVIDER,
    NEEDS_CONFIG,
    NEEDS_DOWNLOAD,
    READY,
    EdgeTTSEngine,
    PiperEngine,
    ProviderVoiceEngine,
    VoiceCatalogue,
    VoiceEngine,
    VoiceEntry,
    build_voice_catalogue,
)
from services.voice_service import VoiceService


def _entry(
    *,
    engine: str = "fake",
    voice_id: str = "voice",
    language: str = "English",
    locale: str = "en-IN",
    display_name: str = "Test Voice",
    availability: str = READY,
    online: str = "offline",
    multilingual: bool = False,
) -> VoiceEntry:
    return VoiceEntry(
        engine=engine,
        voice_id=voice_id,
        display_name=display_name,
        language=language,
        locale=locale,
        accent="India",
        gender="Unspecified",
        online_or_offline=online,
        installed_status="installed",
        model_license="test",
        availability_status=availability,
        engine_label="Fake engine",
        multilingual=multilingual,
    )


class FakeEngine(VoiceEngine):
    name = "fake"
    label = "Fake engine"

    def __init__(self, entries: list[VoiceEntry], failing: set[str] | None = None) -> None:
        self._entries = entries
        self.failing = failing or set()
        self.calls: list[str] = []

    def entries(self) -> list[VoiceEntry]:
        return list(self._entries)

    def synthesize(self, text: str, voice_id: str, language: str) -> SpeechAudio:
        self.calls.append(voice_id)
        known = {entry.voice_id for entry in self._entries}
        if voice_id in self.failing or voice_id not in known:
            raise ServiceError("synthetic engine failure")
        return SpeechAudio(data=b"ID3-fake-audio", mime_type="audio/mpeg")


def _child(**fields: object) -> dict:
    child = {
        "id": 1,
        "nickname": "Child",
        "age_band": "7-9",
        "languages": "English",
        "voice_engine": "fake",
        "voice_id": "voice",
        "voice_language": "English",
        "voice_locale": "en-IN",
        "activities": "",
        "blocked_topics": "",
        "daily_minutes": 30,
        "voice_enabled": 1,
    }
    child.update(fields)
    return child


def test_edge_snapshot_has_expected_fields_and_languages() -> None:
    entries = EdgeTTSEngine().entries()
    assert len(entries) > 300
    assert all(entry.engine == "edge" for entry in entries)
    assert all(entry.online_or_offline == "online" for entry in entries)
    assert all(entry.availability_status == READY for entry in entries)
    languages = {entry.language for entry in entries}
    assert {"English", "Telugu", "Hindi"} <= languages
    assert any(entry.locale == "te-IN" for entry in entries)
    assert any(entry.locale == "en-AU" for entry in entries)
    assert any(entry.multilingual for entry in entries)


def test_default_voice_for_each_child_language() -> None:
    catalogue = VoiceCatalogue([EdgeTTSEngine()])
    expected = {
        "English": "en-US-AvaMultilingualNeural",
        "Telugu": "te-IN-ShrutiNeural",
        "Hinglish": "hi-IN-SwaraNeural",
    }
    for language, voice_id in expected.items():
        selection = catalogue.default_selection(language)
        assert selection.engine == "edge"
        assert selection.voice_id == voice_id


def test_hinglish_offers_indian_and_multilingual_voices_only() -> None:
    catalogue = VoiceCatalogue([EdgeTTSEngine()])
    entries = catalogue.compatible_entries("Hinglish")
    assert entries
    assert all(
        (entry.language in {"Hindi", "English"} and entry.locale.endswith("-IN"))
        or entry.multilingual
        for entry in entries
    )
    assert not any(
        entry.locale == "en-US" and not entry.multilingual for entry in entries
    )


def test_fallback_is_same_language_and_explained() -> None:
    engine = FakeEngine([_entry(voice_id="en-good", display_name="Good Voice")])
    service = VoiceService(VoiceCatalogue([engine]))
    child = _child(voice_id="en-missing", voice_language="English")
    speech = service.speak(child, "hello", "English")
    assert speech.voice_id == "en-good"
    assert speech.fallback_used is True
    assert speech.notice is not None
    assert "same language" in speech.notice
    assert engine.calls == ["en-missing", "en-good"]


def test_no_cross_language_fallback() -> None:
    engine = FakeEngine([_entry(voice_id="en-good", language="English")])
    service = VoiceService(VoiceCatalogue([engine]))
    child = _child(voice_id="te-missing", voice_language="Telugu")
    with pytest.raises(ServiceError):
        service.speak(child, "hello", "Telugu")
    assert engine.calls == ["te-missing"]
    assert "en-good" not in engine.calls


def test_saved_voice_for_other_language_gets_explicit_notice() -> None:
    catalogue = VoiceCatalogue([EdgeTTSEngine()])
    service = VoiceService(catalogue)
    child = _child(
        voice_engine="edge",
        voice_id="en-IN-NeerjaNeural",
        voice_language="English",
    )
    selection, notice = service.selection_for(child, "Telugu")
    assert selection.voice_id == "te-IN-ShrutiNeural"
    assert notice is not None
    assert "never silently changes" in notice


def test_piper_manifest_and_local_scan(tmp_path: Path) -> None:
    models = tmp_path / "piper"
    models.mkdir()
    engine = PiperEngine(models, binary="definitely-not-piper")
    entries = {entry.voice_id: entry for entry in engine.entries()}
    assert entries["hi_IN-pratham-medium"].availability_status == NEEDS_DOWNLOAD
    assert entries["hi_IN-pratham-medium"].installed_status == "not_installed"
    assert entries["hi_IN-pratham-medium"].model_license.startswith("CC BY-NC-SA")

    model = models / "te_IN-padmavathi-medium.onnx"
    model.write_bytes(b"fake")
    Path(f"{model}.json").write_text("{}", encoding="utf-8")
    entries = {entry.voice_id: entry for entry in engine.entries()}
    assert entries["te_IN-padmavathi-medium"].availability_status == READY
    assert entries["te_IN-padmavathi-medium"].installed_status == "installed"


def test_piper_reports_missing_model_and_binary(tmp_path: Path) -> None:
    models = tmp_path / "piper"
    models.mkdir()
    engine = PiperEngine(models, binary="definitely-not-piper")
    with pytest.raises(ServiceError, match="not downloaded"):
        engine.synthesize("hello", "te_IN-padmavathi-medium", "Telugu")

    (models / "te_IN-padmavathi-medium.onnx").write_bytes(b"fake")
    with pytest.raises(ServiceError, match="not installed"):
        engine.synthesize("hello", "te_IN-padmavathi-medium", "Telugu")


def test_online_voices_can_be_disabled(config: AppConfig) -> None:
    catalogue = build_voice_catalogue(
        replace(config, enable_online_voices=False), MockTTS(available=False, voices=())
    )
    assert "edge" not in catalogue.engines
    assert "piper" in catalogue.engines
    assert "provider" in catalogue.engines


def test_provider_any_voice_is_not_an_automatic_fallback() -> None:
    adapter = MockTTS(voices=("provider-voice",))
    catalogue = VoiceCatalogue([ProviderVoiceEngine(adapter)])
    service = VoiceService(catalogue)
    child = _child(voice_engine="fake", voice_id="missing", voice_language="English")
    with pytest.raises(ServiceError):
        service.speak(child, "hello", "English")
    assert adapter.calls == []


def test_provider_engine_reports_configuration_status() -> None:
    adapter = MockTTS(available=False, voices=("provider-voice",))
    entries = ProviderVoiceEngine(adapter).entries()
    assert len(entries) == 1
    assert entries[0].engine == ENGINE_PROVIDER
    assert entries[0].availability_status == NEEDS_CONFIG
    assert entries[0].language == "Any"


def test_chat_speak_uses_catalogue_and_keeps_audio_in_memory(
    tmp_path: Path, config: AppConfig
) -> None:
    db = Database(tmp_path / "voice.db")
    engine = FakeEngine([_entry(voice_id="voice")])
    service = VoiceService(VoiceCatalogue([engine]))
    chat = ChatService(
        db,
        config,
        controls=type("Controls", (), {"assert_voice_allowed": lambda self, child: None})(),
        llm=None,
        safety=None,
        stt=None,
        tts=None,
        voice_service=service,
    )
    speech = chat.speak(_child(), "hello", "English")
    assert speech.data == b"ID3-fake-audio"
    assert not list(tmp_path.glob("*.mp3"))
    assert not list(tmp_path.glob("*.wav"))


def test_database_migrates_old_children_table(tmp_path: Path) -> None:
    path = tmp_path / "old.db"
    with sqlite3.connect(path) as connection:
        connection.execute(
            "CREATE TABLE children ("
            "id INTEGER PRIMARY KEY AUTOINCREMENT, nickname TEXT NOT NULL, "
            "age_band TEXT NOT NULL, languages TEXT NOT NULL, voice_preset TEXT NOT NULL, "
            "activities TEXT NOT NULL, blocked_topics TEXT NOT NULL DEFAULT '', "
            "daily_minutes INTEGER NOT NULL DEFAULT 30, "
            "voice_enabled INTEGER NOT NULL DEFAULT 1, "
            "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
        )
        connection.execute(
            "INSERT INTO children (nickname, age_band, languages, voice_preset, activities) "
            "VALUES ('Old', '7-9', 'English', 'legacy', 'stories')"
        )
        connection.commit()

    db = Database(path)
    columns = {
        row["name"] for row in db.query("PRAGMA table_info(children)")
    }
    assert {"voice_engine", "voice_id", "voice_language", "voice_locale"} <= columns
    child = db.list_children()[0]
    assert child["voice_id"] == ""
    db.update_child(int(child["id"]), voice_engine="edge", voice_id="en-IN-NeerjaNeural")
    assert db.get_child(int(child["id"]))["voice_id"] == "en-IN-NeerjaNeural"
