"""AI companions for parents and for the Infant Care section.

These companions are deliberately separate from the child chat pipeline:

* the audience is always an adult (a parent or carer), never a child;
* the tone is warm, calm and non-judgemental, not a children's presenter;
* urgent safety language is handled deterministically before any model call,
  so a mother in distress always gets an immediate, compassionate response;
* replies never diagnose, never promise secrecy, and always separate general
  information from medical advice.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from config import AppConfig
from database.db import Database
from services.age import age_in_months, parse_dob
from services.errors import ServiceError
from services.llm_service import LLMAdapter

PARENT_HELPLINES = (
    "If you might act on thoughts of harming yourself or your baby, please contact "
    "emergency services now (112 in India) or go to the nearest emergency department. "
    "You can also call Tele-MANAS on 14416 (India, 24/7) or iCall on +91 9152987821. "
    "If you can, ask a trusted person to stay with you and help keep your baby safe."
)

URGENT_PATTERNS = (
    r"\b(kill|hurt|harm)\s+(myself|me)\b",
    r"\b(i\s*(want|wanna|am going|'m going)\s+to\s+(die|end (my|it all)|kill myself))\b",
    r"\b(end my life|end it all|take my (own )?life)\b",
    r"\b(suicid\w*|self[- ]harm|cut myself|overdose)\b",
    r"\b(don'?t|do not)\s+want\s+to\s+(live|be here|wake up)\b",
    r"\b(better off|no one would miss me|nobody would miss me|wish i (was|were) dead)\b",
    r"\b(hurt|harm|kill|shake|drop|hit)\s+(my\s+)?(baby|child|son|daughter|infant|newborn)\b",
    r"\b(afraid|scared|worried)\s+(i|that i)\s+(will|might|could)\s+(hurt|harm|shake)\s+(my\s+)?(baby|child)\b",
    r"\bpostpartum\s+psychosis\b",
    r"ఆత్మహత్య|నా బిడ్డను|నన్ను చంప",
    r"khud\s+ko\s+(maar|hurt|khatam)|marna\s+chahti|bachche\s+ko\s+(maar|chot)",
)

# Clearly unsafe requests that must not be answered even for an adult.
UNSAFE_REQUEST_PATTERNS = (
    r"\bhow\s+(to|do i|can i)\s+(make|build)\s+(a\s+|some\s+)?(bomb|explosive|gun)\b",
    r"\bhow\s+(to|do i)\s+(kill|poison|hurt)\s+(someone|my\s+(husband|partner|baby|child))\b",
    r"\bbest\s+way\s+to\s+(die|kill myself)\b",
    r"\bwhat\s+(dose|dosage|amount)\s+of\s+\w+\s+(should|can)\s+i\s+give\s+(my\s+)?(baby|child|infant)\b",
)

URGENT_REPLY = (
    "Thank you for telling me. I am really glad you did, and I am taking this seriously. "
    "I am an AI companion, not an emergency service, and I cannot promise to keep this private. "
    "You deserve real support right now, not to carry this alone.\n\n"
    f"{PARENT_HELPLINES}\n\n"
    "If you are having frightening thoughts about your baby, that can be part of a severe "
    "postpartum illness and it needs urgent medical help, not blame. If you can, place your baby "
    "somewhere safe with another trusted adult while you get help. You are not a bad parent for "
    "having these thoughts. Please reach out to a doctor, midwife or emergency service now."
)

UNSAFE_REPLY = (
    "I can't help with that, because it could cause serious harm. I can still stay with you and "
    "talk about what is going on, and I can help you find appropriate medical or emergency support. "
    "If someone is in immediate danger, contact local emergency services now (112 in India)."
)

PARENT_SYSTEM = """You are Mallow, a calm and warm AI companion inside a parent dashboard.
You are speaking to a parent or carer, never to a child.

PURPOSE
- Help the parent understand their child's saved activity and development information.
- Offer practical, kind parenting suggestions and emotional support.
- Help them reflect, plan and feel less alone.

