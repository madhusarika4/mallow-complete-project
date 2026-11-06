"""Child-facing endpoints: chat, voice, activities, creations, journal, projects."""

from __future__ import annotations

import json
from collections import OrderedDict
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

from mallow_api.deps import child_or_404, get_runtime, normalize_activities, require_parent
from mallow_api.timeutil import local_day_start_utc, local_today, utc_iso
from runtime import Runtime
from services.errors import ServiceError, VoiceDisabledError
from services.conversation_purpose import EDUCATIONAL_MODES
from services.languages import parse_languages
from services.prosody import mood_for
from services.safety_service import safe_reply

router = APIRouter()
Language = Literal["English", "Telugu", "Hinglish"]
Mode = Literal["chat", "story", "bedtime", "study", "homework", "explain"]
_TURN_CACHE: "OrderedDict[str, dict]" = OrderedDict()


def _owned_session(rt: Runtime, child_id: int, session_id: int) -> dict:
    session = rt.db.get_session(session_id)
    if not session or int(session["child_id"]) != child_id:
        raise HTTPException(404, "Conversation not found for this child")
    return session


def _check_language(child: dict, language: str) -> None:
    if language not in parse_languages(child["languages"]):
        raise HTTPException(422, f"{language} is not enabled for this child")


def _require_chat(child: dict) -> None:
    if child["age_band"] == "0-3":
        raise HTTPException(400, "Chat is not available for infant profiles")
    if "chat" not in normalize_activities(child.get("activities")):
        raise HTTPException(403, "Chat is turned off for this child by a parent")


# ------------------------------------------------------------------- chat
class SessionIn(BaseModel):
    child_id: int
    language: Language = "English"
    mode: Mode = "chat"


@router.post("/chat/session")
def open_session(body: SessionIn, rt: Runtime = Depends(get_runtime)):
    child = child_or_404(rt, body.child_id)
    _require_chat(child)
    _check_language(child, body.language)
    start = local_day_start_utc(local_today())
    rows = rt.db.query(
        "SELECT * FROM sessions WHERE child_id = ? AND activity = ? AND started_at >= ? "
        "ORDER BY id DESC LIMIT 1",
        (body.child_id, body.mode, start),
    )
    if rows:
        session_id = int(rows[0]["id"])
    else:
        purpose = "educational" if body.mode in EDUCATIONAL_MODES else "general"
        session_id = rt.controls.start_session(
            body.child_id, body.language, activity=body.mode, purpose=purpose
        )
    session = rt.db.get_session(session_id) or {}
    status = rt.controls.usage(child, session_id)
    return {
        "session_id": session_id,
        "limit_reached": body.mode not in EDUCATIONAL_MODES and not status.allowed,
        "purpose": session.get("purpose", "general"),
        "educational_turns": session.get("educational_turns", 0),
        "used_minutes": status.used_minutes,
        "limit_minutes": status.limit_seconds / 60,
        "messages": _messages(rt, body.child_id, session_id),
    }


def _messages(rt: Runtime, child_id: int, session_id: int) -> list[dict]:
    return [
        {"id": m["id"], "role": "child" if m["role"] == "child" else "mallow", "text": m["text"],
         "language": m["language"], "emotion": m.get("emotion", ""), "created_at": m["created_at"]}
        for m in rt.db.list_messages(session_id)
    ]


@router.get("/chat/session/{session_id}/messages")
def session_messages(session_id: int, child_id: int, rt: Runtime = Depends(get_runtime)):
    child_or_404(rt, child_id)
    _owned_session(rt, child_id, session_id)
    return _messages(rt, child_id, session_id)


class TurnIn(BaseModel):
    child_id: int
    session_id: int
    text: str = Field(min_length=1, max_length=600)
    language: Language = "English"
    mode: Mode = "chat"
    source: Literal["text", "voice"] = "text"
    client_turn_id: str | None = Field(default=None, max_length=64)
    context: str = Field(default="", max_length=1200)


