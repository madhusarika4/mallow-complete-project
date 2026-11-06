"""Server-side boundaries for learning conversations and usage classification."""

from __future__ import annotations

import re

EDUCATIONAL_MODES = frozenset({"study", "homework", "explain"})

_EDUCATIONAL_TOPIC = re.compile(
    r"\b(?:math(?:s|ematics)?|fractions?|algebra|geometry|equation|multiplication|division|"
    r"number|science|biology|chemistry|physics|photosynthesis|gravity|planet|experiment|"
    r"history|geography|map|country|capital|coding|code|programming|logic|reasoning|"
    r"vocabulary|word meaning|grammar|reading comprehension|book report|essay|"
    r"school subject|test|exam|study plan|project|research|rules of|reading|language learning|"
    r"గణితం|విజ్ఞానం|చరిత్ర|భూగోళం|పాఠం|ప్రయోగం|పదం|ప్రశ్న|"
    r"ganit|vigyan|itihaas|bhugol|padhai|homework|sawal|revision)\b",
    re.IGNORECASE,
)
_EDUCATIONAL_TASK = re.compile(
    r"\b(?:homework|lesson|quiz|revision|revise|vocabulary|grammar|reading comprehension|"
    r"study plan|educational story|story that teaches|class assignment|పాఠం|ప్రశ్న|"
    r"పరీక్ష|sawal|quiz|revision)\b",
    re.IGNORECASE,
)
_INSTRUCTIONAL_ACTION = re.compile(
    r"\b(?:learn|teach|explain|understand|solve|calculate|practice|revise|study|"
    r"help me|show me|quiz me|what is|how does|how do|why does|why is|compare|"
    r"summari[sz]e|read|tell me (?:a )?(?:fact|lesson)|వివరించు|నేర్పు|నేర్చుకో|"
    r"అర్థం చేసుకో|లెక్కించు|చదువు|సమాధానం|సికావో|సమ్జావో|సీఖో)\b",
    re.IGNORECASE,
)
_NON_LEARNING_INTENT = re.compile(
    r"\b(?:tell me (?:a )?(?:joke|secret)|make me laugh|let'?s chat|talk about my day|"
    r"how are you|what is your name|play pretend|bedtime story|i feel|i am (?:sad|lonely|"
    r"scared|worried|upset)|i'm (?:sad|lonely|scared|worried|upset))\b",
    re.IGNORECASE,
)
_FOLLOW_UP = re.compile(
    r"^(?:why\??|how\??|what about\b|can you show\b|show me\b|another example\b|"
    r"one more\b|again\??|go on\b|continue\b|what does that mean\??|"
    r"i (?:still )?don't understand\b|could you explain\b|and then\??)$",
    re.IGNORECASE,
)


def is_educational_turn(mode: str, text: str, prior_educational_turns: int = 0) -> bool:
    """Only approved learning modes and learning-focused prompts qualify.

    Short follow-ups qualify only after this same session already contains a
    verified educational turn. A mode label alone never grants free general chat.
    """
    if mode not in EDUCATIONAL_MODES:
        return False
    cleaned = " ".join(text.split()).strip()
    if not cleaned or _NON_LEARNING_INTENT.search(cleaned):
        return False
    if _EDUCATIONAL_TASK.search(cleaned) or (
        _EDUCATIONAL_TOPIC.search(cleaned) and _INSTRUCTIONAL_ACTION.search(cleaned)
    ):
        return True
    return prior_educational_turns > 0 and len(cleaned) <= 100 and bool(_FOLLOW_UP.fullmatch(cleaned))


def educational_boundary(language: str) -> str:
    return {
        "English": "This space is for learning. Choose Chat if you want to talk about something else.",
        "Telugu": "ఇది నేర్చుకోవడానికి ఉన్న సమయం. వేరే విషయం మాట్లాడాలంటే Chat ఎంచుకో.",
        "Hinglish": "Yeh learning ka space hai. Kisi aur baat ke liye Chat chuno.",
    }.get(language, "This space is for learning. Choose Chat if you want to talk about something else.")