STYLE
- Warm, gentle, grounded and non-judgemental. Do not sound like an excited children's presenter.
- Use short, natural paragraphs. Avoid hype, excessive exclamation marks and bullet-point overload.
- Ask one gentle follow-up question when it helps.
- You may use text or speech, so write words that are comfortable to hear aloud.

STRICT SAFETY
- You are not a doctor, therapist, diagnostician or crisis service. Never diagnose any condition.
- Clearly separate general information from medical advice. Say "I can't diagnose" when relevant.
- Never minimise, shame or dismiss feelings. Validate first.
- Do not promise secrecy. Be honest that this is an AI companion.
- For urgent risk of self-harm, suicide, or harm to a child, encourage immediate help from a trusted
  person and emergency/medical services. Do not try to manage a crisis alone.
- Do not provide unsafe medication, feeding or infant-care instructions. For dosage, feeding or
  worrying symptoms, tell them to speak to their paediatrician, midwife or doctor.
- Never invent facts about the child. Only use the information provided below.

CHILD CONTEXT
{child_context}

Remember: supportive companion, not a clinician. Keep replies under about 180 words unless the
parent explicitly asks for more detail.
"""

INFANT_SYSTEM = """You are Mallow, a gentle companion inside the Infant Care section of a family app.
You are speaking to a mother or parent of a baby aged 0-3, never to a child.

PURPOSE
- Listen when they talk about feeding, sleep, development, milestones, exhaustion or loneliness.
- Offer warm, practical, general information and emotional support.
- Make it easy to talk naturally without choosing a category.
- Help them feel understood and less alone.

STYLE
- Soft, patient, human and non-judgemental. Never rushed or over-enthusiastic.
- Validate the feeling before offering any information.
- Do not imply they are doing something wrong. Never shame them for feeding, sleep or bonding difficulties.
- Keep replies under about 180 words unless more detail is clearly needed.

STRICT SAFETY
- You are not a doctor, midwife, therapist or diagnostician. Never diagnose postpartum depression,
  postpartum anxiety, postpartum psychosis or any other condition.
- It is okay to mention that persistent low mood, anxiety, hopelessness or scary thoughts can be signs
  that a professional should assess, but always say only a qualified professional can diagnose.
- Clearly distinguish general information from medical advice.
- Encourage professional support when symptoms may indicate postpartum depression or another health
  concern, and encourage them to contact their doctor, midwife, health visitor or local service.
- For urgent concerns involving self-harm, suicide, or risk to the baby, respond seriously and
  compassionately, encourage immediate help from a trusted person and appropriate emergency or
  medical services. Do not promise secrecy.
- Do not give medication, dosage, or unsafe infant-care instructions. For amounts, feeding plans,
  sleep safety or worrying symptoms, direct them to their paediatrician or doctor.
- Never blame the parent. Never say "just relax" or "it's normal" as a way to dismiss a concern.

BABY CONTEXT (only this baby; never mix profiles)
{child_context}