@router.post("/chat/turn")
def chat_turn(body: TurnIn, rt: Runtime = Depends(get_runtime)):
    child = child_or_404(rt, body.child_id)
    _require_chat(child)
    _check_language(child, body.language)
    session = _owned_session(rt, body.child_id, body.session_id)
    if session.get("activity", "chat") != body.mode:
        raise HTTPException(409, "Open a conversation session for the selected mode")
    key = f"{body.child_id}:{body.session_id}:{body.mode}:{body.client_turn_id}" if body.client_turn_id else None
    if key and key in _TURN_CACHE:  # duplicate submission: replay, do not re-run
        return {**_TURN_CACHE[key], "duplicate": True}
    text = body.text.strip()
    if not text:
        raise HTTPException(422, "Message is empty")
    mode = body.mode
    result = rt.chat.respond(child, text, body.language, body.session_id, mode, body.context)
    rt.db.add_event(body.child_id, "turn", category=body.source, session_id=body.session_id)
    last = rt.db.list_messages(body.session_id)
    payload = {
        "reply": result.reply,
        "message_id": last[-1]["id"] if last else None,
        "blocked": result.blocked,
        "is_disclosure": result.is_disclosure,
        "limit_reached": result.limit_reached,
        "offline": result.fallback_mode and not rt.config.llm_enabled,
        "provider_error": bool(result.error),
        "emotion": result.emotion,
        "mood": result.mood,
        "safety_layer": result.safety_layer,
        "helpline": rt.config.helpline_text if result.is_disclosure else None,
        "duplicate": False,
    }
    if key:
        _TURN_CACHE[key] = payload
        while len(_TURN_CACHE) > 300:
            _TURN_CACHE.popitem(last=False)
    return payload


# ------------------------------------------------------------------ voice
@router.get("/voice/status")
def voice_status(rt: Runtime = Depends(get_runtime)):
    return {
        "stt_server": rt.config.stt_enabled,
        "tts_server": rt.voice_output_available,
        "tts_label": rt.voice_output_label,
        "browser_fallback": {
            "stt": "Chrome / Edge speech recognition (free, in the browser)",
            "tts": "Built-in browser voices (free; Telugu depends on your device)",
        },
    }


@router.post("/voice/transcribe")
async def transcribe(
    child_id: int = Form(...), language: Language = Form("English"), audio: UploadFile = File(...),
    rt: Runtime = Depends(get_runtime),
):
    child = child_or_404(rt, child_id)
    _require_chat(child)
    _check_language(child, language)
    data = await audio.read()
    if not data or len(data) < 800:
        raise HTTPException(422, detail={"code": "no_audio", "message": "I did not hear anything. Try again."})
    if len(data) > 8_000_000:
        raise HTTPException(413, "That recording is too long")
    try:
        from fastapi.concurrency import run_in_threadpool

        text = await run_in_threadpool(rt.chat.transcribe, child, data, audio.filename or "recording.webm", language)
    except VoiceDisabledError as exc:
        if "not configured" in str(exc):
            raise HTTPException(503, detail={"code": "stt_unavailable", "message": str(exc)}) from exc
        raise HTTPException(403, detail={"code": "voice_off", "message": str(exc)}) from exc
    except ServiceError as exc:
        msg = str(exc)
        code = "stt_unavailable" if "not configured" in msg else ("no_speech" if "empty transcript" in msg else "stt_failed")
        raise HTTPException(503 if code == "stt_unavailable" else 502, detail={"code": code, "message": msg}) from exc
    return {"text": text}


class SpeakIn(BaseModel):
    child_id: int
    text: str = Field(min_length=1, max_length=1500)
    language: Language = "English"
    emotion: str = "neutral"
    mode: str = "chat"
    mood: str | None = None


@router.post("/voice/speak")
def speak(body: SpeakIn, rt: Runtime = Depends(get_runtime)):
    child = child_or_404(rt, body.child_id)
    _check_language(child, body.language)
    if not child.get("voice_enabled"):
        raise HTTPException(403, detail={"code": "voice_off", "message": "Voice is turned off by a parent."})
    check = rt.safety.check_output(body.text, language=body.language, blocked_topics=child.get("blocked_topics", ""))
    if not check.allowed:
        raise HTTPException(422, detail={"code": "unsafe_text", "message": "That text can't be read aloud."})
    mood = body.mood or mood_for(body.emotion, body.mode)
    try:
        speech = rt.chat.speak(child, body.text, body.language, mood)
    except VoiceDisabledError as exc:
        raise HTTPException(403, detail={"code": "voice_off", "message": str(exc)}) from exc
    except ServiceError as exc:
        raise HTTPException(503, detail={"code": "tts_unavailable", "message": str(exc)}) from exc
    if not speech.data:
        raise HTTPException(503, detail={"code": "tts_empty", "message": "The voice returned no audio."})
    headers = {"X-Voice-Name": speech.display_name.encode("ascii", "ignore").decode(), "X-Voice-Engine": speech.engine}
    if speech.notice:
        headers["X-Voice-Notice"] = speech.notice.encode("ascii", "ignore").decode()[:400]
    return Response(content=speech.data, media_type=speech.mime_type, headers=headers)


