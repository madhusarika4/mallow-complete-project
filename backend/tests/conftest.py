from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from config import AppConfig, ProviderConfig, DEFAULT_HELPLINE
from database.db import Database
from services.chat_service import ChatService
from services.llm_service import MockLLM
from services.parental_controls import ParentalControls
from services.safety_service import SafetyService
from services.stt_service import MockSTT
from services.tts_service import MockTTS


@pytest.fixture
def config(tmp_path: Path) -> AppConfig:
    return AppConfig(
        llm=ProviderConfig("", "", ""),
        stt=ProviderConfig("", "", ""),
        tts=ProviderConfig("", "", ""),
        tts_voices=("test-voice",),
        moderation_model="",
        helpline_text=DEFAULT_HELPLINE,
        db_path=tmp_path / "test.db",
    )


@pytest.fixture
def db(config: AppConfig) -> Database:
    return Database(config.db_path)


@pytest.fixture
def controls(db: Database, config: AppConfig) -> ParentalControls:
    controls = ParentalControls(db, config)
    controls.ensure_default_child()
    return controls


@pytest.fixture
def child(controls: ParentalControls) -> dict:
    return controls.list_children()[0]


@pytest.fixture
def safety() -> SafetyService:
    return SafetyService(llm=None, moderation_model="", helpline_text=DEFAULT_HELPLINE)


@pytest.fixture
def mocks() -> dict[str, object]:
    return {
        "llm": MockLLM(responses=["That sounds fun. Tell me more."]),
        "stt": MockSTT(),
        "tts": MockTTS(),
    }


@pytest.fixture
def chat(
    db: Database,
    config: AppConfig,
    controls: ParentalControls,
    safety: SafetyService,
    mocks: dict[str, object],
) -> ChatService:
    return ChatService(
        db,
        config,
        controls,
        mocks["llm"],  # type: ignore[arg-type]
        safety,
        mocks["stt"],  # type: ignore[arg-type]
        mocks["tts"],  # type: ignore[arg-type]
    )
