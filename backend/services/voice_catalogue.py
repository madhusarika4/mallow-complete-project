"""Voice catalogue with online Edge TTS, local Piper, and provider adapters.

The catalogue only describes voices. Synthesis is delegated to an engine so the
same parent-facing selection works for online and offline providers.
"""

from __future__ import annotations

import asyncio
import json
import shutil
import subprocess
import sys
import tempfile
import threading
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from config import AppConfig
from services.errors import ServiceError
from services.tts_service import SpeechAudio, TTSAdapter

DATA_DIR = Path(__file__).resolve().parent / "data"
EDGE_SNAPSHOT_PATH = DATA_DIR / "edge_voices.json"
PIPER_MANIFEST_PATH = DATA_DIR / "piper_voices.json"

ENGINE_EDGE = "edge"
ENGINE_PIPER = "piper"
ENGINE_PROVIDER = "provider"

READY = "ready"
NEEDS_DOWNLOAD = "requires_download"
NEEDS_CONFIG = "requires_configuration"
UNAVAILABLE = "unavailable"

INSTALLED = "installed"
NOT_INSTALLED = "not_installed"
ONLINE = "online"

EDGE_LICENSE = "Microsoft Edge online TTS terms"
PREFERRED_VOICES: dict[str, tuple[tuple[str, str], ...]] = {
    "English": (
        (ENGINE_EDGE, "en-US-AvaMultilingualNeural"),
        (ENGINE_EDGE, "en-IN-NeerjaNeural"),
        (ENGINE_EDGE, "en-US-AvaNeural"),
    ),
    "Telugu": ((ENGINE_EDGE, "te-IN-ShrutiNeural"),),
    "Hinglish": (
        (ENGINE_EDGE, "hi-IN-SwaraNeural"),
        (ENGINE_EDGE, "en-IN-NeerjaNeural"),
    ),
}


@dataclass(frozen=True)
class VoiceEntry:
    """One selectable voice with honest provenance and availability metadata."""

    engine: str
    voice_id: str
    display_name: str
    language: str
    locale: str
    accent: str
    gender: str
    online_or_offline: str
    installed_status: str
    model_license: str
    availability_status: str
    engine_label: str = ""
    quality: str = ""
    size_mb: float | None = None
    multilingual: bool = False
    notes: str = ""
    license_url: str = ""
    download_url: str = ""

    @property
    def is_ready(self) -> bool:
        return self.availability_status == READY


@dataclass(frozen=True)
class VoiceSelection:
    """The voice saved for a child."""

    engine: str = ""
    voice_id: str = ""
    language: str = ""
    locale: str = ""
    display_name: str = ""

    @property
    def is_set(self) -> bool:
        return bool(self.engine and self.voice_id)

    @classmethod
    def from_child(cls, child: dict[str, Any]) -> "VoiceSelection":
        return cls(
            engine=str(child.get("voice_engine") or ""),
            voice_id=str(child.get("voice_id") or ""),
            language=str(child.get("voice_language") or ""),
            locale=str(child.get("voice_locale") or ""),
        )


def _load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def _language_and_accent(locale_name: str) -> tuple[str, str]:
    language, _, rest = locale_name.partition(" (")
    accent = rest[:-1] if rest.endswith(")") else rest
    return language.strip() or "Unknown", accent.strip()


def _edge_display_name(friendly_name: str, short_name: str) -> str:
    name = friendly_name.split(" Online ", 1)[0].removeprefix("Microsoft ").strip()
    name = name.replace(" (Preview)", "").strip()
    if not name:
        name = short_name.split("-")[-1].removesuffix("Neural")
    if "Multilingual" in short_name and "Multilingual" not in name:
        name = f"{name} (Multilingual)"
    return name


