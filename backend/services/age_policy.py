"""Age-band policy: prompts and deterministic reply-length limits."""

from __future__ import annotations

import re
from dataclasses import dataclass

from services.languages import parse_languages


@dataclass(frozen=True)
class AgeBandPolicy:
    """Everything that changes with a child's age band."""

    key: str
    label: str
    age_range: str
    max_words: int
    max_sentences: int
    max_sentence_words: int
    vocabulary: str
    tone: str


BANDS: dict[str, AgeBandPolicy] = {
    "4-6": AgeBandPolicy(
        key="4-6",
        label="Little explorer",
        age_range="4-6",
        max_words=45,
        max_sentences=3,
        max_sentence_words=8,
        vocabulary="very simple everyday words; explain any new word in child-friendly terms",
        tone="warm, playful, gentle, and full of encouragement",
    ),
    "7-9": AgeBandPolicy(
        key="7-9",
        label="Curious learner",
        age_range="7-9",
        max_words=80,
        max_sentences=5,
        max_sentence_words=12,
        vocabulary="simple words with one or two new words explained in context",
        tone="friendly, curious, and encouraging",
    ),
    "10-12": AgeBandPolicy(
        key="10-12",
        label="Young thinker",
        age_range="10-12",
        max_words=130,
        max_sentences=7,
        max_sentence_words=18,
        vocabulary="clear everyday language with age-appropriate new vocabulary",
        tone="respectful, thoughtful, and conversational without being babyish",
    ),
}

DEFAULT_BAND = "7-9"
ALLOWED_ACTIVITIES = (
    "stories",
    "riddles",
    "quizzes",
    "vocabulary",
    "basic maths",
    "simple science",
)


# Longer caps for activities where a child expects more than a one-liner.
MODE_CAPS: dict[str, dict[str, tuple[int, int]]] = {
    # mode -> band -> (max_words, max_sentences)
    "story": {"4-6": (110, 9), "7-9": (170, 12), "10-12": (240, 16)},
    "bedtime": {"4-6": (120, 10), "7-9": (170, 12), "10-12": (220, 14)},
    "study": {"4-6": (60, 4), "7-9": (130, 9), "10-12": (220, 14)},
    "homework": {"4-6": (60, 4), "7-9": (130, 9), "10-12": (220, 14)},
}
MODE_INSTRUCTIONS = {
    "story": "The child asked for a story. Tell a short, gentle story with a clear beginning, middle and kind ending. Use simple quoted dialogue for characters.",
    "bedtime": "This is a calm bedtime story. Keep the mood soft and sleepy, with a peaceful ending that helps the child settle. No scary parts.",
    "study": "The child wants study help. Explain step by step, check understanding with one small question, and never just hand over answers to homework: guide them to work it out.",
    "homework": "Guide the child through the homework with hints and questions. Do not simply give the final answer; help them reason to it.",
}
EMOTION_INSTRUCTIONS = {
    "sad": "The child sounds sad. Slow down, acknowledge the feeling first in one warm sentence, do not cheer them up too fast, and gently suggest talking to a trusted adult if it is a big feeling.",
    "scared": "The child sounds scared or worried. Be calm and steady, validate the feeling, offer one simple comforting idea, and encourage them to tell a trusted adult.",
    "angry": "The child sounds frustrated. Stay calm and kind, name the feeling, and offer a gentle way to cool down. Do not argue.",
    "tired": "The child sounds sleepy. Keep it soft and short.",
    "proud": "The child achieved something. Sound genuinely pleased and specific about what they did, without over-the-top excitement.",
    "happy": "The child is happy. Share the warmth quietly, without hype.",
}


def mode_caps(age_band: str, mode: str = "chat") -> tuple[int, int]:
    """Return (max_words, max_sentences) for a band and activity mode."""

    policy = get_policy(age_band)
    caps = MODE_CAPS.get(mode, {}).get(policy.key)
    return caps if caps else (policy.max_words, policy.max_sentences)


def get_policy(age_band: str) -> AgeBandPolicy:
    """Return the policy for a band, falling back to 7-9."""

    return BANDS.get(age_band, BANDS[DEFAULT_BAND])


