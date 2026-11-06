"""Parent PIN, consent, child settings, time limits and voice gating."""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import datetime, timezone

from config import AppConfig
from database.db import Database
from services.errors import VoiceDisabledError

PIN_ITERATIONS = 260_000


@dataclass(frozen=True)
class LimitStatus:
    """Daily usage snapshot for a child."""

    allowed: bool
    used_seconds: int
    limit_seconds: int

    @property
    def remaining_seconds(self) -> int:
        return max(0, self.limit_seconds - self.used_seconds)

    @property
    def used_minutes(self) -> float:
        return round(self.used_seconds / 60, 1)


LIMIT_MESSAGES = {
    "English": (
        "We have used all of today's talking time. Let us take a break. "
        "A grown-up can add more time in Parent settings."
    ),
    "Telugu": (
        "ఈరోజు మాట్లాడే సమయం పూర్తయింది. కొంచెం విశ్రాంతి తీసుకుందాం. "
        "పెద్దవారు సెట్టింగ్స్‌లో సమయం పెంచవచ్చు."
    ),
    "Hinglish": (
        "Aaj ka talking time poora ho gaya. Chalo thoda break lete hain. "
        "Grown-up settings mein time badha sakte hain."
    ),
}

VOICE_OFF_MESSAGES = {
    "English": "Voice is turned off by your parent. You can still type to me.",
    "Telugu": "మీ తల్లిదండ్రులు వాయిస్ ఆఫ్ చేశారు. మీరు టైప్ చేసి మాట్లాడవచ్చు.",
    "Hinglish": "Aapke parent ne voice off kar diya hai. Aap type karke baat kar sakte ho.",
}


class ParentalControls:
    """Backend enforcement for all parent-controlled settings."""

    def __init__(self, db: Database, config: AppConfig) -> None:
        self.db = db
        self.config = config

    def has_consent(self) -> bool:
        return self.db.get_setting("consent_accepted") == "1"

    def accept_consent(self) -> None:
        self.db.set_setting("consent_accepted", "1")

    def ensure_default_child(self) -> dict:
        preset = self.config.tts_voices[0] if self.config.tts_voices else "default"
        return self.db.ensure_default_child(preset)

    def list_children(self) -> list[dict]:
        return self.db.list_children()

    def get_child(self, child_id: int) -> dict | None:
        return self.db.get_child(child_id)

    def update_child(self, child_id: int, **fields: object) -> None:
        self.db.update_child(child_id, **fields)

    def _salt(self) -> bytes:
        stored = self.db.get_setting("pin_salt")
        if stored:
            return base64.b64decode(stored)
        salt = secrets.token_bytes(16)
        self.db.set_setting("pin_salt", base64.b64encode(salt).decode("ascii"))
        return salt

    def is_pin_set(self) -> bool:
        return bool(self.db.get_setting("pin_hash"))

    def set_pin(self, pin: str) -> None:
        """Store a PBKDF2 hash with the per-install salt. Never store the PIN."""

        if len(pin) < 4:
            raise ValueError("PIN must have at least 4 characters")
        salt = self._salt()
        digest = hashlib.pbkdf2_hmac(
            "sha256", pin.encode("utf-8"), salt, PIN_ITERATIONS
        )
        self.db.set_setting("pin_hash", base64.b64encode(digest).decode("ascii"))
        self.db.set_setting("pin_iterations", str(PIN_ITERATIONS))

    def verify_pin(self, pin: str) -> bool:
        stored = self.db.get_setting("pin_hash")
        iterations = int(self.db.get_setting("pin_iterations", str(PIN_ITERATIONS)) or PIN_ITERATIONS)
        if not stored:
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256", pin.encode("utf-8"), self._salt(), iterations
        )
        expected = base64.b64decode(stored)
        return hmac.compare_digest(digest, expected)

    def start_session(
        self, child_id: int, language: str, activity: str = "chat", purpose: str = "general"
    ) -> int:
        return self.db.start_session(child_id, language, activity, purpose)

    def _session_seconds(self, session: dict, now: datetime) -> int:
        started = datetime.fromisoformat(session["started_at"])
        if started.tzinfo is None:
            started = started.replace(tzinfo=timezone.utc)
        elapsed = max(0, int((now - started).total_seconds()))
        return max(int(session.get("duration_seconds", 0)), elapsed)

    def usage(self, child: dict, session_id: int | None = None) -> LimitStatus:
        """Compute today's usage including the live session."""

        now = datetime.now(timezone.utc)
        # "Today" is the family's local day, not the UTC day.
        today_start = (
            datetime.now().astimezone().replace(hour=0, minute=0, second=0, microsecond=0)
            .astimezone(timezone.utc)
        )
        sessions = self.db.sessions_started_since(
            int(child["id"]), today_start.isoformat(timespec="seconds")
        )
        used = 0
        for session in sessions:
            if session.get("purpose", "general") == "educational":
                continue
            if session_id is not None and int(session["id"]) == session_id:
                used += self._session_seconds(session, now)
            else:
                used += int(session.get("duration_seconds", 0))
        limit = max(0, int(child.get("daily_minutes", 30))) * 60
        return LimitStatus(allowed=used < limit, used_seconds=used, limit_seconds=limit)

    def check_time_limit(self, child: dict, session_id: int | None = None) -> LimitStatus:
        return self.usage(child, session_id)

    def record_activity(self, session_id: int) -> None:
        """Update the live session's duration after a turn."""

        session = self.db.get_session(session_id)
        if not session:
            return
        now = datetime.now(timezone.utc)
        self.db.touch_session(session_id, self._session_seconds(session, now))

    def limit_message(self, language: str) -> str:
        return LIMIT_MESSAGES.get(language, LIMIT_MESSAGES["English"])

    def voice_off_message(self, language: str) -> str:
        return VOICE_OFF_MESSAGES.get(language, VOICE_OFF_MESSAGES["English"])

    def voice_allowed(self, child: dict) -> bool:
        return bool(child.get("voice_enabled", 0))

    def voice_available(self, child: dict) -> bool:
        return self.voice_allowed(child) and self.config.voice_enabled

    def assert_voice_allowed(self, child: dict) -> None:
        """Backend rejection for audio requests when voice is off or unavailable."""

        if not self.voice_allowed(child):
            raise VoiceDisabledError("Voice is disabled for this child")

    def delete_all_data(self) -> None:
        self.db.delete_all_data()