def _edge_entry(raw: dict[str, Any]) -> VoiceEntry:
    short_name = str(raw.get("ShortName") or "")
    locale = str(raw.get("Locale") or "")
    language, accent = _language_and_accent(str(raw.get("LocaleName") or ""))
    multilingual = "Multilingual" in short_name
    note = (
        "Free online service. Requires internet and is not guaranteed free forever. "
        "Mallow has not tested every voice in this list."
    )
    if str(raw.get("Status") or "").lower() == "preview":
        note += " Preview voice."
    if multilingual:
        note += " Multilingual voice; pronunciation quality is not human-rated here."
    return VoiceEntry(
        engine=ENGINE_EDGE,
        voice_id=short_name,
        display_name=_edge_display_name(str(raw.get("FriendlyName") or ""), short_name),
        language=language,
        locale=locale,
        accent=accent,
        gender=str(raw.get("Gender") or "Unspecified"),
        online_or_offline="online",
        installed_status=ONLINE,
        model_license=EDGE_LICENSE,
        availability_status=READY,
        engine_label="Edge TTS (online)",
        quality="Neural",
        multilingual=multilingual,
        notes=note,
    )


def _run_coroutine(coroutine: Any) -> Any:
    """Run an async provider call from sync Streamlit or test code."""

    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coroutine)

    box: dict[str, Any] = {}

    def runner() -> None:
        try:
            box["result"] = asyncio.run(coroutine)
        except BaseException as exc:  # noqa: BLE001 - propagated to the caller
            box["error"] = exc

    thread = threading.Thread(target=runner, daemon=True)
    thread.start()
    thread.join()
    if "error" in box:
        raise box["error"]
    return box["result"]


class VoiceEngine(ABC):
    """Interface for one source of voices."""

    name: str = ""
    label: str = ""

    @abstractmethod
    def entries(self) -> list[VoiceEntry]:
        """Return catalogue entries without downloading models."""

    @abstractmethod
    def synthesize(self, text: str, voice_id: str, language: str) -> SpeechAudio:
        """Generate in-memory audio for one voice."""

    def refresh(self) -> bool:
        """Refresh remote metadata when supported. Returns True on success."""

        return False

    @property
    def last_error(self) -> str:
        return ""


class EdgeTTSEngine(VoiceEngine):
    """Microsoft Edge online voices. The static snapshot avoids startup calls."""

    name = ENGINE_EDGE
    label = "Edge TTS (online)"

    def __init__(
        self,
        snapshot_path: Path = EDGE_SNAPSHOT_PATH,
        timeout: int = 60,
        discovery_timeout: int = 25,
    ) -> None:
        self.snapshot_path = snapshot_path
        self.timeout = timeout
        self.discovery_timeout = discovery_timeout
        self._error = ""
        self._entries: list[VoiceEntry] = []
        raw = _load_json(self.snapshot_path)
        if isinstance(raw, list):
            self._entries = [_edge_entry(item) for item in raw if item.get("ShortName")]

    @property
    def last_error(self) -> str:
        return self._error

    def entries(self) -> list[VoiceEntry]:
        return list(self._entries)

    def refresh(self) -> bool:
        try:
            import edge_tts
        except ImportError as exc:
            self._error = f"edge-tts is not installed: {exc}"
            return False
        try:
            raw = _run_coroutine(
                asyncio.wait_for(edge_tts.list_voices(), timeout=self.discovery_timeout)
            )
        except Exception as exc:  # noqa: BLE001 - reported honestly in the UI
            self._error = f"Edge voice refresh failed: {type(exc).__name__}: {exc}"
            return False
        entries = [
            _edge_entry(item) for item in raw if isinstance(item, dict) and item.get("ShortName")
        ]
        if not entries:
            self._error = "Edge voice refresh returned no voices."
            return False
        self._entries = entries
        self._error = ""
        return True

    def synthesize(self, text: str, voice_id: str, language: str) -> SpeechAudio:
        del language
        if not text.strip():
            raise ServiceError("No text to speak")
        if not voice_id:
            raise ServiceError("No Edge voice was selected")
        try:
            import edge_tts
        except ImportError as exc:
            raise ServiceError(f"edge-tts is not installed: {exc}") from exc

        return self.synthesize_mood(text, voice_id, language="", mood="neutral")

    def synthesize_mood(
        self, text: str, voice_id: str, language: str = "", mood: str = "neutral"
    ) -> SpeechAudio:
        """Sentence-level synthesis with per-mood rate/pitch/volume and pauses.

        Only rate, pitch and volume are honoured by the free Edge endpoint; see
        services/prosody.py for the honest limits.
        """

        del language
        if not text.strip():
            raise ServiceError("No text to speak")
        if not voice_id:
            raise ServiceError("No Edge voice was selected")
        try:
            import edge_tts
        except ImportError as exc:
            raise ServiceError(f"edge-tts is not installed: {exc}") from exc
        from services.prosody import SILENCE_MP3, plan_segments

        segments = plan_segments(text, mood)
        if not segments:
            raise ServiceError("No speakable text")

        async def one(segment: Any) -> bytes:
            last: Exception | None = None
            for _attempt in range(2):  # one retry for transient websocket failures
                try:
                    communicate = edge_tts.Communicate(
                        segment.text,
                        voice_id,
                        rate=segment.prosody.rate_str(),
                        pitch=segment.prosody.pitch_str(),
                        volume=segment.prosody.volume_str(),
                    )
                    buffer = bytearray()
                    async for chunk in communicate.stream():
                        if chunk.get("type") == "audio":
                            buffer.extend(chunk["data"])
                    if buffer:
                        return bytes(buffer)
                    last = ServiceError("empty audio")
                except Exception as exc:  # noqa: BLE001
                    last = exc
            raise last or ServiceError("Edge TTS failed")

        async def collect() -> bytes:
            gate = asyncio.Semaphore(4)

            async def limited(segment: Any) -> bytes:
                async with gate:
                    return await one(segment)

            parts = await asyncio.gather(*(limited(s) for s in segments))
            out = bytearray()
            for segment, part in zip(segments, parts):
                out.extend(part)
                if segment.pause_after:
                    out.extend(SILENCE_MP3 * max(1, round(segment.prosody.pause_ms / 280)))
            return bytes(out)

        try:
            data = _run_coroutine(asyncio.wait_for(collect(), timeout=self.timeout))
        except asyncio.TimeoutError as exc:
            raise ServiceError("Edge TTS timed out") from exc
        except Exception as exc:  # noqa: BLE001 - provider errors vary
            raise ServiceError(f"Edge TTS failed: {type(exc).__name__}: {exc}") from exc
        if not data:
            raise ServiceError("Edge TTS returned empty audio")
        return SpeechAudio(data=data, mime_type="audio/mpeg")


