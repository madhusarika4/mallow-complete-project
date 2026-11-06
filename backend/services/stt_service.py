"""Speech-to-text adapters."""

from __future__ import annotations

from dataclasses import dataclass, field

import requests

from config import ProviderConfig
from services.errors import ServiceError
from services.languages import language_code


class STTAdapter:
    """Interface used by the voice loop and language smoke test."""

    available: bool = False

    def transcribe(self, audio: bytes, filename: str, language: str) -> str:
        raise NotImplementedError


def _endpoint(base_url: str, path: str) -> str:
    return f"{base_url.rstrip('/')}/{path.lstrip('/')}"


class OpenAICompatibleSTT(STTAdapter):
    """OpenAI-compatible /audio/transcriptions client."""

    def __init__(self, config: ProviderConfig, timeout: int = 60) -> None:
        self.config = config
        self.timeout = timeout

    @property
    def available(self) -> bool:
        return self.config.configured

    def transcribe(self, audio: bytes, filename: str, language: str) -> str:
        if not self.available:
            raise ServiceError("STT provider is not configured")
        if not audio:
            raise ServiceError("No audio received")
        try:
            response = requests.post(
                _endpoint(self.config.base_url, "audio/transcriptions"),
                headers={"Authorization": f"Bearer {self.config.api_key}"},
                data={
                    "model": self.config.model,
                    "language": language_code(language),
                },
                files={"file": (filename, audio, "application/octet-stream")},
                timeout=self.timeout,
            )
        except requests.RequestException as exc:
            raise ServiceError(f"STT request failed: {exc}") from exc
        if response.status_code >= 400:
            raise ServiceError(
                f"STT request returned HTTP {response.status_code}: {response.text[:300]}"
            )
        try:
            body = response.json()
            text = body.get("text", "")
        except ValueError as exc:
            raise ServiceError(f"Unexpected STT response: {response.text[:300]}") from exc
        if not isinstance(text, str) or not text.strip():
            raise ServiceError("STT returned an empty transcript")
        return text.strip()


@dataclass
class MockSTT(STTAdapter):
    """Deterministic adapter for tests."""

    text: str = "Tell me a story about a cat."
    available: bool = True
    error: Exception | None = None
    calls: list[tuple[str, str]] = field(default_factory=list)

    def transcribe(self, audio: bytes, filename: str, language: str) -> str:
        self.calls.append((filename, language))
        if self.error is not None:
            raise self.error
        return self.text


def build_stt(config: ProviderConfig) -> STTAdapter:
    """Return a configured adapter or an unavailable stub."""

    if config.configured:
        return OpenAICompatibleSTT(config)
    return OpenAICompatibleSTT(config)
