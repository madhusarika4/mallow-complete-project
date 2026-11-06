"""Infant care: feeding, sleep, diaper, growth, milestones, reminders.

This is a parent-entered logging tool. It never interprets entries as normal or
abnormal and makes no medical claims.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator

from mallow_api.deps import child_or_404, get_runtime, parent_child, require_parent
from mallow_api.timeutil import day_range, local_today, local_tz, parse_ts
from runtime import Runtime

router = APIRouter(prefix="/infant", dependencies=[Depends(require_parent)])

FEED_TYPES = ("bottle", "breastfeeding", "solids", "other")
DIAPER_TYPES = ("wet", "dirty", "mixed")


def _infant(rt: Runtime, child_id: int) -> dict:
    child = child_or_404(rt, child_id)
    if child["age_band"] != "0-3":
        raise HTTPException(400, "Infant care is for profiles under 4 years")
    return child


def _naive_local(value: datetime) -> str:
    """Store the parent's wall-clock time as naive ISO (minutes)."""

    if value.tzinfo is not None:
        value = value.astimezone(local_tz()).replace(tzinfo=None)
    return value.replace(second=0, microsecond=0).isoformat(timespec="minutes")


def _check_not_future(value: datetime) -> None:
    now = datetime.now(local_tz()).replace(tzinfo=None) + timedelta(minutes=5)
    naive = value.astimezone(local_tz()).replace(tzinfo=None) if value.tzinfo else value
    if naive > now:
        raise HTTPException(422, "That time is in the future")


class FeedingIn(BaseModel):
    at: datetime
    subtype: Literal["bottle", "breastfeeding", "solids", "other"]
    amount_ml: int | None = Field(default=None, ge=0, le=1500)
    duration_minutes: int | None = Field(default=None, ge=0, le=240)
    note: str = Field(default="", max_length=300)


class SleepIn(BaseModel):
    start: datetime
    end: datetime | None = None
    duration_minutes: int | None = Field(default=None, ge=1, le=1440)
    kind: Literal["nap", "night"] = "nap"
    note: str = Field(default="", max_length=300)

    @model_validator(mode="after")
    def _check(self):
        if self.end is None and self.duration_minutes is None:
            raise ValueError("Give a wake-up time or a duration")
        if self.end is not None:
            s = self.start.replace(tzinfo=None) if self.start.tzinfo is None else self.start
            e = self.end.replace(tzinfo=None) if self.end.tzinfo is None else self.end
            if self.start.tzinfo is None and self.end.tzinfo is None and e <= s:
                raise ValueError("Wake-up time must be after the sleep start")
            if (e - s).total_seconds() > 24 * 3600:
                raise ValueError("A single sleep cannot be longer than 24 hours")
        return self


class DiaperIn(BaseModel):
    at: datetime
    subtype: Literal["wet", "dirty", "mixed"]
    note: str = Field(default="", max_length=300)


@router.post("/{child_id}/feeding", status_code=201)
def add_feeding(child_id: int, body: FeedingIn, rt: Runtime = Depends(get_runtime)):
    _infant(rt, child_id)
    _check_not_future(body.at)
    if body.subtype != "bottle" and body.amount_ml:
        pass  # amount is allowed for expressed milk / solids; just stored as entered
    log_id = rt.db.execute(
        "INSERT INTO infant_care (child_id, event_type, timestamp, note, amount_ml, duration_minutes, details, subtype) "
        "VALUES (?, 'feeding', ?, ?, ?, ?, ?, ?)",
        (child_id, _naive_local(body.at), body.note.strip(), body.amount_ml or None, body.duration_minutes or None,
         body.note.strip(), body.subtype),
    )
    return {"id": log_id}


