"""Real voice-catalogue smoke test. Makes online Edge calls only."""

from __future__ import annotations

import importlib.metadata
import sys
from datetime import datetime, timezone
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from config import load_config
from services.errors import ServiceError
from services.voice_catalogue import NEEDS_DOWNLOAD, READY
from services.voice_service import VoiceService
from runtime import build_runtime

PHRASES = {
    "English": "Hello! I am Mallow. This is an English voice catalogue test.",
    "Telugu": "నమస్తే! నేను నానీ. ఇది తెలుగు వాయిస్ పరీక్ష.",
    "Hinglish": "Namaste! Main Mallow hoon. Yeh Hinglish voice test hai.",
}


def _escape(value: object) -> str:
    return str(value).replace("|", "\\|").replace("\n", " ")


def main() -> int:
    """Run real synthesis and write a Markdown report."""

    config = load_config()
    runtime = build_runtime(config)
    catalogue = runtime.voice_catalogue
    service: VoiceService = runtime.voice_service
    child = runtime.db.list_children()[0]

    rows: list[dict[str, object]] = []
    print("Mallow voice catalogue smoke test")
    for language, phrase in PHRASES.items():
        selection = catalogue.default_selection(language)
        selected_child = dict(child)
        selected_child.update(
            {
                "voice_engine": selection.engine,
                "voice_id": selection.voice_id,
                "voice_language": selection.language,
                "voice_locale": selection.locale,
            }
        )
        status = "not run"
        error = ""
        speech = None
        try:
            speech = service.speak(selected_child, phrase, language)
            status = "ok"
        except ServiceError as exc:
            status = "failed"
            error = f"{type(exc).__name__}: {exc}"
        row = {
            "language": language,
            "voice": selection.display_name or selection.voice_id,
            "engine": selection.engine,
            "status": status,
            "bytes": len(speech.data) if speech else 0,
            "mime": speech.mime_type if speech else "",
            "notice": speech.notice if speech else "",
            "error": error,
        }
        rows.append(row)
        print(
            f"[{language}] status={status} voice={row['voice']} bytes={row['bytes']} "
            f"error={error}"
        )

    missing_piper = next(
        (
            entry
            for entry in catalogue.list_entries()
            if entry.engine == "piper" and entry.availability_status == NEEDS_DOWNLOAD
        ),
        None,
    )
    fallback_status = "not run"
    fallback_error = ""
    fallback_notice = ""
    fallback_voice = ""
    if missing_piper is not None:
        fallback_child = dict(child)
        fallback_child.update(
            {
                "voice_engine": missing_piper.engine,
                "voice_id": missing_piper.voice_id,
                "voice_language": missing_piper.language,
                "voice_locale": missing_piper.locale,
            }
        )
        try:
            speech = service.speak(fallback_child, PHRASES["Hinglish"], "Hinglish")
            fallback_status = "ok"
            fallback_voice = speech.display_name
            fallback_notice = speech.notice or ""
        except ServiceError as exc:
            fallback_status = "failed"
            fallback_error = f"{type(exc).__name__}: {exc}"

    edge_entries = [entry for entry in catalogue.list_entries() if entry.engine == "edge"]
    piper_entries = [entry for entry in catalogue.list_entries() if entry.engine == "piper"]
    piper_ready = [entry for entry in piper_entries if entry.availability_status == READY]
    try:
        edge_version = importlib.metadata.version("edge-tts")
    except importlib.metadata.PackageNotFoundError:
        edge_version = "not installed"

    lines = [
        "# Mallow voice catalogue smoke test",
        "",
        f"Run at: {datetime.now(timezone.utc).isoformat(timespec='seconds')}",
        "",
        f"- edge-tts version: `{edge_version}`",
        f"- Edge catalogue entries: {len(edge_entries)}",
        f"- Piper manifest/local entries: {len(piper_entries)} "
        f"({len(piper_ready)} installed locally)",
        f"- Voice output available: {runtime.voice_output_available}",
        f"- Voice input configured: {runtime.voice_input_available}",
        "",
        "Real Edge synthesis was requested for every row below. No audio was stored.",
        "Success means non-empty MP3 audio was returned, not that a human rated the",
        "pronunciation or language quality.",
        "",
        "| Language | Selected voice | Engine | Result | Bytes | MIME | Fallback notice | Error |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for row in rows:
        lines.append(
            f"| {row['language']} | {_escape(row['voice'])} | {row['engine']} | "
            f"{row['status']} | {row['bytes']} | {row['mime']} | "
            f"{_escape(row['notice'])} | {_escape(row['error'])} |"
        )

    lines.extend(["", "## Missing-voice fallback", ""])
    if missing_piper is None:
        lines.append("No uninstalled Piper voice was available to test fallback.")
    else:
        lines.append(
            f"Selected unavailable Piper voice `{missing_piper.voice_id}` for Hinglish. "
            f"Result: {fallback_status}. Used voice: {fallback_voice or 'none'}. "
            f"Notice: {fallback_notice or 'none'} Error: {fallback_error or 'none'}"
        )

    lines.extend(["", "## Engine status", ""])
    for label, status, _ in catalogue.engine_statuses():
        lines.append(f"- {label}: {status}")

    lines.extend(
        [
            "",
            "## Honest limitations",
            "",
            "- Edge TTS is a free online service. It requires internet and Microsoft does",
            "  not guarantee it will stay free or unchanged.",
            "- Piper voices are offline but not installed by default. Mallow never downloads",
            "  models automatically. Review each model licence before use.",
            "- Hinglish and mixed-script rows verify audio generation only. Pronunciation",
            "  quality is not human-rated, and no WER or accuracy claim is made.",
            "- Indic-Speak and Indic-TTS were researched but are not integrated because",
            "  they need large gated checkpoints, GPU/Linux setups, or fairseq tooling.",
            "",
        ]
    )
    report_dir = ROOT / "eval" / "results"
    report_dir.mkdir(parents=True, exist_ok=True)
    report_path = report_dir / "voice_catalogue_check.md"
    report_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"Report written to {report_path}")

    return 0 if all(row["status"] == "ok" for row in rows) else 1


if __name__ == "__main__":
    raise SystemExit(main())
