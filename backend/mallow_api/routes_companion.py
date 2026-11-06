"""Parent and Infant Care AI companion endpoints.

Everything here is parent-authenticated. Infant conversations are scoped to one
baby profile and are never mixed with another child's data.
"""

from __future__ import annotations

from collections import OrderedDict
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

from mallow_api.deps import child_or_404, get_runtime, require_parent
from runtime import Runtime
from services.errors import ServiceError

router = APIRouter(dependencies=[Depends(require_parent)])
Language = Literal["English", "Telugu", "Hinglish"]
_TURN_CACHE: "OrderedDict[str, dict]" = OrderedDict()


def _infant_or_404(rt: Runtime, child_id: int) -> dict:
    child = child_or_404(rt, child_id)
    if child["age_band"] != "0-3":
        raise HTTPException(400, "The infant companion is only for baby profiles")
    return child


class CompanionIn(BaseModel):
    text: str = Field(min_length=1, max_length=1200)
    language: Language = "English"
    client_turn_id: str | None = Field(default=None, max_length=64)


class ParentCompanionIn(CompanionIn):
    child_id: int | None = None


def _respond(rt: Runtime, audience: str, body: CompanionIn, child_id: int | None) -> dict:
    key = f"{audience}:{child_id}:{body.client_turn_id}" if body.client_turn_id else None
    if key and key in _TURN_CACHE:
        return {**_TURN_CACHE[key], "duplicate": True}
    result = rt.companion.respond(audience, body.text.strip(), body.language, child_id)
    payload = {
        "reply": result.reply,
        "message_id": result.message_id,
        "urgent": result.urgent,
        "unsafe": result.unsafe,
        "provider_error": result.provider_error,
        "offline": result.provider_error and not rt.config.llm_enabled,
        "duplicate": False,
    }
    if key:
        _TURN_CACHE[key] = payload
        while len(_TURN_CACHE) > 200:
            _TURN_CACHE.popitem(last=False)
    return payload


@router.post("/companion/parent")
def parent_turn(body: ParentCompanionIn, rt: Runtime = Depends(get_runtime)):
    if body.child_id is not None:
        child_or_404(rt, body.child_id)
    return _respond(rt, "parent", body, body.child_id)


@router.post("/infant/{child_id}/companion")
def infant_turn(child_id: int, body: CompanionIn, rt: Runtime = Depends(get_runtime)):
    _infant_or_404(rt, child_id)
    return _respond(rt, "infant", body, child_id)


@router.get("/companion/messages")
def companion_messages(
    audience: Literal["parent", "infant"] = "parent",
    child_id: int | None = None,
    limit: int = 40,
    rt: Runtime = Depends(get_runtime),
):
    if audience == "infant":
        if child_id is None:
            raise HTTPException(422, "child_id is required for the infant companion")
        _infant_or_404(rt, child_id)
    elif child_id is not None:
        child_or_404(rt, child_id)
    return rt.companion.recent(audience, child_id, max(1, min(limit, 100)))


@router.post("/companion/transcribe")
async def companion_transcribe(
    audio: UploadFile = File(...),
    language: Language = Form("English"),
    rt: Runtime = Depends(get_runtime),
):
    data = await audio.read()
    if not data or len(data) < 800:
        raise HTTPException(422, detail={"code": "no_audio", "message": "I did not hear anything. Try again."})
    if len(data) > 8_000_000:
        raise HTTPException(413, "That recording is too long")
    if not rt.stt.available:
        raise HTTPException(503, detail={"code": "stt_unavailable", "message": "Speech-to-text is not configured."})
    try:
        from fastapi.concurrency import run_in_threadpool

        text = await run_in_threadpool(
            rt.stt.transcribe, data, audio.filename or "recording.webm", language
        )
    except ServiceError as exc:
        msg = str(exc)
        code = "no_speech" if "empty transcript" in msg else "stt_failed"
        raise HTTPException(502, detail={"code": code, "message": msg}) from exc
    return {"text": text}


class CompanionSpeakIn(BaseModel):
    text: str = Field(min_length=1, max_length=2500)
    language: Language = "English"
    mood: str = "neutral"


@router.post("/companion/speak")
def companion_speak(body: CompanionSpeakIn, rt: Runtime = Depends(get_runtime)):
    if not rt.voice_output_available:
        raise HTTPException(503, detail={"code": "tts_unavailable", "message": "Voice output is not available right now."})
    try:
        speech = rt.voice_service.speak({}, body.text, body.language, body.mood)
    except ServiceError as exc:
        raise HTTPException(503, detail={"code": "tts_unavailable", "message": str(exc)}) from exc
    if not speech.data:
        raise HTTPException(503, detail={"code": "tts_empty", "message": "The voice returned no audio."})
    headers = {
        "X-Voice-Name": speech.display_name.encode("ascii", "ignore").decode(),
        "X-Voice-Engine": speech.engine,
    }
    if speech.notice:
        headers["X-Voice-Notice"] = speech.notice.encode("ascii", "ignore").decode()[:400]
    return Response(content=speech.data, media_type=speech.mime_type, headers=headers)
