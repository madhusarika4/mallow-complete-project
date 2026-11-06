"""Run real Edge TTS -> configured STT round trips for English, Telugu and Hinglish."""

from __future__ import annotations

import difflib
import sys
from datetime import datetime, timezone
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from runtime import build_runtime
from services.errors import ServiceError, VoiceDisabledError

PHRASES: dict[str, list[str]] = {
    "English": [
        "Hello, I am learning about the moon.",
        "Can you tell me a short story about a cat?",
        "What is two plus three?",
    ],
    "Telugu": [
        "నేను చంద్రుడి గురించి నేర్చుకుంటున్నాను.",
        "పిల్లి గురించి చిన్న కథ చెప్పండి.",
        "రెండు ప్లస్ మూడు ఎంత?",
    ],
    "Hinglish": [
        "Mujhe moon ke baare mein seekhna hai.",
        "Ek cat ki chhoti kahani sunao.",
        "Do plus teen kitna hota hai?",
    ],
}


def _similarity(reference: str, heard: str) -> float:
    return round(difflib.SequenceMatcher(None, reference, heard).ratio(), 3)


def _escape(value: str) -> str:
    return value.replace("|", "\\|").replace("\n", " ")


def main() -> int:
    """Synthesize with the same voice service used by the app, then transcribe."""
    runtime = build_runtime()
    children = runtime.controls.list_children()
    if not children:
        print("No child profile exists. Start Mallow once to create the default profile.")
        return 2
    child = dict(children[0])
    child["voice_enabled"] = 1
    rows: list[dict[str, object]] = []
    print("Mallow end-to-end voice smoke test (Edge TTS -> configured STT)")
    print(f"Voice output available: {runtime.voice_output_available}")
    print(f"Voice input configured: {runtime.voice_input_available}")

    for language, phrases in PHRASES.items():
        for phrase in phrases:
            tts_status = "not run"
            stt_status = "not run"
            heard = ""
            error = ""
            similarity: float | None = None
            voice_name = ""
            try:
                speech = runtime.voice_service.speak(child, phrase, language)
                tts_status = "ok"
                voice_name = speech.display_name
            except (ServiceError, VoiceDisabledError) as exc:
                tts_status = "failed"
                error = f"TTS {type(exc).__name__}: {exc}"
                speech = None
            if speech is not None:
                try:
                    heard = runtime.chat.transcribe(child, speech.data, "mallow-smoke.mp3", language)
                    stt_status = "ok"
                    similarity = _similarity(phrase, heard)
                except (ServiceError, VoiceDisabledError) as exc:
                    stt_status = "failed"
                    error = f"STT {type(exc).__name__}: {exc}"
            rows.append({
                "language": language, "phrase": phrase, "voice": voice_name,
                "tts": tts_status, "stt": stt_status, "heard": heard,
                "similarity": similarity, "error": error,
            })
            print(f"[{language}] TTS={tts_status} STT={stt_status} heard={heard!r} error={error}")

    report_dir = ROOT / "eval" / "results"
    report_dir.mkdir(parents=True, exist_ok=True)
    report_path = report_dir / "lang_smoke_test.md"
    lines = [
        "# Mallow end-to-end voice smoke test", "",
        f"Run at: {datetime.now(timezone.utc).isoformat(timespec='seconds')}", "",
        f"- STT model: `{runtime.config.stt.model or 'not configured'}`",
        f"- Voice output available: `{runtime.voice_output_available}`",
        f"- Voice input configured: `{runtime.voice_input_available}`", "",
        "Similarity is a rough character-level observation, not WER or an accuracy claim. ",
        "Listen to generated speech and review transcripts with a fluent speaker.", "",
        "| Language | Voice | TTS | STT | Reference | Heard | Similarity | Error |",
        "|---|---|---|---|---|---|---:|---|",
    ]
    for row in rows:
        score = "" if row["similarity"] is None else str(row["similarity"])
        lines.append(
            f"| {row['language']} | {_escape(str(row['voice']))} | {row['tts']} | {row['stt']} | "
            f"{_escape(str(row['phrase']))} | {_escape(str(row['heard']))} | {score} | "
            f"{_escape(str(row['error']))} |"
        )
    lines.extend(["", "## Summary", ""])
    for language in PHRASES:
        subset = [row for row in rows if row["language"] == language]
        ok = sum(1 for row in subset if row["tts"] == "ok" and row["stt"] == "ok")
        lines.append(f"- {language}: {ok}/{len(subset)} successful TTS-to-STT round trips")
    lines.append("")
    report_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"Report written to {report_path}")
    return 0 if all(row["tts"] == "ok" and row["stt"] == "ok" for row in rows) else 1


if __name__ == "__main__":
    raise SystemExit(main())
