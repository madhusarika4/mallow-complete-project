"""Emotion-aware delivery for Mallow's voice.

HONEST LIMITS: the free Edge TTS endpoint only honours *rate, pitch and volume*.
It ignores expressive SSML styles (mstts:express-as), so Mallow cannot literally
"sound sad". What this module does instead is real, measurable prosody work:

* a per-mood delivery profile (rate / pitch / volume),
* sentence-level synthesis so the delivery can change across a reply,
* short silences between sentences and a longer breath at paragraph ends,
* distinct (modest) pitch for quoted character speech in stories,
* a calmer, slower profile when the child sounds sad or scared.

Profiles live in one table (PROFILES) so the voice can be tuned in one place or
overridden from the environment (MALLOW_VOICE_RATE_ADJUST, MALLOW_VOICE_PITCH_ADJUST).
"""

from __future__ import annotations

import base64
import os
import re
from dataclasses import dataclass

# ~0.28 s of silence encoded like Edge output (24 kHz mono 48 kbps MP3).
_SILENCE_B64 = (
    "//NkxAAAAANIAAAAAExBTUVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwA"
    "AANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAA"
    "AFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVV"
    "VVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1F"
    "My4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//Nk"
    "xHwAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
)
SILENCE_MP3 = base64.b64decode(_SILENCE_B64)


@dataclass(frozen=True)
class Prosody:
    rate: int = 0  # percent, negative = slower
    pitch: int = 0  # Hz
    volume: int = 0  # percent
    pause_ms: int = 280  # silence after each sentence group

    def rate_str(self) -> str:
        return f"{_clamp(self.rate + _env_int('MALLOW_VOICE_RATE_ADJUST'), -40, 30):+d}%"

    def pitch_str(self) -> str:
        return f"{_clamp(self.pitch + _env_int('MALLOW_VOICE_PITCH_ADJUST'), -30, 30):+d}Hz"

    def volume_str(self) -> str:
        return f"{_clamp(self.volume, -40, 20):+d}%"


def _clamp(value: int, low: int, high: int) -> int:
    return max(low, min(high, value))


def _env_int(name: str) -> int:
    try:
        return int(os.getenv(name, "0") or 0)
    except ValueError:
        return 0


PROFILES: dict[str, Prosody] = {
    "neutral": Prosody(rate=-4, pitch=-1),
    "explain": Prosody(rate=-7, pitch=-1),
    "comfort": Prosody(rate=-15, pitch=-3, volume=-8, pause_ms=420),
    "story": Prosody(rate=-10, pitch=0, pause_ms=380),
    "bedtime": Prosody(rate=-18, pitch=-4, volume=-10, pause_ms=520),
    "celebrate": Prosody(rate=-2, pitch=2, pause_ms=240),
    "curious": Prosody(rate=-5, pitch=1),
}
QUOTE_PITCH_SHIFT = 4  # Hz, applied to text inside quotation marks in stories

# child emotion -> how Mallow should sound back
EMOTION_TO_MOOD = {
    "sad": "comfort",
    "scared": "comfort",
    "angry": "comfort",
    "tired": "bedtime",
    "happy": "celebrate",
    "proud": "celebrate",
    "curious": "curious",
    "neutral": "neutral",
}


def mood_for(emotion: str, mode: str = "chat") -> str:
    """Choose a delivery profile from the child's emotion and the activity mode."""

    if emotion in ("sad", "scared", "angry"):
        return "comfort"
    if mode == "bedtime":
        return "bedtime"
    if mode == "story":
        return "story"
    if mode in ("explain", "study", "homework"):
        return "explain"
    return EMOTION_TO_MOOD.get(emotion, "neutral")


@dataclass(frozen=True)
class Segment:
    text: str
    prosody: Prosody
    pause_after: bool = True


_SENT_SPLIT = re.compile(r"(?<=[.!?\u0964\u2026])\s+")
_QUOTE = re.compile(r"([\"\u201c][^\"\u201d]+[\"\u201d])")


def plan_segments(text: str, mood: str = "neutral", max_segments: int = 8) -> list[Segment]:
    """Split a reply into prosody-annotated segments (1-2 sentences each)."""

    profile = PROFILES.get(mood, PROFILES["neutral"])
    clean = re.sub(r"[*_#`]+", "", text or "")
    clean = re.sub(r"\s+", " ", clean).strip()
    if not clean:
        return []
    sentences = [s for s in _SENT_SPLIT.split(clean) if s.strip()]
    # Group short sentences so we do not make many tiny requests.
    groups: list[str] = []
    for sentence in sentences:
        if (
            groups
            and len(groups[-1]) + len(sentence) < 90
            and not _QUOTE.search(sentence)
            and not _QUOTE.search(groups[-1])
        ):
            groups[-1] += " " + sentence
        else:
            groups.append(sentence)
    while len(groups) > max_segments:  # merge the shortest neighbours
        index = min(range(len(groups) - 1), key=lambda i: len(groups[i]) + len(groups[i + 1]))
        groups[index : index + 2] = [groups[index] + " " + groups[index + 1]]
    segments: list[Segment] = []
    for position, group in enumerate(groups):
        prosody = profile
        if mood == "story" and _QUOTE.search(group):
            prosody = Prosody(
                rate=profile.rate + 2,
                pitch=profile.pitch + QUOTE_PITCH_SHIFT,
                volume=profile.volume,
                pause_ms=profile.pause_ms,
            )
        if mood == "comfort" and position == len(groups) - 1:
            prosody = Prosody(  # settle gently on the last line
                rate=profile.rate - 3, pitch=profile.pitch, volume=profile.volume - 2,
                pause_ms=profile.pause_ms,
            )
        segments.append(Segment(group, prosody, pause_after=position < len(groups) - 1))
    return segments
