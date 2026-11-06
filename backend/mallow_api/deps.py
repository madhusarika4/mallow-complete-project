"""Runtime container, parent-token auth and shared helpers for the API."""

from __future__ import annotations

import secrets
import time
from typing import Any

from fastapi import Header, HTTPException, Request

from runtime import Runtime

TOKEN_TTL = 2 * 60 * 60
MAX_FAILS = 5
LOCKOUT_SECONDS = 30

# Allowed parent-controlled activity keys (see frontend ACTIVITY_CATALOGUE)
ACTIVITY_KEYS = (
    "chat", "stories", "games", "riddles", "quizzes", "learning", "create",
    "quests", "science", "maths", "writing", "journal", "projects", "study",
)
LEGACY_ACTIVITY_MAP = {"basic maths": "maths", "simple science": "science", "vocabulary": "learning"}


class AuthState:
    def __init__(self) -> None:
        self.tokens: dict[str, float] = {}
        self.fails = 0
        self.locked_until = 0.0

    def issue(self) -> str:
        token = secrets.token_urlsafe(24)
        self.tokens[token] = time.time() + TOKEN_TTL
        return token

    def valid(self, token: str | None) -> bool:
        if not token or token not in self.tokens:
            return False
        if self.tokens[token] < time.time():
            self.tokens.pop(token, None)
            return False
        self.tokens[token] = time.time() + TOKEN_TTL
        return True

    def revoke(self, token: str | None) -> None:
        if token:
            self.tokens.pop(token, None)

    def clear(self) -> None:
        self.tokens.clear()


def get_runtime(request: Request) -> Runtime:
    return request.app.state.runtime


def get_auth(request: Request) -> AuthState:
    return request.app.state.auth


def require_parent(request: Request, x_parent_token: str | None = Header(default=None)) -> str:
    """Dependency: a valid parent token (obtained by entering the PIN) is required."""

    if not request.app.state.auth.valid(x_parent_token):
        raise HTTPException(status_code=401, detail="Parent PIN required")
    return x_parent_token or ""


def is_parent(request: Request) -> bool:
    return request.app.state.auth.valid(request.headers.get("x-parent-token"))


def normalize_activities(value: str | None) -> list[str]:
    items = [i.strip() for i in (value or "").split(",") if i.strip()]
    if not items:
        return list(ACTIVITY_KEYS)
    mapped = {LEGACY_ACTIVITY_MAP.get(i, i) for i in items}
    if any(i in LEGACY_ACTIVITY_MAP for i in items):  # legacy profile: enable the new areas
        mapped |= {"chat", "games", "create", "quests", "writing", "journal", "projects", "study"}
    return [k for k in ACTIVITY_KEYS if k in mapped]


def public_child(child: dict[str, Any], runtime: Runtime) -> dict[str, Any]:
    """Fields the child experience needs. Never includes blocked topics or PIN data."""

    from services.age import age_in_years, age_in_months, developmental_stage, parse_dob
    from services.languages import parse_languages

    dob = parse_dob(child.get("dob")) if child.get("dob") else None
    status = runtime.controls.usage(child)
    return {
        "id": child["id"],
        "nickname": child["nickname"],
        "age_band": child["age_band"],
        "age": age_in_years(dob) if dob else None,
        "age_months": age_in_months(dob) if dob else None,
        "developmental_stage": developmental_stage(dob) if dob else None,
        "dob": child.get("dob"),
        "is_infant": child["age_band"] == "0-3",
        "is_demo": bool(child.get("is_demo")),
        "languages": parse_languages(child["languages"]),
        "preferred_language": child.get("preferred_language") or parse_languages(child["languages"])[0],
        "voice_enabled": bool(child.get("voice_enabled")),
        "activities": normalize_activities(child.get("activities")),
        "daily_minutes": child["daily_minutes"],
        "used_minutes_today": round(status.used_seconds / 60, 1),
        "remaining_minutes_today": round(status.remaining_seconds / 60, 1),
        "limit_reached": not status.allowed,
        "voice_engine": child.get("voice_engine", ""),
        "voice_id": child.get("voice_id", ""),
        "voice_language": child.get("voice_language", ""),
        "avatar": child.get("avatar", ""),
    }


def parent_child(child: dict[str, Any], runtime: Runtime) -> dict[str, Any]:
    data = public_child(child, runtime)
    data["blocked_topics"] = [t.strip() for t in (child.get("blocked_topics") or "").split(",") if t.strip()]
    data["dob_exact"] = bool(child.get("dob_exact"))
    data["created_at"] = child.get("created_at")
    return data


def child_or_404(runtime: Runtime, child_id: int) -> dict[str, Any]:
    child = runtime.db.get_child(child_id)
    if not child:
        raise HTTPException(status_code=404, detail="Child profile not found")
    return child
