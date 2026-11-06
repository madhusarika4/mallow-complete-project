"""Child chat pipeline: limits -> input safety -> LLM -> output safety -> TTS."""

from __future__ import annotations

import re
import time
from dataclasses import dataclass

from config import AppConfig
from database.db import Database
from services.age_policy import build_system_prompt, get_policy, limit_reply, mode_caps
from services.conversation_purpose import educational_boundary, is_educational_turn
from services.emotion import detect_emotion
from services.prosody import mood_for
from services.errors import ServiceError, VoiceDisabledError
from services.llm_service import LLMAdapter
from services.parental_controls import ParentalControls
from services.safety_escalation import SafetyEscalationService
from services.safety_service import SafetyService, safe_reply
from services.stt_service import STTAdapter
from services.tts_service import TTSAdapter
from services.voice_service import VoiceService, VoiceSpeech


@dataclass(frozen=True)
class ChatResult:
    """What the view needs after one turn."""

    reply: str
    blocked: bool = False
    is_disclosure: bool = False
    limit_reached: bool = False
    fallback_mode: bool = False
    category: str | None = None
    safety_layer: str = "passed"
    error: str | None = None
    emotion: str = "neutral"
    mood: str = "neutral"
    incident_id: int | None = None


_STORY_REQUEST = re.compile(
    r"\b(story|stories|tale|bedtime|kahani|kahaani)\b|కథ", re.IGNORECASE
)


def effective_mode(mode: str, text: str) -> str:
    """Use story mode only when the child actually asked for a story."""

    if mode in {"story", "bedtime"} and not _STORY_REQUEST.search(text):
        return "chat"
    return mode