class PiperEngine(VoiceEngine):
    """Local Piper voices. Models are never downloaded automatically."""

    name = ENGINE_PIPER
    label = "Piper (offline)"

    def __init__(
        self,
        models_dir: Path,
        binary: str = "piper",
        manifest_path: Path = PIPER_MANIFEST_PATH,
        timeout: int = 120,
    ) -> None:
        self.models_dir = Path(models_dir)
        self.binary = binary
        self.manifest_path = manifest_path
        self.timeout = timeout

    def _manifest(self) -> list[dict[str, Any]]:
        raw = _load_json(self.manifest_path)
        return [item for item in raw if isinstance(item, dict)] if isinstance(raw, list) else []

    def _local_models(self) -> dict[str, Path]:
        models: dict[str, Path] = {}
        if not self.models_dir.exists():
            return models
        for onnx in self.models_dir.glob("*.onnx"):
            config_path = Path(f"{onnx}.json")
            if config_path.exists():
                models[onnx.name.removesuffix(".onnx")] = onnx
        return models

    def _generic_local_entry(self, voice_id: str) -> VoiceEntry:
        path = self.models_dir / f"{voice_id}.onnx"
        config = _load_json(Path(f"{path}.json")) or {}
        language_info = config.get("language", {}) if isinstance(config, dict) else {}
        language = str(language_info.get("name_english") or language_info.get("code") or "Unknown")
        locale = str(language_info.get("code") or "").replace("_", "-")
        return VoiceEntry(
            engine=self.name,
            voice_id=voice_id,
            display_name=voice_id,
            language=language,
            locale=locale,
            accent="Local model",
            gender="Unspecified",
            online_or_offline="offline",
            installed_status=INSTALLED,
            model_license="Unknown local model (verify licence)",
            availability_status=READY,
            engine_label=self.label,
            quality=str(config.get("audio", {}).get("quality", "")) if isinstance(config, dict) else "",
            notes="Local model is not in the verified manifest. Check its licence before use.",
        )

    def _manifest_entry(self, meta: dict[str, Any], installed: bool) -> VoiceEntry:
        return VoiceEntry(
            engine=self.name,
            voice_id=str(meta.get("voice_id") or ""),
            display_name=str(meta.get("display_name") or meta.get("voice_id") or ""),
            language=str(meta.get("language") or "Unknown"),
            locale=str(meta.get("locale") or ""),
            accent=str(meta.get("accent") or ""),
            gender=str(meta.get("gender") or "Unspecified"),
            online_or_offline="offline",
            installed_status=INSTALLED if installed else NOT_INSTALLED,
            model_license=str(meta.get("model_license") or "Unknown"),
            availability_status=READY if installed else NEEDS_DOWNLOAD,
            engine_label=self.label,
            quality=str(meta.get("quality") or ""),
            size_mb=float(meta["size_mb"]) if meta.get("size_mb") is not None else None,
            notes=str(meta.get("notes") or "Manual download only."),
            license_url=str(meta.get("license_url") or ""),
            download_url=str(meta.get("download_url") or ""),
        )

    def entries(self) -> list[VoiceEntry]:
        local = self._local_models()
        known = {str(meta.get("voice_id")) for meta in self._manifest()}
        entries = [
            self._manifest_entry(meta, str(meta.get("voice_id")) in local)
            for meta in self._manifest()
        ]
        for voice_id in sorted(local):
            if voice_id not in known:
                entries.append(self._generic_local_entry(voice_id))
        return entries

    def _command(self) -> list[str] | None:
        if self.binary.endswith(".py"):
            return [sys.executable, self.binary]
        found = shutil.which(self.binary)
        if found:
            return [found]
        path = Path(self.binary)
        if path.exists():
            return [str(path)]
        return None

    def synthesize(self, text: str, voice_id: str, language: str) -> SpeechAudio:
        del language
        if not text.strip():
            raise ServiceError("No text to speak")
        model_path = self.models_dir / f"{voice_id}.onnx"
        if not model_path.exists():
            raise ServiceError(
                f"Piper voice '{voice_id}' is not downloaded. Add the model to "
                f"{self.models_dir} manually; Mallow does not auto-download models."
            )
        command = self._command()
        if command is None:
            raise ServiceError(
                "Piper is not installed. Install piper-tts manually and set PIPER_BINARY, "
                "or choose an online Edge voice."
            )
        with tempfile.TemporaryDirectory(prefix="nani-piper-") as temp_dir:
            output_path = Path(temp_dir) / "speech.wav"
            try:
                process = subprocess.run(
                    [
                        *command,
                        "--model",
                        str(model_path),
                        "--output_file",
                        str(output_path),
                    ],
                    input=text.encode("utf-8"),
                    capture_output=True,
                    timeout=self.timeout,
                    check=False,
                )
            except (OSError, subprocess.TimeoutExpired) as exc:
                raise ServiceError(f"Piper failed to start: {exc}") from exc
            if process.returncode != 0:
                detail = process.stderr.decode("utf-8", errors="replace").strip()
                raise ServiceError(f"Piper returned code {process.returncode}: {detail[:300]}")
            if not output_path.exists() or output_path.stat().st_size == 0:
                raise ServiceError("Piper returned empty audio")
            data = output_path.read_bytes()
        return SpeechAudio(data=data, mime_type="audio/wav")


