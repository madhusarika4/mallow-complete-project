"""Environment-backed configuration for Mallow."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

DEFAULT_HELPLINE = (
    "If someone is hurting you or you feel unsafe, tell a trusted adult right now. "
    "In India you can call Childline at 1098."
)


@dataclass(frozen=True)
class ProviderConfig:
    """Connection settings for one OpenAI-compatible provider."""

    base_url: str
    api_key: str
    model: str

    @property
    def configured(self) -> bool:
        return bool(self.base_url and self.api_key and self.model)


@dataclass(frozen=True)
class AppConfig:
    """All runtime configuration. Keys are optional so the app always starts."""

    llm: ProviderConfig
    stt: ProviderConfig
    tts: ProviderConfig
    tts_voices: tuple[str, ...]
    moderation_model: str
    helpline_text: str
    db_path: Path
    piper_models_dir: Path = BASE_DIR / "models" / "piper"
    piper_binary: str = "piper"
    enable_online_voices: bool = True

    @property
    def llm_enabled(self) -> bool:
        return self.llm.configured

    @property
    def stt_enabled(self) -> bool:
        return self.stt.configured

    @property
    def tts_enabled(self) -> bool:
        return self.tts.configured and bool(self.tts_voices)

    @property
    def voice_enabled(self) -> bool:
        return self.stt_enabled and self.tts_enabled

    @property
    def moderation_enabled(self) -> bool:
        return self.llm_enabled and bool(self.moderation_model)


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def _provider(prefix: str) -> ProviderConfig:
    return ProviderConfig(
        base_url=_env(f"{prefix}_BASE_URL"),
        api_key=_env(f"{prefix}_API_KEY"),
        model=_env(f"{prefix}_MODEL"),
    )


def load_config() -> AppConfig:
    """Read configuration from the environment and .env file."""

    voices = tuple(v.strip() for v in _env("TTS_VOICES").split(",") if v.strip())
    db_value = _env("NANI_DB_PATH", "database/nani.db")
    db_path = Path(db_value)
    if not db_path.is_absolute():
        db_path = BASE_DIR / db_path
    piper_value = _env("PIPER_MODELS_DIR", "models/piper")
    piper_models_dir = Path(piper_value)
    if not piper_models_dir.is_absolute():
        piper_models_dir = BASE_DIR / piper_models_dir
    return AppConfig(
        llm=_provider("LLM"),
        stt=_provider("STT"),
        tts=_provider("TTS"),
        tts_voices=voices,
        moderation_model=_env("MODERATION_MODEL"),
        helpline_text=_env("CHILD_HELPLINE_TEXT", DEFAULT_HELPLINE) or DEFAULT_HELPLINE,
        db_path=db_path,
        piper_models_dir=piper_models_dir,
        piper_binary=_env("PIPER_BINARY", "piper") or "piper",
        enable_online_voices=_env("VOICE_ONLINE_ENABLED", "1").lower()
        not in {"0", "false", "no", "off"},
    )
