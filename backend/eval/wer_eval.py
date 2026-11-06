"""Evaluate Mallow speech-to-text word error rate on labelled WAV files.

Expected layout: eval/data/<language>/<sample>.wav and matching .txt transcript.
Run with --live to use the configured STT provider. This can consume API
credits; without --live, the script only validates the dataset and reports
that no recognition scores were calculated.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


def load_pairs(data_dir: Path) -> list[tuple[Path, str, str]]:
    """Load WAV/reference-text pairs grouped by language directory."""
    pairs: list[tuple[Path, str, str]] = []
    if not data_dir.exists():
        return pairs
    for language_dir in sorted(data_dir.iterdir()):
        if not language_dir.is_dir():
            continue
        for wav_file in sorted(language_dir.glob("*.wav")):
            transcript_file = wav_file.with_suffix(".txt")
            if not transcript_file.is_file():
                continue
            reference = transcript_file.read_text(encoding="utf-8-sig").strip()
            if reference:
                pairs.append((wav_file, reference, language_dir.name))
    return pairs


def word_error_rate(reference: str, hypothesis: str) -> float:
    """Compute WER using word-level Levenshtein distance."""
    ref_words = reference.split()
    hyp_words = hypothesis.split()
    if not ref_words:
        return 0.0 if not hyp_words else 1.0
    previous = list(range(len(hyp_words) + 1))
    for i, ref_word in enumerate(ref_words, start=1):
        current = [i]
        for j, hyp_word in enumerate(hyp_words, start=1):
            substitution_cost = 0 if ref_word.casefold() == hyp_word.casefold() else 1
            current.append(min(
                previous[j] + 1,       # deletion
                current[j - 1] + 1,     # insertion
                previous[j - 1] + substitution_cost,
            ))
        previous = current
    return previous[-1] / len(ref_words)


def evaluate(data_root: str | Path = "eval/data", stt: Any | None = None) -> dict[str, Any]:
    """Calculate WER only when an actual STT adapter is supplied."""
    pairs = load_pairs(Path(data_root))
    if not pairs:
        return {
            "message": "No labelled WAV/transcript pairs found.",
            "expected_layout": "eval/data/<language>/<sample>.wav and <sample>.txt",
            "scored_samples": 0,
        }
    if stt is None:
        return {
            "message": "Dataset found, but no WER was calculated. Re-run with --live to use configured STT.",
            "dataset_pairs": len(pairs),
            "scored_samples": 0,
            "wer": None,
        }
    if not getattr(stt, "available", False):
        return {
            "message": "STT provider is not configured; no WER was calculated.",
            "dataset_pairs": len(pairs),
            "scored_samples": 0,
            "wer": None,
        }

    per_language: dict[str, list[float]] = {}
    sample_results: list[dict[str, Any]] = []
    for wav_path, reference, language in pairs:
        hypothesis = stt.transcribe(wav_path.read_bytes(), wav_path.name, language)
        score = word_error_rate(reference, hypothesis)
        per_language.setdefault(language, []).append(score)
        sample_results.append({
            "file": wav_path.name,
            "language": language,
            "wer": score,
        })

    all_scores = [score for scores in per_language.values() for score in scores]
    return {
        "scored_samples": len(all_scores),
        "overall_wer": sum(all_scores) / len(all_scores),
        "per_language_wer": {
            language: sum(scores) / len(scores)
            for language, scores in sorted(per_language.items())
        },
        "sample_results": sample_results,
        "synthetic_or_real": "depends on supplied WAV files; inspect dataset provenance",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", default="eval/data", help="Dataset directory")
    parser.add_argument(
        "--live",
        action="store_true",
        help="Use configured STT provider (may use API credits).",
    )
    args = parser.parse_args()
    stt = None
    if args.live:
        from runtime import build_runtime

        stt = build_runtime().stt
    print(json.dumps(evaluate(args.data, stt=stt), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