@router.post("/{child_id}/sleep", status_code=201)
def add_sleep(child_id: int, body: SleepIn, rt: Runtime = Depends(get_runtime)):
    _infant(rt, child_id)
    _check_not_future(body.start)
    start = _naive_local(body.start)
    if body.end is not None:
        end_dt = datetime.fromisoformat(_naive_local(body.end))
        minutes = int((end_dt - datetime.fromisoformat(start)).total_seconds() // 60)
        if minutes <= 0:
            raise HTTPException(422, "Wake-up time must be after the sleep start")
        end = end_dt.isoformat(timespec="minutes")
    else:
        minutes = body.duration_minutes or 0
        end = (datetime.fromisoformat(start) + timedelta(minutes=minutes)).isoformat(timespec="minutes")
    log_id = rt.db.execute(
        "INSERT INTO infant_care (child_id, event_type, timestamp, end_timestamp, note, duration_minutes, details, subtype) "
        "VALUES (?, 'sleep', ?, ?, ?, ?, ?, ?)",
        (child_id, start, end, body.note.strip(), minutes, body.note.strip(), body.kind),
    )
    return {"id": log_id, "duration_minutes": minutes}


@router.post("/{child_id}/diaper", status_code=201)
def add_diaper(child_id: int, body: DiaperIn, rt: Runtime = Depends(get_runtime)):
    _infant(rt, child_id)
    _check_not_future(body.at)
    log_id = rt.db.execute(
        "INSERT INTO infant_care (child_id, event_type, timestamp, note, details, subtype) VALUES (?, 'diaper', ?, ?, ?, ?)",
        (child_id, _naive_local(body.at), body.note.strip(), body.note.strip(), body.subtype),
    )
    return {"id": log_id}


def _log_row(r: dict) -> dict:
    sub = r.get("subtype") or ""
    if r["event_type"] == "diaper" and sub == "both":
        sub = "mixed"
    if r["event_type"] == "sleep" and sub not in ("nap", "night"):
        sub = "nap"
    return {"id": r["id"], "type": r["event_type"], "at": r["timestamp"], "end": r.get("end_timestamp"),
            "subtype": sub, "amount_ml": r.get("amount_ml"), "duration_minutes": r.get("duration_minutes"),
            "note": r.get("note") or "", "is_sample": bool(r.get("is_sample"))}


@router.get("/{child_id}/logs")
def list_logs(child_id: int, kind: str | None = None, days: int = 14, rt: Runtime = Depends(get_runtime)):
    _infant(rt, child_id)
    cutoff = (local_today() - timedelta(days=max(1, min(days, 365)) - 1)).isoformat()
    sql, params = "SELECT * FROM infant_care WHERE child_id = ? AND timestamp >= ?", [child_id, cutoff]
    if kind in ("feeding", "sleep", "diaper"):
        sql += " AND event_type = ?"
        params.append(kind)
    else:
        sql += " AND event_type IN ('feeding','sleep','diaper')"
    return [_log_row(r) for r in rt.db.query(sql + " ORDER BY timestamp DESC, id DESC LIMIT 500", params)]


@router.delete("/{child_id}/logs/{log_id}")
def delete_log(child_id: int, log_id: int, rt: Runtime = Depends(get_runtime)):
    _infant(rt, child_id)
    rt.db.execute("DELETE FROM infant_care WHERE id = ? AND child_id = ?", (log_id, child_id))
    return {"deleted": log_id}


# ----------------------------------------------------------------- growth
class GrowthIn(BaseModel):
    measured_on: date
    weight_kg: float | None = Field(default=None, gt=0, le=40)
    length_cm: float | None = Field(default=None, gt=10, le=160)
    head_cm: float | None = Field(default=None, gt=10, le=70)
    note: str = Field(default="", max_length=300)

    @model_validator(mode="after")
    def _any(self):
        if self.weight_kg is None and self.length_cm is None and self.head_cm is None:
            raise ValueError("Enter at least one measurement")
        if self.measured_on > local_today():
            raise ValueError("Measurement date cannot be in the future")
        return self


@router.get("/{child_id}/growth")
def list_growth(child_id: int, rt: Runtime = Depends(get_runtime)):
    _infant(rt, child_id)
    return rt.db.query("SELECT id, measured_on, weight_kg, length_cm, head_cm, note, is_sample FROM growth_records WHERE child_id = ? ORDER BY measured_on, id", (child_id,))


@router.post("/{child_id}/growth", status_code=201)
def add_growth(child_id: int, body: GrowthIn, rt: Runtime = Depends(get_runtime)):
    _infant(rt, child_id)
    gid = rt.db.execute("INSERT INTO growth_records (child_id, measured_on, weight_kg, length_cm, head_cm, note) VALUES (?, ?, ?, ?, ?, ?)",
                        (child_id, body.measured_on.isoformat(), body.weight_kg, body.length_cm, body.head_cm, body.note.strip()))
    return {"id": gid}


@router.delete("/{child_id}/growth/{record_id}")
def delete_growth(child_id: int, record_id: int, rt: Runtime = Depends(get_runtime)):
    _infant(rt, child_id)
    rt.db.execute("DELETE FROM growth_records WHERE id = ? AND child_id = ?", (record_id, child_id))
    return {"deleted": record_id}


# ------------------------------------------------------------- milestones
class MilestoneIn(BaseModel):
    achieved_on: date
    title: str = Field(min_length=1, max_length=120)
    category: Literal["movement", "language", "social", "feeding", "sleep", "other"] = "other"
    note: str = Field(default="", max_length=300)


@router.get("/{child_id}/milestones")
def list_milestones(child_id: int, rt: Runtime = Depends(get_runtime)):
    _infant(rt, child_id)
    return rt.db.query("SELECT id, achieved_on, title, category, note, is_sample FROM milestones WHERE child_id = ? ORDER BY achieved_on DESC, id DESC", (child_id,))


@router.post("/{child_id}/milestones", status_code=201)
def add_milestone(child_id: int, body: MilestoneIn, rt: Runtime = Depends(get_runtime)):
    _infant(rt, child_id)
    if body.achieved_on > local_today():
        raise HTTPException(422, "Date cannot be in the future")
    mid = rt.db.execute("INSERT INTO milestones (child_id, achieved_on, title, category, note) VALUES (?, ?, ?, ?, ?)",
                        (child_id, body.achieved_on.isoformat(), body.title.strip(), body.category, body.note.strip()))
    return {"id": mid}


@router.delete("/{child_id}/milestones/{milestone_id}")
def delete_milestone(child_id: int, milestone_id: int, rt: Runtime = Depends(get_runtime)):
    _infant(rt, child_id)
    rt.db.execute("DELETE FROM milestones WHERE id = ? AND child_id = ?", (milestone_id, child_id))
    return {"deleted": milestone_id}


# -------------------------------------------------------------- reminders
class ReminderIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    due_at: datetime
    repeat: Literal["none", "daily", "weekly"] = "none"


@router.get("/{child_id}/reminders")
def list_reminders(child_id: int, rt: Runtime = Depends(get_runtime)):
    _infant(rt, child_id)
    return rt.db.query("SELECT id, title, due_at, repeat, done, is_sample FROM reminders WHERE child_id = ? ORDER BY done, due_at", (child_id,))


@router.post("/{child_id}/reminders", status_code=201)
def add_reminder(child_id: int, body: ReminderIn, rt: Runtime = Depends(get_runtime)):
    _infant(rt, child_id)
    rid = rt.db.execute("INSERT INTO reminders (child_id, title, due_at, repeat) VALUES (?, ?, ?, ?)",
                        (child_id, body.title.strip(), _naive_local(body.due_at), body.repeat))
    return {"id": rid}


@router.post("/{child_id}/reminders/{reminder_id}/toggle")
def toggle_reminder(child_id: int, reminder_id: int, rt: Runtime = Depends(get_runtime)):
    _infant(rt, child_id)
    row = rt.db.query_one("SELECT * FROM reminders WHERE id = ? AND child_id = ?", (reminder_id, child_id))
    if not row:
        raise HTTPException(404, "Not found")
    if not row["done"] and row["repeat"] != "none":  # roll a repeating reminder forward
        step = timedelta(days=1 if row["repeat"] == "daily" else 7)
        due = datetime.fromisoformat(row["due_at"])
        while due <= datetime.now():
            due += step
        rt.db.execute("UPDATE reminders SET due_at = ? WHERE id = ?", (due.isoformat(timespec="minutes"), reminder_id))
    else:
        rt.db.execute("UPDATE reminders SET done = ? WHERE id = ?", (0 if row["done"] else 1, reminder_id))
    return {"ok": True}


@router.delete("/{child_id}/reminders/{reminder_id}")
def delete_reminder(child_id: int, reminder_id: int, rt: Runtime = Depends(get_runtime)):
    _infant(rt, child_id)
    rt.db.execute("DELETE FROM reminders WHERE id = ? AND child_id = ?", (reminder_id, child_id))
    return {"deleted": reminder_id}


# ---------------------------------------------------------------- summary
def _sleep_by_day(rows: list[dict]) -> dict[date, float]:
    """Split sleeps across local midnights so night sleep lands on the right days."""

    out: dict[date, float] = defaultdict(float)
    for r in rows:
        start = parse_ts(r["timestamp"], naive_is_utc=False)
        if not start:
            continue
        end = parse_ts(r.get("end_timestamp"), naive_is_utc=False) or start + timedelta(minutes=int(r.get("duration_minutes") or 0))
        cursor = start
        while cursor < end:
            midnight = (cursor + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
            chunk_end = min(end, midnight)
            out[cursor.date()] += (chunk_end - cursor).total_seconds() / 60
            cursor = chunk_end
    return out


@router.get("/{child_id}/summary")
def summary(child_id: int, days: int = 7, rt: Runtime = Depends(get_runtime)):
    child = _infant(rt, child_id)
    days = 7 if days not in (7, 14, 30) else days
    window = day_range(days)
    cutoff = (window[0] - timedelta(days=1)).isoformat()
    rows = rt.db.query("SELECT * FROM infant_care WHERE child_id = ? AND timestamp >= ? AND event_type IN ('feeding','sleep','diaper') ORDER BY timestamp", (child_id, cutoff))
    feeds = [r for r in rows if r["event_type"] == "feeding"]
    sleeps = [r for r in rows if r["event_type"] == "sleep"]
    diapers = [r for r in rows if r["event_type"] == "diaper"]
    sleep_day = _sleep_by_day(sleeps)
    feed_day: dict[date, int] = defaultdict(int)
    feed_ml: dict[date, int] = defaultdict(int)
    diaper_day: dict[date, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for f in feeds:
        dt = parse_ts(f["timestamp"], naive_is_utc=False)
        if dt:
            feed_day[dt.date()] += 1
            feed_ml[dt.date()] += int(f.get("amount_ml") or 0)
    for d in diapers:
        dt = parse_ts(d["timestamp"], naive_is_utc=False)
        if dt:
            sub = "mixed" if d.get("subtype") == "both" else (d.get("subtype") or "wet")
            diaper_day[dt.date()][sub] += 1
    # all-time last events (not limited to the window)
    last_feed = rt.db.query_one("SELECT * FROM infant_care WHERE child_id = ? AND event_type = 'feeding' ORDER BY timestamp DESC, id DESC LIMIT 1", (child_id,))
    last_sleep = rt.db.query_one("SELECT * FROM infant_care WHERE child_id = ? AND event_type = 'sleep' ORDER BY timestamp DESC, id DESC LIMIT 1", (child_id,))
    last_diaper = rt.db.query_one("SELECT * FROM infant_care WHERE child_id = ? AND event_type = 'diaper' ORDER BY timestamp DESC, id DESC LIMIT 1", (child_id,))
    today = local_today()
    growth = rt.db.query("SELECT id, measured_on, weight_kg, length_cm, head_cm, note FROM growth_records WHERE child_id = ? ORDER BY measured_on, id", (child_id,))
    reminders = rt.db.query("SELECT id, title, due_at, repeat, done FROM reminders WHERE child_id = ? AND done = 0 ORDER BY due_at LIMIT 6", (child_id,))
    ml_total = sum(feed_ml[d] for d in window)
    return {
        "child": parent_child(child, rt),
        "days": days,
        "today": {
            "feeds": feed_day.get(today, 0), "feed_ml": feed_ml.get(today, 0),
            "sleep_minutes": round(sleep_day.get(today, 0)),
            "diapers": sum(diaper_day[today].values()) if today in diaper_day else 0,
        },
        "last": {
            "feeding": _log_row(last_feed) if last_feed else None,
            "sleep": _log_row(last_sleep) if last_sleep else None,
            "diaper": _log_row(last_diaper) if last_diaper else None,
        },
        "daily": [{"date": d.isoformat(), "label": d.strftime("%a"), "feeds": feed_day.get(d, 0), "feed_ml": feed_ml.get(d, 0),
                   "sleep_hours": round(sleep_day.get(d, 0) / 60, 1), "sleep_minutes": round(sleep_day.get(d, 0)),
                   "wet": diaper_day[d].get("wet", 0) if d in diaper_day else 0,
                   "dirty": diaper_day[d].get("dirty", 0) if d in diaper_day else 0,
                   "mixed": diaper_day[d].get("mixed", 0) if d in diaper_day else 0} for d in window],
        "totals": {"feeds": sum(feed_day[d] for d in window), "feed_ml": ml_total,
                   "sleep_minutes": round(sum(sleep_day.get(d, 0) for d in window)),
                   "diapers": sum(sum(diaper_day[d].values()) for d in window if d in diaper_day)},
        "growth": growth,
        "reminders": reminders,
        "recent": [_log_row(r) for r in sorted(rows, key=lambda r: (r["timestamp"], r["id"]), reverse=True)[:15]],
        "disclaimer": "A logging and organisation tool. It does not diagnose, and it does not say whether patterns are normal.",
    }
