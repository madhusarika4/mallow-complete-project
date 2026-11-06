"""Voice selection, same-language fallback, and in-memory synthesis."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from services.errors import ServiceError
from services.voice_catalogue import (
    READY,
    VoiceCatalogue,
    VoiceEntry,
    VoiceSelection,
)


@dataclass(frozen=True)
class VoiceSpeech:
    """Audio plus the exact voice used and any honest fallback notice."""

    data: bytes
    mime_type: str
    engine: str
    voice_id: str
    display_name: str
    fallback_used: bool = False
    notice: str | None = None


class VoiceService:
    """Resolve a child's saved voice and never silently change language."""

    def __init__(self, catalogue: VoiceCatalogue) -> None:
        self.catalogue = catalogue

    @property
    def available(self) -> bool:
        return any(entry.is_ready for entry in self.catalogue.list_entries())

    @property
    def label(self) -> str:
        labels = [
            engine.label
            for engine in self.catalogue.engines.values()
            if any(entry.is_ready and entry.engine == engine.name for entry in self.catalogue.list_entries())
        ]
        return ", ".join(labels) if labels else "unavailable"

    def selection_for(
        self, child: dict[str, Any], language: str
    ) -> tuple[VoiceSelection, str | None]:
        """Return the stored selection when it fits the language, else a default."""

        stored = VoiceSelection.from_child(child)
        if stored.is_set:
            entry = self.catalogue.find(stored.engine, stored.voice_id)
            if entry is not None:
                compatible = self.catalogue.compatibility_score(entry, language) is not None
            else:
                compatible = stored.language == language or (
                    language == "Hinglish" and stored.language in {"Hindi", "English"}
                )
            if compatible:
                name = entry.display_name if entry else stored.display_name
                return (
                    VoiceSelection(
                        engine=stored.engine,
                        voice_id=stored.voice_id,
                        language=stored.language or language,
                        locale=stored.locale,
                        display_name=name or stored.voice_id,
                    ),
                    None,
                )
        default = self.catalogue.default_selection(language)
        notice = None
        if stored.is_set:
            saved_entry = self.catalogue.find(stored.engine, stored.voice_id)
            saved = (
                saved_entry.display_name
                if saved_entry is not None
                else (stored.display_name or stored.voice_id)
            )
            notice = (
                f"The saved voice '{saved}' is for "
                f"{stored.language or 'another language'}. Using '{default.display_name}' "
                f"for {language}; Mallow never silently changes the spoken language."
            )
        return default, notice

    def _attempts(
        self, selection: VoiceSelection, language: str
    ) -> list[tuple[str, str, str]]:
        attempts: list[tuple[str, str, str]] = []
        seen: set[tuple[str, str]] = set()

        def add(engine: str, voice_id: str, name: str) -> None:
            key = (engine, voice_id)
            if engine and voice_id and key not in seen:
                seen.add(key)
                attempts.append((engine, voice_id, name))

        if selection.is_set:
            entry = self.catalogue.find(selection.engine, selection.voice_id)
            if entry is not None:
                if entry.is_ready:
                    add(entry.engine, entry.voice_id, entry.display_name)
            else:
                add(selection.engine, selection.voice_id, selection.display_name or selection.voice_id)
        for entry in self.catalogue.compatible_entries(language):
            if entry.is_ready and entry.language != "Any":
                add(entry.engine, entry.voice_id, entry.display_name)
        return attempts

    def speak(
        self, child: dict[str, Any], text: str, language: str, mood: str = "neutral"
    ) -> VoiceSpeech:
        """Synthesize for a child with same-language fallback only."""

        selection, notice = self.selection_for(child, language)
        return self._synthesize(text, language, selection, notice, mood)

    def preview(self, text: str, entry: VoiceEntry, language: str) -> VoiceSpeech:
        """Synthesize one explicit catalogue entry without fallback."""

        if not entry.is_ready:
            raise ServiceError(
                f"'{entry.display_name}' is not ready. Status: {entry.availability_status}."
            )
        engine = self.catalogue.engines.get(entry.engine)
        if engine is None:
            raise ServiceError(f"Voice engine '{entry.engine}' is not available.")
        audio = engine.synthesize(text, entry.voice_id, language)
        return VoiceSpeech(
            data=audio.data,
            mime_type=audio.mime_type,
            engine=entry.engine,
            voice_id=entry.voice_id,
            display_name=entry.display_name,
        )

    def _synthesize(
        self,
        text: str,
        language: str,
        selection: VoiceSelection,
        language_notice: str | None,
        mood: str = "neutral",
    ) -> VoiceSpeech:
        if not text.strip():
            raise ServiceError("No text to speak")
        attempts = self._attempts(selection, language)
        if not attempts:
            raise ServiceError(
                f"No {language} voice is ready. Add a local Piper model or enable an "
                "online voice in Parent settings."
            )

        errors: list[str] = []
        selected_key = (selection.engine, selection.voice_id)
        for engine_name, voice_id, display_name in attempts:
            engine = self.catalogue.engines.get(engine_name)
            if engine is None:
                errors.append(f"{display_name}: engine '{engine_name}' is unavailable")
                continue
            try:
                if hasattr(engine, "synthesize_mood"):
                    audio = engine.synthesize_mood(text, voice_id, language, mood)
                else:
                    audio = engine.synthesize(text, voice_id, language)
            except ServiceError as exc:
                errors.append(f"{display_name}: {exc}")
                continue
            except Exception as exc:  # noqa: BLE001 - one engine must not break the turn
                errors.append(f"{display_name}: {type(exc).__name__}: {exc}")
                continue

            used_key = (engine_name, voice_id)
            if used_key == selected_key:
                notice = language_notice
            else:
                saved = selection.display_name or selection.voice_id or "the saved voice"
                notice = (
                    f"Saved voice '{saved}' was unavailable. Using '{display_name}' "
                    f"({engine.label}) for {language}. Mallow only falls back within the "
                    "same language."
                )
                if language_notice:
                    notice = f"{language_notice} {notice}"
            return VoiceSpeech(
                data=audio.data,
                mime_type=audio.mime_type,
                engine=engine_name,
                voice_id=voice_id,
                display_name=display_name,
                fallback_used=bool(notice),
                notice=notice,
            )

        detail = errors[-1] if errors else "No voice tried"
        raise ServiceError(f"Could not generate {language} speech. {detail}")