@router.get("/voice/voices", dependencies=[Depends(require_parent)])
def list_voices(language: Language, rt: Runtime = Depends(get_runtime)):
    entries = rt.voice_catalogue.compatible_entries(language)
    return [
        {"engine": e.engine, "engine_label": e.engine_label, "voice_id": e.voice_id, "name": e.display_name,
         "gender": e.gender, "accent": e.accent, "locale": e.locale, "language": e.language,
         "ready": e.is_ready, "status": e.availability_status, "online": e.online_or_offline == "online"}
        for e in entries
    ][:80]


class PreviewIn(BaseModel):
    engine: str
    voice_id: str
    language: Language = "English"
    mood: str = "neutral"


PREVIEW = {
    "English": "Hello, I'm Mallow. It's lovely to talk with you. This is how my voice sounds.",
    "Telugu": "నమస్తే! నేను మల్లో. నీతో మాట్లాడటం చాలా సంతోషంగా ఉంది.",
    "Hinglish": "Namaste! Main Mallow hoon. Aapse baat karke accha laga. Meri awaaz kuch aisi hai.",
}


@router.post("/voice/preview", dependencies=[Depends(require_parent)])
def preview(body: PreviewIn, rt: Runtime = Depends(get_runtime)):
    entry = rt.voice_catalogue.find(body.engine, body.voice_id)
    if entry is None:
        raise HTTPException(404, "Unknown voice")
    try:
        engine = rt.voice_catalogue.engines[entry.engine]
        if not entry.is_ready:
            raise ServiceError(f"'{entry.display_name}' is not ready ({entry.availability_status}).")
        if hasattr(engine, "synthesize_mood"):
            audio = engine.synthesize_mood(PREVIEW[body.language], entry.voice_id, body.language, body.mood)
        else:
            audio = engine.synthesize(PREVIEW[body.language], entry.voice_id, body.language)
    except ServiceError as exc:
        raise HTTPException(503, detail={"code": "tts_unavailable", "message": str(exc)}) from exc
    return Response(content=audio.data, media_type=audio.mime_type)


# ------------------------------------------------------------- activities
ACTIVITY_KINDS = (
    "game", "quiz", "story", "riddle", "drawing", "learning", "quest", "science", "math",
    "writing", "build", "journal", "project", "study", "feelings", "flashcards", "focus", "plan",
)


class ActivityIn(BaseModel):
    kind: Literal[ACTIVITY_KINDS]  # type: ignore[valid-type]
    title: str = Field(default="", max_length=120)
    detail: str = Field(default="", max_length=500)
    score: int | None = Field(default=None, ge=0, le=10000)
    max_score: int | None = Field(default=None, ge=0, le=10000)
    duration_seconds: int = Field(default=0, ge=0, le=6 * 3600)
    language: Language = "English"


@router.post("/children/{child_id}/activities", status_code=201)
def log_activity(child_id: int, body: ActivityIn, rt: Runtime = Depends(get_runtime)):
    child = child_or_404(rt, child_id)
    if child["age_band"] == "0-3":
        raise HTTPException(400, "Activities are not available for infant profiles")
    if body.score is not None and body.max_score is not None and body.score > body.max_score:
        raise HTTPException(422, "score cannot exceed max_score")
    activity_id = rt.db.execute(
        "INSERT INTO activities (child_id, kind, title, detail, score, max_score, duration_seconds, "
        "language, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (child_id, body.kind, body.title, body.detail, body.score, body.max_score,
         body.duration_seconds, body.language, utc_iso(datetime.now(timezone.utc))),
    )
    return {"id": activity_id}


@router.get("/children/{child_id}/activities")
def list_activities(child_id: int, limit: int = 30, rt: Runtime = Depends(get_runtime)):
    child_or_404(rt, child_id)
    return rt.db.query(
        "SELECT id, kind, title, detail, score, max_score, duration_seconds, language, created_at "
        "FROM activities WHERE child_id = ? ORDER BY created_at DESC, id DESC LIMIT ?",
        (child_id, max(1, min(limit, 200))),
    )


@router.get("/children/{child_id}/progress")
def child_progress(child_id: int, rt: Runtime = Depends(get_runtime)):
    """Child-friendly progress: stars, streak, counts by kind. Real stored data."""

    child_or_404(rt, child_id)
    rows = rt.db.query("SELECT kind, score, max_score, created_at FROM activities WHERE child_id = ?", (child_id,))
    from mallow_api.timeutil import parse_ts
    from datetime import timedelta

    days = {parse_ts(r["created_at"]).date() for r in rows if parse_ts(r["created_at"])}
    streak, cursor = 0, local_today()
    if cursor not in days:
        cursor -= timedelta(days=1)
    while cursor in days:
        streak += 1
        cursor -= timedelta(days=1)
    by_kind: dict[str, int] = {}
    stars = 0
    for r in rows:
        by_kind[r["kind"]] = by_kind.get(r["kind"], 0) + 1
        stars += 1
        if r["score"] is not None and r["max_score"]:
            stars += int(round(2 * r["score"] / r["max_score"]))
    return {"stars": stars, "streak_days": streak, "total": len(rows), "by_kind": by_kind}