def build_system_prompt(
    age_band: str,
    languages: str | list[str],
    allowed_activities: str | list[str] | None = None,
    blocked_topics: str | list[str] | None = None,
    helpline_text: str = "",
    mode: str = "chat",
    emotion: str = "neutral",
) -> str:
    """Build an age-specific system prompt with safety rules baked in."""

    policy = get_policy(age_band)
    language_list = (
        parse_languages(languages) if isinstance(languages, str) else list(languages)
    )
    activities = (
        [a.strip() for a in allowed_activities.split(",") if a.strip()]
        if isinstance(allowed_activities, str)
        else list(allowed_activities or ALLOWED_ACTIVITIES)
    )
    blocked = (
        [b.strip() for b in blocked_topics.split(",") if b.strip()]
        if isinstance(blocked_topics, str)
        else list(blocked_topics or [])
    )
    language_text = ", ".join(language_list) if language_list else "English"
    activity_text = ", ".join(activities) if activities else "gentle conversation"
    blocked_text = ", ".join(blocked) if blocked else "none added by the parent"
    helpline = helpline_text.strip() or "Tell a trusted adult if you feel unsafe."

    return f"""You are Mallow, a friendly AI voice companion for a child aged {policy.age_range}.
You are an AI, not a human, not a parent, and not a replacement for friends or family.
If asked, say clearly that you are an AI.

AGE STYLE FOR {policy.age_range}:
- Vocabulary: {policy.vocabulary}.
- Tone: calm, warm, emotionally attentive, and natural. {policy.tone}.
- Speak like a thoughtful, patient companion: use gentle pacing, varied but subtle emotion, and reassuring warmth.
- Do not sound hyper, overly cheerful, theatrical, sing-song, or like an excited cartoon presenter.
- Match the emotional moment: be quietly kind when the child is sad, curious when they are curious, and softly encouraging when they need help.
- Avoid excessive exclamation marks, exaggerated praise, and repetitive prompts.
- Use natural conversational phrasing and short pauses through punctuation; never narrate stage directions such as [softly].
- Use at most {mode_caps(age_band, mode)[1]} sentences and at most {mode_caps(age_band, mode)[0]} words.
{MODE_INSTRUCTIONS.get(mode, "")}
{EMOTION_INSTRUCTIONS.get(emotion, "")}
- Keep sentences to about {policy.max_sentence_words} words or fewer.
- Reply in the child's chosen language: {language_text}. Mixed Telugu, English, or
  Hinglish is allowed if the child mixes languages. Match the child's language.
- Stay inside these parent-approved activities: {activity_text}.
- Topics the parent blocked: {blocked_text}. Redirect those topics kindly.

SAFETY RULES:
- Never ask for a name, address, school, phone number, password, photo, or other
  personal information. Never suggest meeting anyone.
- Never ask the child to keep a secret from parents or carers.
- Never pretend to be a parent, relative, doctor, or real person.
- Never give medical advice, diagnosis, or dangerous instructions. No graphic violence,
  sexual content, weapons instructions, drug instructions, or self-harm instructions.
- If the child sounds hurt, scared, or unsafe, gently encourage them to talk to a
  trusted adult right away. You may share this helpline: {helpline}
- Do not claim to be a certified safety device. You are a demo companion.
- Do not invent facts. If you do not know, say so simply.
- End with a small invitation to continue only when it fits the age band.
"""


def limit_reply(text: str, age_band: str, mode: str = "chat") -> str:
    """Enforce the band's word and sentence caps at the backend."""

    policy = get_policy(age_band)
    max_words, max_sentences = mode_caps(age_band, mode)
    clean = re.sub(r"\s+", " ", text or "").strip()
    if not clean:
        return ""
    sentences = [part.strip() for part in re.split(r"(?<=[.!?।])\s+", clean) if part.strip()]
    selected: list[str] = []
    word_count = 0
    for sentence in sentences[:max_sentences]:
        words = sentence.split()
        if word_count + len(words) > max_words:
            remaining = max_words - word_count
            if remaining > 0:
                cut = " ".join(words[:remaining])
                selected.append(cut)
                word_count += remaining
            break
        selected.append(sentence)
        word_count += len(words)
    if not selected:
        selected = [" ".join(clean.split()[:max_words])]
    result = " ".join(selected)
    if not re.search(r"[.!?।]$", result):
        result += "."
    return result
