"""Bootstrap, parent auth, child profiles, settings, demo data, data deletion."""

from __future__ import annotations

import time
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

from mallow_api.deps import (
    ACTIVITY_KEYS, AuthState, child_or_404, get_auth, get_runtime, is_parent,
    parent_child, public_child, require_parent,
)
from runtime import Runtime
from services.age import (
    age_in_years, band_for_age, dob_from_age, dob_from_age_months,
    parse_dob, validate_dob,
)
from services.languages import DEFAULT_LANGUAGES

router = APIRouter()
LANGS = list(DEFAULT_LANGUAGES)


# ---------------------------------------------------------------- bootstrap
@router.get("/bootstrap")
def bootstrap(request: Request, rt: Runtime = Depends(get_runtime)):
    cfg = rt.config
    children = rt.db.list_children()
    return {
        "consent": rt.controls.has_consent(),
        "pin_set": rt.controls.is_pin_set(),
        "parent_unlocked": is_parent(request),
        "companion_name": rt.db.get_setting("companion_name", "Mallow") or "Mallow",
        "child_count": len([c for c in children if not c.get("is_demo")]),
        "demo_count": len([c for c in children if c.get("is_demo")]),
        "services": {
            "llm": cfg.llm_enabled,
            "moderation": cfg.moderation_enabled,
            "stt": cfg.stt_enabled,
            "voice_output": rt.voice_output_available,
            "voice_output_label": rt.voice_output_label,
            "offline_companion": not cfg.llm_enabled,
        },
        "languages": LANGS,
        "helpline": cfg.helpline_text,
    }


# --------------------------------------------------------------------- auth
class PinIn(BaseModel):
    pin: str = Field(min_length=4, max_length=64)


class ChangePinIn(BaseModel):
    old_pin: str
    new_pin: str = Field(min_length=4, max_length=64)


@router.post("/auth/consent")
def accept_consent(rt: Runtime = Depends(get_runtime)):
    rt.controls.accept_consent()
    return {"ok": True}


@router.post("/auth/setup-pin")
def setup_pin(body: PinIn, rt: Runtime = Depends(get_runtime), auth: AuthState = Depends(get_auth)):
    if not rt.controls.has_consent():
        raise HTTPException(409, "Please accept the consent screen first")
    if rt.controls.is_pin_set():
        raise HTTPException(409, "A PIN already exists")
    rt.controls.set_pin(body.pin)
    return {"token": auth.issue()}


@router.post("/auth/login")
def login(body: PinIn, rt: Runtime = Depends(get_runtime), auth: AuthState = Depends(get_auth)):
    now = time.time()
    if auth.locked_until > now:
        raise HTTPException(429, f"Too many tries. Wait {int(auth.locked_until - now) + 1}s.")
    if not rt.controls.is_pin_set():
        raise HTTPException(409, "No PIN set yet")
    if rt.controls.verify_pin(body.pin):
        auth.fails = 0
        return {"token": auth.issue()}
    auth.fails += 1
    if auth.fails >= 5:
        auth.fails = 0
        auth.locked_until = now + 30
        raise HTTPException(429, "Too many tries. Wait 30s.")
    raise HTTPException(401, "That PIN did not match")


@router.post("/auth/logout")
def logout(x_parent_token: str | None = Header(default=None), auth: AuthState = Depends(get_auth)):
    auth.revoke(x_parent_token)
    return {"ok": True}


@router.post("/auth/change-pin", dependencies=[Depends(require_parent)])
def change_pin(body: ChangePinIn, rt: Runtime = Depends(get_runtime)):
    if not rt.controls.verify_pin(body.old_pin):
        raise HTTPException(401, "Current PIN did not match")
    rt.controls.set_pin(body.new_pin)
    return {"ok": True}


# ----------------------------------------------------------------- children
class ChildIn(BaseModel):
    nickname: str = Field(min_length=1, max_length=32)
    dob: date | None = None
    age: int | None = Field(default=None, ge=0, le=12)
    age_months: int | None = Field(default=None, ge=0, le=35)
    languages: list[Literal["English", "Telugu", "Hinglish"]] = Field(default_factory=lambda: ["English"])
    preferred_language: str | None = None
    daily_minutes: int = Field(default=30, ge=0, le=240)
    voice_enabled: bool = True
    activities: list[str] | None = None
    blocked_topics: list[str] = Field(default_factory=list)

    @field_validator("nickname")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name is required")
        return v


class ChildPatch(BaseModel):
    nickname: str | None = Field(default=None, min_length=1, max_length=32)
    dob: date | None = None
    age: int | None = Field(default=None, ge=0, le=12)
    age_months: int | None = Field(default=None, ge=0, le=35)
    languages: list[Literal["English", "Telugu", "Hinglish"]] | None = None
    preferred_language: str | None = None
    daily_minutes: int | None = Field(default=None, ge=0, le=240)
    voice_enabled: bool | None = None
    activities: list[str] | None = None
    blocked_topics: list[str] | None = None
    voice_engine: str | None = None
    voice_id: str | None = None
    voice_language: str | None = None
    voice_locale: str | None = None


def _resolve_dob(
    dob: date | None, age: int | None, age_months: int | None = None
) -> tuple[str, bool]:
    if dob is not None:
        try:
            validate_dob(dob)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        return dob.isoformat(), True
    if age_months is not None:
        approx = dob_from_age_months(age_months)
        try:
            validate_dob(approx)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        return approx.isoformat(), False
    if age is not None:
        return dob_from_age(age).isoformat(), False
    raise HTTPException(422, "Please give a date of birth or an age")


def _clean_activities(items: list[str] | None) -> str:
    keys = [a for a in (items if items is not None else list(ACTIVITY_KEYS)) if a in ACTIVITY_KEYS]
    return ",".join(keys)


