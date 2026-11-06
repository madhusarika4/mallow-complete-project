"""A small, honest, free, no-key companion used when no LLM provider is configured.

It is rule-based: greetings, comfort, simple maths, riddles, a few built-in
stories and 'who are you'. It never pretends to be a full AI model; the UI
labels this as "offline mode". Telugu and Hinglish coverage is deliberately
small (greetings, comfort, one story each).
"""

from __future__ import annotations

import random
import re
from typing import Any

from services.llm_service import LLMAdapter, Message

STORIES_EN = [
    "Once there was a little bunny named Mallow. One sunny morning Mallow found a tiny blue button under a leaf. "
    "\"Whose button is this?\" she wondered. She asked a snail, a bee and a sleepy frog. At last a small girl came by, "
    "looking sad because her teddy bear had lost its button. \"Thank you, Mallow!\" she smiled. Mallow felt warm inside, "
    "because helping a friend is a lovely thing to do. The end.",
    "A small cloud named Pip floated over a quiet garden. The flowers were thirsty. \"Can you help us?\" they whispered. "
    "Pip took a deep breath and let a soft rain fall, drop by drop. The garden woke up in pinks and yellows. "
    "Pip felt proud and drifted off to sleep. The end.",
    "Under a big oak tree lived a hedgehog named Hazel who was afraid of the dark. One night a firefly sat on her nose. "
    "\"I will light the way,\" it said. Together they walked and saw the stars shining. \"The dark is not so scary with a friend,\" "
    "said Hazel. She slept soundly all night. The end.",
]
STORY_HI = (
    "Ek baar ek chhota khargosh tha, uska naam Mallow tha. Ek din usne ek udaas titli dekhi. "
    "Mallow ne usse kaha, \"Chalo, saath khelte hain.\" Titli muskuraayi aur dono dost ban gaye. "
    "Raat ko Mallow aaram se so gaya. Khatam."
)
STORY_TE = (
    "ఒక చిన్న కుందేలు ఉండేది. దాని పేరు మల్లో. ఒక రోజు అది ఒక పెద్ద చెట్టు కింద కూర్చుంది. "
    "అక్కడ ఒక చిన్న పక్షి పాట పాడింది. మల్లో నవ్వింది, ఇద్దరూ స్నేహితులయ్యారు. "
    "ఆ రాత్రి మల్లో హాయిగా నిద్రపోయింది."
)
RIDDLES = [
    ("I have hands but cannot clap. What am I?", "A clock."),
    ("What has to be broken before you can use it?", "An egg."),
    ("I am full of holes but I still hold water. What am I?", "A sponge."),
    ("What gets wetter the more it dries?", "A towel."),
]
COMFORT = {
    "English": "I am sorry you feel that way. It is okay to have big feelings. I am here with you. Would you like to tell me more, or talk to a grown-up you trust?",
    "Hinglish": "Mujhe sunke bura laga. Bade feelings aana theek hai. Main yahan hoon. Kisi trusted grown-up se bhi baat kar sakte ho.",
    "Telugu": "నువ్వు అలా అనుకుంటున్నావని నాకు బాధగా ఉంది. నేను ఇక్కడే ఉన్నాను. నమ్మకమైన పెద్దవారితో కూడా మాట్లాడు.",
}
GREET = {
    "English": "Hello! I am Mallow, an AI helper. What would you like to do: a story, a riddle, or a question?",
    "Hinglish": "Namaste! Main Mallow hoon, ek AI helper. Kahani, paheli ya sawaal, kya karein?",
    "Telugu": "నమస్తే! నేను మల్లో, ఒక AI సహాయకుడిని. కథ, చిక్కు లేదా ప్రశ్న, ఏది చేద్దాం?",
}
_OPS = {"plus": "+", "+": "+", "add": "+", "minus": "-", "-": "-", "times": "*", "x": "*", "multiplied by": "*", "into": "*"}


def _context(messages: list[Message]) -> tuple[str, str, str]:
    system = next((m["content"] for m in messages if m["role"] == "system"), "")
    last = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
    lang = re.search(r"Current spoken language: (\w+)", system)
    band = re.search(r"aged (\d+-\d+)", system)
    return last, (lang.group(1) if lang else "English"), (band.group(1) if band else "7-9")


class OfflineCompanion(LLMAdapter):
    """Rule-based replies. `available` is False so the UI labels it honestly."""

    available = False

    def __init__(self, seed: int | None = None) -> None:
        self._rng = random.Random(seed)
        self.pending_riddle: str | None = None

    def chat(self, messages: list[Message], **_: Any) -> str:
        text, language, band = _context(messages)
        low = text.lower().strip()
        if self.pending_riddle and re.search(r"\b(give up|tell me|answer|don'?t know)\b", low):
            answer, self.pending_riddle = self.pending_riddle, None
            return f"The answer is: {answer} Want another riddle?"
        if re.search(r"\b(who|what) are you\b|\bare you (a )?(human|real|person|robot)\b|\btum kaun\b", low):
            return "I am Mallow, an AI helper. I am not a person, but I like chatting, stories and riddles with you."
        if re.search(r"\b(sad|cry|lonely|scared|afraid|nightmare|upset|dukhi|darr)\b", low):
            return COMFORT.get(language, COMFORT["English"])
        if re.search(r"\b(story|kahani|kahaani)\b|కథ", low):
            if language == "Telugu":
                return STORY_TE
            if language == "Hinglish":
                return STORY_HI
            return self._rng.choice(STORIES_EN)
        if "riddle" in low or "paheli" in low or "చిక్కు" in low:
            question, answer = self._rng.choice(RIDDLES)
            self.pending_riddle = answer
            return f"{question} Say 'give up' if you want the answer."
        math = re.search(r"(\d+)\s*(plus|minus|times|multiplied by|into|\+|-|x|\*)\s*(\d+)", low)
        if math:
            a, op, b = int(math.group(1)), _OPS.get(math.group(2), math.group(2)), int(math.group(3))
            value = a + b if op == "+" else a - b if op == "-" else a * b
            return f"{a} {math.group(2)} {b} is {value}. Nice thinking! Want to try another one?"
        if re.search(r"\b(hi|hello|hey|namaste|namaskaram)\b|నమస్తే", low):
            return GREET.get(language, GREET["English"])
        if re.search(r"\b(thank|thanks|dhanyavad)\b", low):
            return "You are welcome. I am happy to help."
        if re.search(r"\b(good ?night|sleepy|bedtime)\b", low):
            return "Good night. Sleep well, and have lovely dreams. I will be here tomorrow."
        return (
            "I am in offline mode, so I only know a few things: stories, riddles, easy maths and "
            "kind words. A grown-up can connect a full AI model in settings so I can answer anything. "
            "Want a story or a riddle?"
        )