# --------------------------------------------------------------- creations
class CreationIn(BaseModel):
    kind: Literal["drawing", "story", "poem", "writing", "build"]
    title: str = Field(default="Untitled", max_length=80)
    content: str = Field(min_length=1, max_length=600_000)


@router.get("/children/{child_id}/creations")
def list_creations(child_id: int, kind: str | None = None, rt: Runtime = Depends(get_runtime)):
    child_or_404(rt, child_id)
    wants_text = kind in {"story", "poem", "writing"}
    content = "content" if wants_text else "CASE WHEN kind = 'drawing' THEN content ELSE substr(content, 1, 300) END AS content"
    sql = f"SELECT id, kind, title, created_at, {content} FROM creations WHERE child_id = ?"
    params: list = [child_id]
    if kind:
        sql += " AND kind = ?"
        params.append(kind)
    return rt.db.query(sql + " ORDER BY id DESC LIMIT 60", params)


@router.get("/children/{child_id}/creations/{creation_id}")
def get_creation(child_id: int, creation_id: int, rt: Runtime = Depends(get_runtime)):
    row = rt.db.query_one("SELECT * FROM creations WHERE id = ? AND child_id = ?", (creation_id, child_id))
    if not row:
        raise HTTPException(404, "Not found")
    return row


@router.post("/children/{child_id}/creations", status_code=201)
def save_creation(child_id: int, body: CreationIn, rt: Runtime = Depends(get_runtime)):
    child_or_404(rt, child_id)
    if body.kind == "drawing" and not body.content.startswith("data:image/png;base64,"):
        raise HTTPException(422, "Drawings must be PNG images")
    if body.kind != "drawing":
        check = rt.safety.check_input(body.content, blocked_topics=child_or_404(rt, child_id).get("blocked_topics", ""))
        if check.is_disclosure:
            rt.escalation.raise_incident(
                child_id=child_id,
                session_id=None,
                category="serious_disclosure",
                severity="high",
                detail="Something your child wrote may mean they feel unsafe or very upset. Please check in with them calmly.",
                language="",
            )
    title = body.title.strip() or "Untitled"
    creation_id = rt.db.execute(
        "INSERT INTO creations (child_id, kind, title, content) VALUES (?, ?, ?, ?)",
        (child_id, body.kind, title, body.content),
    )
    rt.db.execute(
        "INSERT INTO activities (child_id, kind, title, created_at) VALUES (?, ?, ?, ?)",
        (child_id, "drawing" if body.kind == "drawing" else "writing" if body.kind != "build" else "build",
         title, utc_iso(datetime.now(timezone.utc))),
    )
    if body.kind == "drawing":
        return {"id": creation_id}
    row = rt.db.query_one("SELECT id, kind, title, content, created_at FROM creations WHERE id = ?", (creation_id,))
    return row or {"id": creation_id}


@router.delete("/children/{child_id}/creations/{creation_id}")
def delete_creation(child_id: int, creation_id: int, rt: Runtime = Depends(get_runtime)):
    rt.db.execute("DELETE FROM creations WHERE id = ? AND child_id = ?", (creation_id, child_id))
    return {"deleted": creation_id}


# ---------------------------------------------------------------- journal
class JournalIn(BaseModel):
    text: str = Field(min_length=1, max_length=3000)
    mood: Literal["happy", "calm", "okay", "sad", "worried", "angry", ""] = ""


@router.get("/children/{child_id}/journal")
def list_journal(child_id: int, rt: Runtime = Depends(get_runtime)):
    child_or_404(rt, child_id)
    return rt.db.query("SELECT id, text, mood, created_at FROM journal_entries WHERE child_id = ? ORDER BY id DESC LIMIT 100", (child_id,))