def _clean_topics(items: list[str]) -> str:
    seen: list[str] = []
    for topic in items:
        t = topic.strip()[:40]
        if t and t.lower() not in [s.lower() for s in seen]:
            seen.append(t)
    return ",".join(seen[:30])


@router.get("/children")
def list_children(request: Request, rt: Runtime = Depends(get_runtime)):
    parent = is_parent(request)
    rows = rt.db.list_children()
    return [parent_child(c, rt) if parent else public_child(c, rt) for c in rows]


@router.get("/children/{child_id}")
def get_child(child_id: int, request: Request, rt: Runtime = Depends(get_runtime)):
    child = child_or_404(rt, child_id)
    return parent_child(child, rt) if is_parent(request) else public_child(child, rt)


@router.post("/children", status_code=201, dependencies=[Depends(require_parent)])
def create_child(body: ChildIn, rt: Runtime = Depends(get_runtime)):
    dob, exact = _resolve_dob(body.dob, body.age, body.age_months)
    band = band_for_age(age_in_years(parse_dob(dob)))
    langs = body.languages or ["English"]
    first = body.preferred_language if body.preferred_language in langs else langs[0]
    voice = rt.voice_catalogue.default_selection(first)
    child_id = rt.db.create_child(
        nickname=body.nickname, age_band=band, languages=",".join(langs),
        voice_preset=voice.voice_id or "default", voice_engine=voice.engine,
        voice_id=voice.voice_id, voice_language=voice.language, voice_locale=voice.locale,
        activities=_clean_activities(body.activities), blocked_topics=_clean_topics(body.blocked_topics),
        daily_minutes=body.daily_minutes, voice_enabled=body.voice_enabled and band != "0-3",
        dob=dob, dob_exact=exact, preferred_language=first,
    )
    return parent_child(rt.db.get_child(child_id), rt)


@router.patch("/children/{child_id}", dependencies=[Depends(require_parent)])
def update_child(child_id: int, body: ChildPatch, rt: Runtime = Depends(get_runtime)):
    child = child_or_404(rt, child_id)
    data = body.model_dump(exclude_unset=True)
    fields: dict = {}
    if "dob" in data or "age" in data or "age_months" in data:
        if data.get("dob") is not None or data.get("age") is not None or data.get("age_months") is not None:
            dob, exact = _resolve_dob(data.get("dob"), data.get("age"), data.get("age_months"))
            fields.update(dob=dob, dob_exact=int(exact), age_band=band_for_age(age_in_years(parse_dob(dob))))
    if "nickname" in data and data["nickname"]:
        fields["nickname"] = data["nickname"].strip()
    if data.get("languages"):
        fields["languages"] = ",".join(data["languages"])
        pref = data.get("preferred_language") or child.get("preferred_language")
        fields["preferred_language"] = pref if pref in data["languages"] else data["languages"][0]
    elif "preferred_language" in data and data["preferred_language"]:
        from services.languages import parse_languages
        langs = parse_languages(child["languages"])
        if data["preferred_language"] in langs:
            fields["preferred_language"] = data["preferred_language"]
    for key in ("daily_minutes", "voice_enabled", "voice_engine", "voice_id", "voice_language", "voice_locale"):
        if key in data and data[key] is not None:
            fields[key] = data[key]
    if "voice_id" in fields:
        fields["voice_preset"] = fields["voice_id"]
    if "activities" in data and data["activities"] is not None:
        fields["activities"] = _clean_activities(data["activities"])
    if "blocked_topics" in data and data["blocked_topics"] is not None:
        fields["blocked_topics"] = _clean_topics(data["blocked_topics"])
    rt.db.update_child(child_id, **fields)
    return parent_child(rt.db.get_child(child_id), rt)


@router.delete("/children/{child_id}", dependencies=[Depends(require_parent)])
def delete_child(child_id: int, confirm: bool = False, rt: Runtime = Depends(get_runtime)):
    child_or_404(rt, child_id)
    if not confirm:
        raise HTTPException(400, "Pass confirm=true to permanently delete this profile and all its records")
    rt.db.delete_child(child_id)
    return {"deleted": child_id}


# ----------------------------------------------------------------- settings
class SettingsIn(BaseModel):
    companion_name: str | None = Field(default=None, min_length=1, max_length=24)


@router.get("/settings", dependencies=[Depends(require_parent)])
def get_settings(rt: Runtime = Depends(get_runtime)):
    return {"companion_name": rt.db.get_setting("companion_name", "Mallow") or "Mallow"}


@router.patch("/settings", dependencies=[Depends(require_parent)])
def patch_settings(body: SettingsIn, rt: Runtime = Depends(get_runtime)):
    if body.companion_name:
        rt.db.set_setting("companion_name", body.companion_name.strip())
    return get_settings(rt)


class DeleteAllIn(BaseModel):
    confirm: Literal["DELETE"]


@router.post("/data/delete-all", dependencies=[Depends(require_parent)])
def delete_all(body: DeleteAllIn, rt: Runtime = Depends(get_runtime), auth: AuthState = Depends(get_auth)):
    rt.controls.delete_all_data()
    auth.clear()
    return {"ok": True}


# --------------------------------------------------------------------- demo
@router.post("/demo/seed", dependencies=[Depends(require_parent)])
def demo_seed(rt: Runtime = Depends(get_runtime)):
    from mallow_api.demo import seed_demo

    return seed_demo(rt)


@router.delete("/demo", dependencies=[Depends(require_parent)])
def demo_remove(rt: Runtime = Depends(get_runtime)):
    from mallow_api.demo import remove_demo

    return remove_demo(rt)
