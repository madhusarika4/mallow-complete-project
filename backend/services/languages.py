"""Supported language labels and provider language codes."""

from __future__ import annotations

LANGUAGE_CODES: dict[str, str] = {
    "English": "en",
    "Telugu": "te",
    "Hinglish": "hi",
}

DEFAULT_LANGUAGES = tuple(LANGUAGE_CODES)


def language_code(label: str) -> str:
    """Map a friendly language label to a provider language code."""

    return LANGUAGE_CODES.get(label, label.lower() or "en")


def parse_languages(value: str) -> list[str]:
    """Parse a comma-separated language setting."""

    languages = [item.strip() for item in value.split(",") if item.strip()]
    return languages or ["English"]