Remember: a supportive companion, not a clinician.
"""


@dataclass(frozen=True)
class CompanionReply:
    reply: str
    urgent: bool = False
    unsafe: bool = False
    provider_error: bool = False
    message_id: int | None = None


def _matches(text: str, patterns: tuple[str, ...]) -> bool:
    lowered = (text or "").casefold()
    return any(re.search(pattern, lowered, flags=re.IGNORECASE) for pattern in patterns)


def _safe_offline_reply(audience: str) -> str:
    if audience == "infant":
        return (
            "I'm here with you. I can listen, but my full AI connection is not available right now, "
            "so I can only offer simple support. If you are struggling, please tell someone you trust "
            "and speak to your doctor or midwife. You do not have to cope alone."
        )
    return (
        "I'm here with you. My full AI connection is not available right now, so I can only offer "
        "simple support. If something feels urgent or unsafe, please contact a trusted person and "
        "appropriate medical or emergency services."
    )


class CompanionService:
    """Parent and infant-care conversations with adult-appropriate safety."""

    def __init__(self, db: Database, config: AppConfig, llm: LLMAdapter) -> None:
        self.db = db
        self.config = config
        self.llm = llm

    # ------------------------------------------------------------- storage
    def history(self, audience: str, child_id: int | None, limit: int = 8) -> list[dict]:
        if child_id is None:
            rows = self.db.query(
                "SELECT * FROM companion_messages WHERE audience = ? AND child_id IS NULL "
                "ORDER BY id DESC LIMIT ?",
                (audience, limit),
            )
        else:
            rows = self.db.query(
                "SELECT * FROM companion_messages WHERE audience = ? AND child_id = ? "
                "ORDER BY id DESC LIMIT ?",
                (audience, child_id, limit),
            )
        return list(reversed(rows))

    def recent(self, audience: str, child_id: int | None, limit: int = 40) -> list[dict]:
        if child_id is None:
            rows = self.db.query(
                "SELECT id, role, text, language, created_at FROM companion_messages "
                "WHERE audience = ? AND child_id IS NULL ORDER BY id DESC LIMIT ?",
                (audience, limit),
            )
        else:
            rows = self.db.query(
                "SELECT id, role, text, language, created_at FROM companion_messages "
                "WHERE audience = ? AND child_id = ? ORDER BY id DESC LIMIT ?",
                (audience, child_id, limit),
            )
        return list(reversed(rows))

    def _store(self, audience: str, child_id: int | None, role: str, text: str, language: str) -> int:
        return self.db.execute(
            "INSERT INTO companion_messages (audience, child_id, role, text, language) "
            "VALUES (?, ?, ?, ?, ?)",
            (audience, child_id, role, text, language),
        )

    # ------------------------------------------------------------ context
    def _child_context(self, audience: str, child_id: int | None) -> str:
        if child_id is None:
            return (
                "No specific child is selected. Do not invent details about any child. If the parent "
                "asks about a particular child, invite them to open that child's page so you can use "
                "only that child's saved information."
            )
        child = self.db.get_child(child_id)
        if not child:
            return "No child profile is available. Do not invent details."
        nickname = child.get("nickname") or "your child"
        dob = parse_dob(child.get("dob")) if child.get("dob") else None
        if audience == "infant":
            months = age_in_months(dob) if dob else None
            age_text = f"about {months} months old" if months is not None else "under 4 years old"
            counts = self.db.query(
                "SELECT event_type, COUNT(*) AS n FROM infant_care WHERE child_id = ? "
                "AND timestamp >= date('now', '-7 day') GROUP BY event_type",
                (child_id,),
            )
            logged = ", ".join(f"{row['n']} {row['event_type']} entries" for row in counts)
            last = self.db.query_one(
                "SELECT event_type, timestamp, subtype FROM infant_care WHERE child_id = ? "
                "ORDER BY timestamp DESC, id DESC LIMIT 1",
                (child_id,),
            )
            last_text = (
                f"The most recent log was {last['event_type']} ({last['subtype'] or 'no subtype'})."
                if last
                else "No care entries have been logged yet."
            )
            return (
                f"Baby profile: {nickname}, {age_text}. Parent-entered logs in the last 7 days: "
                f"{logged or 'none'}. {last_text} These are parent-entered records only. Never "
                "interpret them as normal, abnormal, or diagnostic."
            )
        months = age_in_months(dob) if dob else None
        age_text = f"age band {child.get('age_band')}, about {months} months" if months is not None else f"age band {child.get('age_band')}"
        activities = self.db.query(
            "SELECT kind, COUNT(*) AS n FROM activities WHERE child_id = ? "
            "AND created_at >= datetime('now', '-7 day') GROUP BY kind ORDER BY n DESC LIMIT 6",
            (child_id,),
        )
        activity_text = ", ".join(f"{row['kind']} x{row['n']}" for row in activities) or "none logged"
        sessions = self.db.query_one(
            "SELECT COUNT(*) AS n FROM sessions WHERE child_id = ? AND started_at >= datetime('now', '-7 day')",
            (child_id,),
        )
        open_flags = self.db.query_one(
            "SELECT COUNT(*) AS n FROM safety_incidents WHERE child_id = ? AND reviewed_at IS NULL",
            (child_id,),
        )
        return (
            f"Child profile: {nickname}, {age_text}. Parent-entered activity in the last 7 days: "
            f"{activity_text}. Conversations started: {int((sessions or {}).get('n') or 0)}. "
            f"Open safety notes for parent review: {int((open_flags or {}).get('n') or 0)}. "
            "Use only this child's information. Never mix in another child's data. These are saved "
            "activity records, not a clinical assessment."
        )

    # -------------------------------------------------------------- reply
    def respond(
        self,
        audience: str,
        text: str,
        language: str = "English",
        child_id: int | None = None,
    ) -> CompanionReply:
        if audience not in ("parent", "infant"):
            raise ValueError("Unknown companion audience")
        clean = (text or "").strip()
        if not clean:
            raise ValueError("Message is empty")

        prior = self.history(audience, child_id)
        self._store(audience, child_id, "user", clean, language)

        if _matches(clean, URGENT_PATTERNS):
            message_id = self._store(audience, child_id, "assistant", URGENT_REPLY, language)
            return CompanionReply(reply=URGENT_REPLY, urgent=True, message_id=message_id)

        if _matches(clean, UNSAFE_REQUEST_PATTERNS):
            message_id = self._store(audience, child_id, "assistant", UNSAFE_REPLY, language)
            return CompanionReply(reply=UNSAFE_REPLY, unsafe=True, message_id=message_id)

        if not self.llm.available:
            reply = _safe_offline_reply(audience)
            message_id = self._store(audience, child_id, "assistant", reply, language)
            return CompanionReply(reply=reply, provider_error=True, message_id=message_id)

        template = INFANT_SYSTEM if audience == "infant" else PARENT_SYSTEM
        system = template.format(child_context=self._child_context(audience, child_id))
        system += f"\nThe parent is writing in {language}. Reply in {language}."
        messages: list[dict[str, str]] = [{"role": "system", "content": system}]
        for row in prior:
            messages.append(
                {
                    "role": "user" if row["role"] == "user" else "assistant",
                    "content": row["text"],
                }
            )
        messages.append({"role": "user", "content": clean})

        try:
            reply = self.llm.chat(messages, temperature=0.5, max_tokens=520)
        except ServiceError:
            reply = _safe_offline_reply(audience)
            message_id = self._store(audience, child_id, "assistant", reply, language)
            return CompanionReply(reply=reply, provider_error=True, message_id=message_id)

        reply = self._guard_reply(reply, audience)
        message_id = self._store(audience, child_id, "assistant", reply, language)
        return CompanionReply(reply=reply, message_id=message_id)

    def _guard_reply(self, reply: str, audience: str) -> str:
        """Remove direct diagnosis claims and add an honest boundary."""

        cleaned = reply.strip()
        diagnosis = re.compile(
            r"\byou\s+(definitely\s+)?have\s+(postpartum\s+depression|postpartum\s+anxiety|"
            r"postpartum\s+psychosis|depression|anxiety\s+disorder)\b",
            re.IGNORECASE,
        )
        if diagnosis.search(cleaned):
            cleaned = diagnosis.sub(
                "what you are describing may need a professional assessment", cleaned
            )
            cleaned += (
                "\n\nOnly a qualified doctor or mental-health professional can diagnose a condition."
            )
        support_topic = re.search(
            r"\b(sad|low|anxious|anxiety|depress\w*|exhaust\w*|overwhelm\w*|cry|crying|"
            r"hopeless|scared|afraid|angry|lonely|guilt\w*|worr\w*|struggl\w*)\b",
            cleaned,
            re.IGNORECASE,
        )
        if (
            audience == "infant"
            and support_topic
            and not re.search(
                r"\b(doctor|midwife|paediatrician|professional|medical)\b", cleaned, re.IGNORECASE
            )
        ):
            cleaned += (
                "\n\nIf this keeps weighing on you, it is worth mentioning to your doctor or midwife. "
                "You deserve support, and asking for it is a sign of strength."
            )
        return cleaned
