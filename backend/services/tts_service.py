"""Text-to-speech adapters."""

from __future__ import annotations

from dataclasses import dataclass, field

import requests

from config import ProviderConfig
from services.errors import ServiceError
from services.languages import language_code


@dataclass(frozen=True)
class SpeechAudio:
    """Generated audio kept in memory only."""

    data: bytes
    mime_type: str = "audio/mpeg"


class TTSAdapter:
    """Interface used by the voice loop and language smoke test."""

    available: bool = False
    voices: tuple[str, ...] = ()

    def synthesize(self, text: str, language: str, voice: str | None = None) -> SpeechAudio:
        raise NotImplementedError


def _endpoint(base_url: str, path: str) -> str:
    return f"{base_url.rstrip('/')}/{path.lstrip('/')}"


class OpenAICompatibleTTS(TTSAdapter):
    """OpenAI-compatible /audio/speech client."""

    def __init__(
        self,
        config: ProviderConfig,
        voices: tuple[str, ...],
        timeout: int = 60,
    ) -> None:
        self.config = config
        self.voices = voices
        self.timeout = timeout

    @property
    def available(self) -> bool:
        return self.config.configured and bool(self.voices)

    def synthesize(self, text: str, language: str, voice: str | None = None) -> SpeechAudio:
        if not self.available:
            raise ServiceError("TTS provider is not configured")
        if not text.strip():
            raise ServiceError("No text to speak")
        selected_voice = voice if voice in self.voices else self.voices[0]
        payload = {
            "model": self.config.model,
            "input": text,
            "voice": selected_voice,
        }
        try:
            response = requests.post(
                _endpoint(self.config.base_url, "audio/speech"),
                headers={
                    "Authorization": f"Bearer {self.config.api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=self.timeout,
            )
        except requests.RequestException as exc:
            raise ServiceError(f"TTS request failed: {exc}") from exc
        if response.status_code >= 400:
            raise ServiceError(
                f"TTS request returned HTTP {response.status_code}: {response.text[:300]}"
            )
        if not response.content:
            raise ServiceError("TTS returned empty audio")
        mime = response.headers.get("Content-Type", "audio/mpeg").split(";")[0]
        return SpeechAudio(data=response.content, mime_type=mime or "audio/mpeg")


@dataclass
class MockTTS(TTSAdapter):
    """Deterministic adapter for tests."""

    voices: tuple[str, ...] = ("test-voice",)
    available: bool = True
    audio: bytes = b"ID3-mock-audio"
    error: Exception | None = None
    calls: list[tuple[str, str, str | None]] = field(default_factory=list)

    def synthesize(self, text: str, language: str, voice: str | None = None) -> SpeechAudio:
        self.calls.append((text, language, voice))
        if self.error is not None:
            raise self.error
        return SpeechAudio(data=self.audio)


def build_tts(config: ProviderConfig, voices: tuple[str, ...]) -> TTSAdapter:
    """Return a configured adapter or an unavailable stub."""

    return OpenAICompatibleTTS(config, voices)