class ProviderVoiceEngine(VoiceEngine):
    """Wrapper around the existing OpenAI-compatible TTS adapter."""

    name = ENGINE_PROVIDER
    label = "Configured provider (online)"

    def __init__(self, adapter: TTSAdapter) -> None:
        self.adapter = adapter

    def entries(self) -> list[VoiceEntry]:
        available = bool(self.adapter.available)
        return [
            VoiceEntry(
                engine=self.name,
                voice_id=voice,
                display_name=voice,
                language="Any",
                locale="",
                accent="Provider",
                gender="Unspecified",
                online_or_offline="online",
                installed_status=INSTALLED if available else NOT_INSTALLED,
                model_license="Provider terms",
                availability_status=READY if available else NEEDS_CONFIG,
                engine_label=self.label,
                notes=(
                    "Language coverage and pronunciation depend on the provider and are "
                    "not verified by Mallow."
                ),
            )
            for voice in self.adapter.voices
        ]

    def synthesize(self, text: str, voice_id: str, language: str) -> SpeechAudio:
        return self.adapter.synthesize(text, language, voice=voice_id)


class VoiceCatalogue:
    """Combined, filterable view over all engines."""

    def __init__(self, engines: list[VoiceEngine]) -> None:
        self.engines: dict[str, VoiceEngine] = {engine.name: engine for engine in engines}
        self._entries: list[VoiceEntry] = []
        self.reload()

    def reload(self) -> None:
        seen: set[tuple[str, str]] = set()
        entries: list[VoiceEntry] = []
        for engine in self.engines.values():
            try:
                candidates = engine.entries()
            except Exception:  # noqa: BLE001 - one broken engine must not hide others
                continue
            for entry in candidates:
                key = (entry.engine, entry.voice_id)
                if key in seen:
                    continue
                seen.add(key)
                entries.append(entry)
        self._entries = entries

    def list_entries(self) -> list[VoiceEntry]:
        return list(self._entries)

    def find(self, engine: str, voice_id: str) -> VoiceEntry | None:
        for entry in self._entries:
            if entry.engine == engine and entry.voice_id == voice_id:
                return entry
        return None

    @staticmethod
    def compatibility_score(entry: VoiceEntry, language: str) -> int | None:
        if language == "Hinglish":
            if entry.language == "Hindi" and entry.locale.upper().endswith("-IN"):
                return 100
            if entry.language == "English" and entry.locale.upper().endswith("-IN"):
                return 90
            if entry.multilingual:
                return 80
            if entry.language == "Any":
                return 10
            return None
        if entry.language == language:
            return 100
        if entry.language == "Any":
            return 10
        return None

    def compatible_entries(self, language: str) -> list[VoiceEntry]:
        engine_order = {name: index for index, name in enumerate(self.engines)}
        scored: list[tuple[int, int, str, VoiceEntry]] = []
        for entry in self._entries:
            score = self.compatibility_score(entry, language)
            if score is None:
                continue
            scored.append((score, engine_order.get(entry.engine, 99), entry.display_name, entry))
        scored.sort(key=lambda item: (-item[0], item[1], item[2]))
        return [item[3] for item in scored]

    def languages(self) -> list[str]:
        names = {entry.language for entry in self._entries if entry.language != "Any"}
        return sorted(names)

    def default_selection(self, language: str) -> VoiceSelection:
        for engine_name, voice_id in PREFERRED_VOICES.get(language, ()):
            entry = self.find(engine_name, voice_id)
            if entry and self.compatibility_score(entry, language) is not None:
                return self._selection_from_entry(entry)
        for entry in self.compatible_entries(language):
            if entry.is_ready:
                return self._selection_from_entry(entry)
        for entry in self.compatible_entries(language):
            return self._selection_from_entry(entry)
        return VoiceSelection(engine=ENGINE_EDGE, language=language)

    @staticmethod
    def _selection_from_entry(entry: VoiceEntry) -> VoiceSelection:
        return VoiceSelection(
            engine=entry.engine,
            voice_id=entry.voice_id,
            language=entry.language,
            locale=entry.locale,
            display_name=entry.display_name,
        )

    def engine_statuses(self) -> list[tuple[str, str, str]]:
        statuses: list[tuple[str, str, str]] = []
        for engine in self.engines.values():
            entries = engine.entries()
            ready = sum(1 for entry in entries if entry.is_ready)
            status = f"{ready}/{len(entries)} ready"
            if engine.last_error:
                status = engine.last_error
            statuses.append((engine.label, status, engine.name))
        return statuses


def build_voice_catalogue(config: AppConfig, provider_tts: TTSAdapter) -> VoiceCatalogue:
    """Build the catalogue without network calls."""

    engines: list[VoiceEngine] = []
    if config.enable_online_voices:
        engines.append(EdgeTTSEngine())
    engines.append(PiperEngine(config.piper_models_dir, config.piper_binary))
    engines.append(ProviderVoiceEngine(provider_tts))
    return VoiceCatalogue(engines)
