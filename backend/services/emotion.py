"""Lightweight, transparent child-emotion detection (keyword rules, 3 languages).

This is intentionally simple and only steers *tone* (the reply prompt and voice
prosody). It is not a diagnosis and it never raises a safety flag by itself.
"""

from __future__ import annotations

import re

from services.safety_service import normalise

_RULES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("sad", (
        r"\b(sad|cry|crying|cried|lonely|miss (my|him|her)|unhappy|upset|nobody (likes|plays)|"
        r"no one (likes|plays)|left out|feel bad|not feeling good|dukhi|udaas|rona aa raha|"
        r"bahut bura lag raha)\b",
        r"\u0c1a\u0c3e\u0c32\u0c3e \u0c2c\u0c3e\u0c27|\u0c0f\u0c21\u0c4d\u0c9a|\u0c2c\u0c3e\u0c27\u0c17\u0c3e",
    )),
    ("scared", (
        r"\b(scared|afraid|frightened|nightmare|bad dream|worried|nervous|darr|dar lag|"
        r"daravna)\b",
        r"\u0c2d\u0c2f\u0c02",
    )),
    ("angry", (
        r"\b(angry|mad at|hate|furious|so annoyed|annoying|gussa|gusse)\b",
        r"\u0c15\u0c4b\u0c2a",
    )),
    ("tired", (
        r"\b(sleepy|tired|can'?t sleep|bedtime|good night|goodnight|neend|so sleepy)\b",
        r"\u0c28\u0c3f\u0c26\u0c4d\u0c30",
    )),
    ("proud", (
        r"\b(i did it|i won|i passed|i finished|i made|full marks|top of the class|got an a|"
        r"mujhe prize mila|jeet gaya|jeet gayi)\b",
    )),
    ("happy", (
        r"\b(happy|so excited|yay|awesome|i love|best day|khush|mazaa aaya|maza aaya)\b",
        r"\u0c38\u0c02\u0c24\u0c4b\u0c37",
    )),
    ("curious", (
        r"\b(why|how come|how does|what happens|i wonder|kyun|kaise|enduku|ela)\b",
    )),
)


def detect_emotion(text: str) -> str:
    """Return one of sad, scared, angry, tired, proud, happy, curious, neutral."""

    value = normalise(text)
    for emotion, patterns in _RULES:
        if any(re.search(p, value, flags=re.IGNORECASE) for p in patterns):
            return emotion
    return "neutral"