class ChatService:
    """Coordinates the safety pipeline and stores transcripts only."""

    def __init__(
        self,
        db: Database,
        config: AppConfig,
        controls: ParentalControls,
        llm: LLMAdapter,
        safety: SafetyService,
        stt: STTAdapter,
        tts: TTSAdapter,
        voice_service: VoiceService | None = None,
        escalation: SafetyEscalationService | None = None,
    ) -> None:
        self.db = db
        self.config = config
        self.controls = controls
        self.llm = llm
        self.safety = safety
        self.stt = stt
        self.tts = tts
        self.voice_service = voice_service
        self.escalation = escalation or SafetyEscalationService(db)

    def _history(self, session_id: int) -> list[dict[str, str]]:
        rows = self.db.list_messages(session_id)[-8:]
        return [
            {
                "role": "user" if row["role"] == "child" else "assistant",
                "content": row["text"],
            }
            for row in rows
        ]

    def _log_event(
        self,
        child_id: int,
        session_id: int,
        event_type: str,
        category: str,
    ) -> None:
        self.db.add_event(
            child_id=child_id,
            session_id=session_id,
            event_type=event_type,
            category=category,
            detail="",
        )

    def _incident(
        self,
        child_id: int,
        session_id: int,
        category: str,
        severity: str,
        detail: str,
        language: str,
        message_id: int | None = None,
    ) -> int:
        """Escalate a parent-reviewable incident and record trusted-adult delivery."""

        result = self.escalation.raise_incident(
            child_id=child_id,
            session_id=session_id,
            category=category,
            severity=severity,
            detail=detail,
            language=language,
            message_id=message_id,
        )
        return result.incident_id

    INCIDENT_TEXT = {
        "serious_disclosure": "Mallow noticed words that may mean your child feels unsafe or very upset. "
        "Please check in with them calmly. They were encouraged to talk to a trusted adult.",
        "parent_blocked_topic": "A topic you blocked came up and Mallow steered away from it.",
        "check_error": "A safety check could not complete, so Mallow stayed on the safe side.",
    }

    def respond(
        self,
        child: dict,
        text: str,
        language: str,
        session_id: int,
        mode: str = "chat",
        context: str = "",
    ) -> ChatResult:
        """Run one complete child turn.

        ``context`` is a short, parent-safe description of the activity the child
        is looking at, so Mallow can answer questions about it without guessing.
        """

        child_id = int(child["id"])
        mode = effective_mode(mode, text)

        # Safety classification is independent of conversation purpose and usage.
        # Always run it before educational-content validation or time-limit checks,
        # so neither a study mode nor an exhausted allowance can suppress a crisis.
        input_check = self.safety.check_input(
            text, language=language, blocked_topics=child.get("blocked_topics", "")
        )
        emotion = detect_emotion(text)
        child_message_id = self.db.add_message(session_id, child_id, "child", text, language)
        if emotion != "neutral":
            self.db.execute("UPDATE messages SET emotion = ? WHERE id = ?", (emotion, child_message_id))

        if input_check.is_disclosure:
            reply = input_check.safe_reply or safe_reply(language)
            self._log_event(child_id, session_id, "serious_disclosure", "serious_disclosure")
            incident = self._incident(
                child_id, session_id, "serious_disclosure", "high",
                self.INCIDENT_TEXT["serious_disclosure"], language, child_message_id,
            )
            self.db.add_message(session_id, child_id, "assistant", reply, language)
            self.controls.record_activity(session_id)
            return ChatResult(
                reply=reply,
                blocked=True,
                is_disclosure=True,
                category="serious_disclosure",
                safety_layer="disclosure",
                emotion="sad",
                mood="comfort",
                incident_id=incident,
            )

        if not input_check.allowed:
            reply = input_check.safe_reply or safe_reply(language)
            event_type = (
                "blocked_topic"
                if input_check.category == "parent_blocked_topic"
                else "safety_filter"
            )
            self._log_event(
                child_id, session_id, event_type, input_check.category or "unsafe_input"
            )
            if input_check.layer == "fail_closed":
                self._log_event(child_id, session_id, "moderation_error", "input_fail_closed")
            category = input_check.category or "unsafe_input"
            incident = self._incident(
                child_id, session_id, category,
                "medium" if input_check.layer in ("fail_closed", "moderation") or category in (
                    "sexual_content", "weapons", "self_harm_instructions", "graphic_violence", "drugs"
                ) else "info",
                self.INCIDENT_TEXT.get(category, f"Mallow declined a request ({category.replace('_', ' ')})."),
                language, child_message_id,
            )
            self.db.add_message(session_id, child_id, "assistant", reply, language)
            self.controls.record_activity(session_id)
            return ChatResult(
                reply=reply,
                blocked=True,
                category=input_check.category,
                safety_layer=input_check.layer,
                emotion=emotion,
                mood="comfort",
                incident_id=incident,
            )

        session = self.db.get_session(session_id) or {}
        educational_session = session.get("purpose", "general") == "educational"
        educational_turn = educational_session and is_educational_turn(
            mode, text, int(session.get("educational_turns", 0))
        )
        if educational_session and not educational_turn:
            message = educational_boundary(language)
            self.db.add_message(session_id, child_id, "assistant", message, language)
            return ChatResult(
                reply=message, blocked=True, safety_layer="educational_boundary"
            )

        if not educational_turn:
            status = self.controls.check_time_limit(child, session_id)
            if not status.allowed:
                message = self.controls.limit_message(language)
                self.db.add_message(session_id, child_id, "assistant", message, language)
                return ChatResult(reply=message, blocked=True, limit_reached=True)

        policy = get_policy(child["age_band"])
        system_prompt = build_system_prompt(
            age_band=child["age_band"],
            languages=child["languages"],
            allowed_activities=child.get("activities", ""),
            blocked_topics=child.get("blocked_topics", ""),
            helpline_text=self.config.helpline_text,
            mode=mode,
            emotion=emotion,
        ) + f"\nCurrent spoken language: {language}\n"
        if language == "Hinglish":
            system_prompt += (
                "HINGLISH VOICE MODE: Reply in natural conversational Hinglish, "
                "using Latin/Roman letters for Hindi words and mixing in English "
                "where natural. Do not switch to full Hindi or Devanagari unless "
                "the child asks. Keep the selected language consistent. If the "
                "recognized words are ambiguous, ask a brief clarification instead "
                "of guessing.\n"
            )
        elif language == "Telugu":
            system_prompt += (
                "TELUGU VOICE MODE: Reply in natural Telugu using Telugu script. "
                "Keep the selected language consistent; use English only for words "
                "the child naturally mixes in.\n"
            )
        if context.strip():
            system_prompt += (
                "\nACTIVITY CONTEXT (use it only to help with the current activity; "
                "do not read it out word for word):\n"
                f"{context.strip()[:1200]}\n"
            )
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(self._history(session_id))
        messages.append({"role": "user", "content": text})

        error: str | None = None
        fallback_mode = not self.llm.available
        raw_reply = ""
        for attempt in range(2):
            try:
                raw_reply = self.llm.chat(
                    messages,
                    temperature=0.4,
                    max_tokens=max(700, min(1000, mode_caps(child["age_band"], mode)[0] * 4)),
                )
                error = None
                break
            except ServiceError as exc:
                error = str(exc)
                retryable = (
                    "empty message" in error.lower()
                    or "request failed" in error.lower()
                    or "http 5" in error.lower()
                    or "timeout" in error.lower()
                )
                if attempt == 0 and retryable:
                    time.sleep(0.4)
                    continue
                helper = "story helper" if mode in {"story", "bedtime"} else "thinking helper"
                raw_reply = (
                    f"I could not reach my {helper} just now. Please try again in a moment, "
                    "and tell a grown-up if it keeps happening."
                )
                fallback_mode = True
                self._log_event(child_id, session_id, "llm_error", "llm_unavailable")
                break

        reply = limit_reply(raw_reply, child["age_band"], mode)
        output_check = self.safety.check_output(
            reply, language=language, blocked_topics=child.get("blocked_topics", "")
        )
        blocked = False
        if not output_check.allowed:
            reply = output_check.safe_reply or safe_reply(language)
            blocked = True
            self._log_event(
                child_id,
                session_id,
                "safety_filter",
                output_check.category or "unsafe_output",
            )
            if output_check.layer == "fail_closed":
                self._log_event(child_id, session_id, "moderation_error", "output_fail_closed")
            self._incident(
                child_id, session_id, output_check.category or "unsafe_output", "info",
                "Mallow's own reply was replaced by a safe one before your child saw it.",
                language, child_message_id,
            )

        self.db.add_message(session_id, child_id, "assistant", reply, language)
        self.controls.record_activity(session_id)
        if educational_turn:
            self.db.increment_educational_turns(session_id)
        return ChatResult(
            reply=reply,
            blocked=blocked,
            fallback_mode=fallback_mode,
            category=output_check.category,
            safety_layer=output_check.layer,
            error=error,
            emotion=emotion,
            mood="comfort" if blocked else mood_for(emotion, mode),
        )

    def transcribe(
        self,
        child: dict,
        audio: bytes,
        filename: str,
        language: str,
    ) -> str:
        """Backend voice gate + speech-to-text. Audio is never stored."""

        self.controls.assert_voice_allowed(child)
        if not self.stt.available:
            raise VoiceDisabledError("Speech-to-text provider is not configured")
        return self.stt.transcribe(audio, filename, language)

    def speak(
        self, child: dict, text: str, language: str, mood: str = "neutral"
    ) -> VoiceSpeech:
        """Backend voice gate + text-to-speech. Audio is never stored."""

        self.controls.assert_voice_allowed(child)
        if self.voice_service is not None:
            return self.voice_service.speak(child, text, language, mood)
        if self.tts is None or not self.tts.available:
            raise VoiceDisabledError("Text-to-speech provider is not configured")
        speech = self.tts.synthesize(text, language, voice=child.get("voice_preset"))
        return VoiceSpeech(
            data=speech.data,
            mime_type=speech.mime_type,
            engine="provider",
            voice_id=str(child.get("voice_preset") or ""),
            display_name=str(child.get("voice_preset") or "Provider voice"),
        )
