"""Shared service exceptions."""

from __future__ import annotations


class ServiceError(RuntimeError):
    """Raised when an external AI provider call fails."""


class VoiceDisabledError(PermissionError):
    """Raised when a backend voice request is made while voice is disabled."""


class TimeLimitError(PermissionError):
    """Raised when a child has no daily minutes left."""
