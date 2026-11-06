"""Build the application services (framework-independent)."""

from __future__ import annotations

from dataclasses import dataclass

from config import AppConfig, load_config
from database.db import Database
from services.chat_service import ChatService
from services.companion_service import CompanionService
from services.languages import parse_languages
from services.llm_service import LLMAdapter, build_llm
from services.parental_controls import ParentalControls
from services.safety_escalation import SafetyEscalationService
from services.safety_service import SafetyService
from services.stt_service import STTAdapter, build_stt
from services.tts_service import TTSAdapter, build_tts
from services.voice_catalogue import VoiceCatalogue, build_voice_catalogue
from services.voice_service import VoiceService


@dataclass
class Runtime:
    """Container for all services used by views."""

    config: AppConfig
    db: Database
    controls: ParentalControls
    llm: LLMAdapter
    stt: STTAdapter
    tts: TTSAdapter
    safety: SafetyService
    escalation: SafetyEscalationService
    chat: ChatService
    companion: CompanionService
    voice_catalogue: VoiceCatalogue
    voice_service: VoiceService

    @property
    def voice_output_available(self) -> bool:
        return self.voice_service.available

    @property
    def voice_input_available(self) -> bool:
        return self.config.stt_enabled

    @property
    def voice_output_label(self) -> str:
        return self.voice_service.label

    def ensure_default_voices(self) -> None:
        """Backfill a sensible voice for children created before this stage."""

        for child in self.db.list_children():
            if child.get("age_band") == "0-3" or child.get("voice_id"):
                continue
            languages = parse_languages(str(child.get("languages") or "English"))
            selection = self.voice_catalogue.default_selection(languages[0])
            if not selection.is_set:
                continue
            self.db.update_child(
                int(child["id"]),
                voice_engine=selection.engine,
                voice_id=selection.voice_id,
                voice_language=selection.language,
                voice_locale=selection.locale,
                voice_preset=selection.voice_id,
            )


def build_runtime(config: AppConfig | None = None) -> Runtime:
    """Construct services without Streamlit caching. Used by tests and the app."""

    cfg = config or load_config()
    db = Database(cfg.db_path)
    controls = ParentalControls(db, cfg)
    llm = build_llm(cfg.llm)
    stt = build_stt(cfg.stt)
    tts = build_tts(cfg.tts, cfg.tts_voices)
    voice_catalogue = build_voice_catalogue(cfg, tts)
    voice_service = VoiceService(voice_catalogue)
    safety = SafetyService(
        llm=llm,
        moderation_model=cfg.moderation_model if cfg.llm_enabled else "",
        helpline_text=cfg.helpline_text,
    )
    escalation = SafetyEscalationService(db)
    chat = ChatService(
        db,
        cfg,
        controls,
        llm,
        safety,
        stt,
        tts,
        voice_service=voice_service,
        escalation=escalation,
    )
    companion = CompanionService(db, cfg, llm)
    runtime = Runtime(
        cfg,
        db,
        controls,
        llm,
        stt,
        tts,
        safety,
        escalation,
        chat,
        companion,
        voice_catalogue,
        voice_service,
    )
    runtime.ensure_default_voices()
    return runtime
