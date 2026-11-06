"""LLM adapters. External calls stay behind a small interface."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

import requests

from config import ProviderConfig
from services.errors import ServiceError

Message = dict[str, str]


class LLMAdapter:
    """Interface used by the chat pipeline."""

    available: bool = False

    def chat(
        self,
        messages: list[Message],
        *,
        model: str | None = None,
        temperature: float = 0.4,
        max_tokens: int = 300,
    ) -> str:
        raise NotImplementedError


def _endpoint(base_url: str, path: str) -> str:
    return f"{base_url.rstrip('/')}/{path.lstrip('/')}"


class OpenAICompatibleLLM(LLMAdapter):
    """Minimal OpenAI-compatible chat completions client."""

    def __init__(self, config: ProviderConfig, timeout: int = 45) -> None:
        self.config = config
        self.timeout = timeout

    @property
    def available(self) -> bool:
        return self.config.configured

    def chat(
        self,
        messages: list[Message],
        *,
        model: str | None = None,
        temperature: float = 0.4,
        max_tokens: int = 300,
    ) -> str:
        if not self.available:
            raise ServiceError("LLM provider is not configured")
        payload: dict[str, Any] = {
            "model": model or self.config.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        try:
            response = requests.post(
                _endpoint(self.config.base_url, "chat/completions"),
                headers={
                    "Authorization": f"Bearer {self.config.api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=self.timeout,
            )
        except requests.RequestException as exc:
            raise ServiceError(f"LLM request failed: {exc}") from exc
        if response.status_code >= 400:
            raise ServiceError(
                f"LLM request returned HTTP {response.status_code}: {response.text[:300]}"
            )
        try:
            body = response.json()
            content = body["choices"][0]["message"]["content"]
        except (ValueError, KeyError, IndexError, TypeError) as exc:
            raise ServiceError(f"Unexpected LLM response: {response.text[:300]}") from exc
        if not isinstance(content, str) or not content.strip():
            raise ServiceError("LLM returned an empty message")
        return content.strip()


class FallbackLLM(LLMAdapter):
    """Honest local fallback used when no LLM key is configured."""

    available = False

    def chat(
        self,
        messages: list[Message],
        *,
        model: str | None = None,
        temperature: float = 0.4,
        max_tokens: int = 300,
    ) -> str:
        return (
            "Mallow is in text-only demo mode because no AI provider key is configured. "
            "I can still listen, but a grown-up needs to add the AI settings before I can "
            "tell stories or answer questions. I am an AI helper, not a person."
        )


@dataclass
class MockLLM(LLMAdapter):
    """Deterministic adapter for tests."""

    responses: list[str] = field(default_factory=list)
    responder: Callable[[list[Message]], str] | None = None
    available: bool = True
    error: Exception | None = None
    calls: list[dict[str, Any]] = field(default_factory=list)

    def chat(
        self,
        messages: list[Message],
        *,
        model: str | None = None,
        temperature: float = 0.4,
        max_tokens: int = 300,
    ) -> str:
        self.calls.append(
            {
                "messages": messages,
                "model": model,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
        )
        if self.error is not None:
            raise self.error
        if self.responder is not None:
            return self.responder(messages)
        if self.responses:
            if len(self.responses) == 1:
                return self.responses[0]
            return self.responses.pop(0)
        return "That sounds fun. Tell me more."


def build_llm(config: ProviderConfig) -> LLMAdapter:
    """Return a configured adapter or the labelled fallback."""

    if config.configured:
        return OpenAICompatibleLLM(config)
    from services.offline_companion import OfflineCompanion

    return OfflineCompanion()