@router.post("/children/{child_id}/journal", status_code=201)
def add_journal(child_id: int, body: JournalIn, rt: Runtime = Depends(get_runtime)):
    child = child_or_404(rt, child_id)
    if child["age_band"] == "0-3":
        raise HTTPException(400, "Not available for infant profiles")
    entry_id = rt.db.execute("INSERT INTO journal_entries (child_id, text, mood) VALUES (?, ?, ?)", (child_id, body.text.strip(), body.mood))
    rt.db.execute("INSERT INTO activities (child_id, kind, title, created_at) VALUES (?, 'journal', 'Journal entry', ?)", (child_id, utc_iso(datetime.now(timezone.utc))))
    check = rt.safety.check_input(body.text, blocked_topics="")
    support = None
    if check.is_disclosure:
        rt.escalation.raise_incident(
            child_id=child_id,
            session_id=None,
            category="serious_disclosure",
            severity="high",
            detail="A journal entry may mean your child feels unsafe or very upset. The journal text stays private; please check in with them calmly.",
            language="",
        )
        support = check.safe_reply
    return {"id": entry_id, "support": support}


@router.delete("/children/{child_id}/journal/{entry_id}")
def delete_journal(child_id: int, entry_id: int, rt: Runtime = Depends(get_runtime)):
    rt.db.execute("DELETE FROM journal_entries WHERE id = ? AND child_id = ?", (entry_id, child_id))
    return {"deleted": entry_id}


# --------------------------------------------------------------- projects
class StepIn(BaseModel):
    text: str = Field(min_length=1, max_length=200)
    done: bool = False


class ProjectIn(BaseModel):
    kind: Literal["project", "plan", "goal"] = "project"
    title: str = Field(min_length=1, max_length=100)
    goal: str = Field(default="", max_length=400)
    due_on: str | None = None
    steps: list[StepIn] = Field(default_factory=list, max_length=40)


class ProjectPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=100)
    goal: str | None = Field(default=None, max_length=400)
    due_on: str | None = None
    steps: list[StepIn] | None = Field(default=None, max_length=40)
    status: Literal["active", "done"] | None = None


def _project(row: dict) -> dict:
    row = dict(row)
    row["steps"] = json.loads(row.pop("steps_json") or "[]")
    return row


@router.get("/children/{child_id}/projects")
def list_projects(child_id: int, kind: str | None = None, rt: Runtime = Depends(get_runtime)):
    child_or_404(rt, child_id)
    sql, params = "SELECT * FROM projects WHERE child_id = ?", [child_id]
    if kind:
        sql += " AND kind = ?"
        params.append(kind)
    return [_project(r) for r in rt.db.query(sql + " ORDER BY status, id DESC", params)]


@router.post("/children/{child_id}/projects", status_code=201)
def create_project(child_id: int, body: ProjectIn, rt: Runtime = Depends(get_runtime)):
    child_or_404(rt, child_id)
    pid = rt.db.execute(
        "INSERT INTO projects (child_id, kind, title, goal, due_on, steps_json) VALUES (?, ?, ?, ?, ?, ?)",
        (child_id, body.kind, body.title.strip(), body.goal, body.due_on, json.dumps([s.model_dump() for s in body.steps])),
    )
    return _project(rt.db.query_one("SELECT * FROM projects WHERE id = ?", (pid,)))


@router.patch("/children/{child_id}/projects/{project_id}")
def update_project(child_id: int, project_id: int, body: ProjectPatch, rt: Runtime = Depends(get_runtime)):
    row = rt.db.query_one("SELECT * FROM projects WHERE id = ? AND child_id = ?", (project_id, child_id))
    if not row:
        raise HTTPException(404, "Not found")
    data = body.model_dump(exclude_unset=True)
    steps = data.pop("steps", None)
    sets, params = [], []
    for key, value in data.items():
        sets.append(f"{key} = ?")
        params.append(value)
    if steps is not None:
        sets.append("steps_json = ?")
        params.append(json.dumps(steps))
    if sets:
        sets.append("updated_at = ?")
        params.append(utc_iso(datetime.now(timezone.utc)))
        rt.db.execute(f"UPDATE projects SET {', '.join(sets)} WHERE id = ?", (*params, project_id))
    new = rt.db.query_one("SELECT * FROM projects WHERE id = ?", (project_id,))
    if data.get("status") == "done" and row["status"] != "done":
        rt.db.execute(
            "INSERT INTO activities (child_id, kind, title, created_at) VALUES (?, 'project', ?, ?)",
            (child_id, new["title"], utc_iso(datetime.now(timezone.utc))),
        )
    return _project(new)


@router.delete("/children/{child_id}/projects/{project_id}")
def delete_project(child_id: int, project_id: int, rt: Runtime = Depends(get_runtime)):
    rt.db.execute("DELETE FROM projects WHERE id = ? AND child_id = ?", (project_id, child_id))
    return {"deleted": project_id}
