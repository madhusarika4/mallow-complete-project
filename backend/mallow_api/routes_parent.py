"""Parent dashboard: real statistics computed from stored rows, plus safety review."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from mallow_api.deps import child_or_404, get_runtime, normalize_activities, parent_child, require_parent
from mallow_api.timeutil import day_range, local_day_start_utc, local_today, parse_ts, utc_iso
from runtime import Runtime

router = APIRouter(dependencies=[Depends(require_parent)])

ACTIVITY_LABELS = {
    "chat": "Chatting", "game": "Games", "quiz": "Quizzes", "story": "Stories", "riddle": "Riddles",
    "drawing": "Drawing", "learning": "Learning", "quest": "Quests", "science": "Science", "math": "Maths",
    "writing": "Writing", "build": "Building", "journal": "Journal", "project": "Projects",
    "study": "Study", "feelings": "Feelings", "flashcards": "Flashcards", "focus": "Focus", "plan": "Plans",
}
LEARNING_KINDS = {"quiz", "learning", "science", "math", "study", "flashcards", "quest", "riddle"}
EDUCATIONAL_ACTIVITY_KINDS = LEARNING_KINDS | {
    "game", "story", "writing", "build", "project", "plan"
}


def _since(days: int) -> str:
    return local_day_start_utc(local_today() - timedelta(days=days - 1))


def child_stats(rt: Runtime, child: dict[str, Any], days: int = 7) -> dict[str, Any]:
    """Everything the dashboard shows for one child, computed from the database."""

    cid = int(child["id"])
    since = _since(days)
    sessions = rt.db.query("SELECT id, started_at, duration_seconds, language, activity, purpose, educational_turns FROM sessions WHERE child_id = ? AND started_at >= ?", (cid, since))
    msgs = rt.db.query("SELECT session_id, role, emotion FROM messages WHERE child_id = ? AND created_at >= ?", (cid, since[:19].replace("T", " ")))
    acts = rt.db.query("SELECT kind, score, max_score, duration_seconds, created_at FROM activities WHERE child_id = ? AND created_at >= ?", (cid, since))
    incidents = rt.db.query(
        "SELECT id, severity, is_sample, reviewed_at, created_at, notification_status "
        "FROM safety_incidents WHERE child_id = ?",
        (cid,),
    )
    window = day_range(days)
    minutes = {d: 0.0 for d in window}
    convos = {d: 0 for d in window}
    acts_by_day = {d: 0 for d in window}
    quiz_scores: dict[Any, list[float]] = defaultdict(list)
    msg_count: dict[int, int] = defaultdict(int)
    for m in msgs:
        msg_count[m["session_id"]] += 1
    for s in sessions:
        dt = parse_ts(s["started_at"])
        if dt and dt.date() in minutes:
            minutes[dt.date()] += int(s["duration_seconds"] or 0) / 60
            if msg_count.get(s["id"]):
                convos[dt.date()] += 1
    dist: dict[str, int] = defaultdict(int)
    for s in sessions:
        if msg_count.get(s["id"]):
            dist["chat"] += 1
    for a in acts:
        dt = parse_ts(a["created_at"])
        if not dt or dt.date() not in acts_by_day:
            continue
        acts_by_day[dt.date()] += 1
        dist[a["kind"]] += 1
        minutes[dt.date()] += int(a["duration_seconds"] or 0) / 60
        if a["kind"] in LEARNING_KINDS and a["score"] is not None and a["max_score"]:
            quiz_scores[dt.date()].append(100 * a["score"] / a["max_score"])
    today = local_today()
    usage = rt.controls.usage(child)
    limit_min = int(child["daily_minutes"])
    used_today = round(usage.used_seconds / 60, 1)
    pct = round(100 * usage.used_seconds / usage.limit_seconds) if usage.limit_seconds else 100
    open_flags = [i for i in incidents if not i["reviewed_at"]]
    kinds = defaultdict(int, dist)
    educational_sessions = [
        s for s in sessions
        if s.get("purpose", "general") == "educational" and int(s.get("educational_turns", 0)) > 0
    ]
    educational_activities = [a for a in acts if a["kind"] in EDUCATIONAL_ACTIVITY_KINDS]
    educational_seconds = sum(int(s.get("duration_seconds") or 0) for s in educational_sessions)
    educational_seconds += sum(int(a.get("duration_seconds") or 0) for a in educational_activities)
    return {
        "child": parent_child(child, rt),
        "days": days,
        "totals": {
            "minutes_today": round(max(used_today, minutes.get(today, 0)), 1),
            "general_minutes_used_today": round(usage.used_seconds / 60, 1),
            "general_minutes_remaining_today": round(usage.remaining_seconds / 60, 1),
            "educational_minutes": round(educational_seconds / 60, 1),
            "educational_sessions": len(educational_sessions) + len(educational_activities),
            "minutes_week": round(sum(minutes.values()), 1),
            "conversations": sum(convos.values()),
            "messages": sum(1 for m in msgs if m["role"] == "child"),
            "activities": sum(1 for a in acts if a["kind"] != "chat"),
            "learning_activities": sum(1 for a in acts if a["kind"] in LEARNING_KINDS),
            "games": kinds["game"],
            "quizzes": kinds["quiz"],
            "creations": sum(1 for a in acts if a["kind"] in ("drawing", "writing", "build", "story")),
            "safety_flags_open": len(open_flags),
            "safety_flags_total": len(incidents),
            "high_severity_open": sum(1 for i in open_flags if i["severity"] == "high"),
            "safety_notifications_failed": sum(
                1
                for i in open_flags
                if i["severity"] == "high"
                and not i["is_sample"]
                and i["notification_status"] in ("", "failed", "not_attempted", "pending", "attempted", "dashboard_only")
            ),
        },
        "limit": {"minutes": limit_min, "used_minutes": used_today, "percent": min(100, pct),
                  "status": "reached" if not usage.allowed else ("near" if pct >= 80 else "ok")},
        "daily": [{"date": d.isoformat(), "label": d.strftime("%a"), "minutes": round(minutes[d], 1),
                   "conversations": convos[d], "activities": acts_by_day[d],
                   "avg_score": round(sum(quiz_scores[d]) / len(quiz_scores[d])) if quiz_scores[d] else None}
                  for d in window],
        "distribution": sorted(
            [{"kind": k, "label": ACTIVITY_LABELS.get(k, k.title()), "count": v} for k, v in dist.items()],
            key=lambda x: -x["count"]),
        "emotions": _emotion_counts(msgs),
        "languages": _language_counts(sessions),
    }


def _emotion_counts(msgs: list[dict]) -> list[dict]:
    counts: dict[str, int] = defaultdict(int)
    for m in msgs:
        if m["role"] == "child" and m.get("emotion"):
            counts[m["emotion"]] += 1
    return [{"emotion": k, "count": v} for k, v in sorted(counts.items(), key=lambda x: -x[1])]


def _language_counts(sessions: list[dict]) -> list[dict]:
    counts: dict[str, int] = defaultdict(int)
    for s in sessions:
        counts[s["language"]] += 1
    return [{"language": k, "count": v} for k, v in sorted(counts.items(), key=lambda x: -x[1])]


@router.get("/dashboard/overview")
def overview(days: int = 7, rt: Runtime = Depends(get_runtime)):
    days = 7 if days not in (7, 14, 30) else days
    kids = [c for c in rt.db.list_children() if c["age_band"] != "0-3"]
    infants = [c for c in rt.db.list_children() if c["age_band"] == "0-3"]
    stats = [child_stats(rt, c, days) for c in kids]
    window = day_range(days)
    compare = [{"date": d.isoformat(), "label": d.strftime("%a"),
                **{s["child"]["nickname"]: next(x["minutes"] for x in s["daily"] if x["date"] == d.isoformat()) for s in stats}}
               for d in window]
    family = {
        "children": len(kids), "infants": len(infants),
        "minutes_today": round(sum(s["totals"]["minutes_today"] for s in stats), 1),
        "minutes_week": round(sum(s["totals"]["minutes_week"] for s in stats), 1),
        "general_minutes_used_today": round(sum(s["totals"]["general_minutes_used_today"] for s in stats), 1),
        "general_minutes_remaining_today": round(sum(s["totals"]["general_minutes_remaining_today"] for s in stats), 1),
        "educational_minutes": round(sum(s["totals"]["educational_minutes"] for s in stats), 1),
        "educational_sessions": sum(s["totals"]["educational_sessions"] for s in stats),
        "conversations": sum(s["totals"]["conversations"] for s in stats),
        "activities": sum(s["totals"]["activities"] for s in stats),
        "games": sum(s["totals"]["games"] for s in stats),
        "safety_flags_open": sum(s["totals"]["safety_flags_open"] for s in stats),
        "safety_notifications_failed": sum(
            s["totals"]["safety_notifications_failed"] for s in stats
        ),
    }
    dist: dict[str, int] = defaultdict(int)
    for s in stats:
        for d in s["distribution"]:
            dist[d["kind"]] += d["count"]
    return {
        "days": days, "family": family, "children": stats, "compare": compare,
        "compare_names": [s["child"]["nickname"] for s in stats],
        "distribution": sorted([{"kind": k, "label": ACTIVITY_LABELS.get(k, k.title()), "count": v} for k, v in dist.items()], key=lambda x: -x["count"]),
        "infants": [{"id": i["id"], "nickname": i["nickname"], "is_demo": bool(i.get("is_demo")),
                     "age": parent_child(i, rt)["age"], "age_months": parent_child(i, rt)["age_months"],
                     "developmental_stage": parent_child(i, rt)["developmental_stage"], "dob": i.get("dob")} for i in infants],
    }


@router.get("/dashboard/child/{child_id}")
def child_dashboard(child_id: int, days: int = 7, rt: Runtime = Depends(get_runtime)):
    days = 7 if days not in (7, 14, 30) else days
    child = child_or_404(rt, child_id)
    if child["age_band"] == "0-3":
        raise HTTPException(400, "Infant profiles use the infant care area")
    stats = child_stats(rt, child, days)
    stats["timeline"] = timeline(rt, child_id)
    stats["conversations"] = conversation_list(rt, child_id)
    stats["recent_quizzes"] = rt.db.query(
        "SELECT title, score, max_score, created_at FROM activities WHERE child_id = ? AND kind = 'quiz' ORDER BY created_at DESC LIMIT 6", (child_id,))
    stats["projects"] = rt.db.query("SELECT id, kind, title, status, due_on FROM projects WHERE child_id = ? ORDER BY status, id DESC LIMIT 8", (child_id,))
    stats["creations"] = rt.db.query("SELECT id, kind, title, created_at FROM creations WHERE child_id = ? ORDER BY id DESC LIMIT 8", (child_id,))
    stats["journal_entries"] = rt.db.query_one("SELECT COUNT(*) AS n FROM journal_entries WHERE child_id = ?", (child_id,))["n"]
    stats["blocked_topic_hits"] = rt.db.query(
        "SELECT created_at, category FROM safety_incidents WHERE child_id = ? AND category = 'parent_blocked_topic' ORDER BY created_at DESC LIMIT 10", (child_id,))
    return stats


def timeline(rt: Runtime, child_id: int, limit: int = 25) -> list[dict]:
    items: list[dict] = []
    for a in rt.db.query("SELECT kind, title, score, max_score, created_at FROM activities WHERE child_id = ? ORDER BY created_at DESC LIMIT 30", (child_id,)):
        label = ACTIVITY_LABELS.get(a["kind"], a["kind"].title())
        score = f" · {a['score']}/{a['max_score']}" if a["score"] is not None and a["max_score"] else ""
        items.append({"at": a["created_at"], "type": "activity", "kind": a["kind"], "title": a["title"] or label, "detail": f"{label}{score}"})
    for s in rt.db.query(
        "SELECT s.started_at, s.activity, s.language, s.duration_seconds, (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id) AS n "
        "FROM sessions s WHERE s.child_id = ? ORDER BY s.started_at DESC LIMIT 15", (child_id,)):
        if s["n"]:
            items.append({"at": s["started_at"], "type": "conversation", "kind": "chat",
                          "title": {"chat": "Chat with Mallow", "story": "Story time", "bedtime": "Bedtime story", "study": "Study help", "homework": "Homework help", "explain": "Explanation"}.get(s["activity"], "Chat with Mallow"),
                          "detail": f"{s['n']} messages · {s['language']} · {round(s['duration_seconds'] / 60)} min"})
    for i in rt.db.query("SELECT created_at, category, severity, reviewed_at FROM safety_incidents WHERE child_id = ? ORDER BY created_at DESC LIMIT 10", (child_id,)):
        items.append({"at": i["created_at"], "type": "safety", "kind": "safety", "title": "Safety note" + (" (reviewed)" if i["reviewed_at"] else ""), "detail": i["category"].replace("_", " ")})
    items.sort(key=lambda x: parse_ts(x["at"]) or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    return items[:limit]


def conversation_list(rt: Runtime, child_id: int, limit: int = 12) -> list[dict]:
    rows = rt.db.query(
        "SELECT s.id, s.started_at, s.activity, s.language, s.duration_seconds, "
        "(SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id AND m.role = 'child') AS child_msgs, "
        "(SELECT text FROM messages m WHERE m.session_id = s.id AND m.role = 'child' ORDER BY m.id LIMIT 1) AS first_text, "
        "(SELECT COUNT(*) FROM safety_incidents i WHERE i.session_id = s.id) AS flags "
        "FROM sessions s WHERE s.child_id = ? ORDER BY s.started_at DESC LIMIT ?", (child_id, limit * 2))
    out = []
    for r in rows:
        if not r["child_msgs"]:
            continue
        first = (r["first_text"] or "")
        out.append({"id": r["id"], "started_at": r["started_at"], "mode": r["activity"], "language": r["language"],
                    "minutes": round((r["duration_seconds"] or 0) / 60), "messages": r["child_msgs"],
                    "preview": first[:90] + ("…" if len(first) > 90 else ""), "flags": r["flags"]})
    return out[:limit]


@router.get("/dashboard/child/{child_id}/conversation/{session_id}")
def transcript(child_id: int, session_id: int, rt: Runtime = Depends(get_runtime)):
    child_or_404(rt, child_id)
    s = rt.db.get_session(session_id)
    if not s or int(s["child_id"]) != child_id:
        raise HTTPException(404, "Conversation not found")
    return {"session": s, "messages": [{"role": m["role"], "text": m["text"], "created_at": m["created_at"], "emotion": m.get("emotion", "")} for m in rt.db.list_messages(session_id)]}


# --------------------------------------------------------------------- safety
@router.get("/safety/incidents")
def incidents(child_id: int | None = None, status: str = "all", rt: Runtime = Depends(get_runtime)):
    sql = (
        "SELECT i.id, i.child_id, c.nickname, c.is_demo, i.session_id, i.category, "
        "i.detail, i.severity, i.is_sample, i.created_at, i.reviewed_at, i.parent_note, "
        "i.language, i.notification_status, i.notification_channel, "
        "i.notification_recipient, i.notification_attempted_at, "
        "i.notification_delivered_at "
        "FROM safety_incidents i JOIN children c ON c.id = i.child_id WHERE 1=1"
    )
    params: list = []
    if child_id is not None:
        sql += " AND i.child_id = ?"
        params.append(child_id)
    if status == "open":
        sql += " AND i.reviewed_at IS NULL"
    elif status == "reviewed":
        sql += " AND i.reviewed_at IS NOT NULL"
    return rt.db.query(sql + " ORDER BY i.created_at DESC, i.id DESC LIMIT 100", params)


class ReviewIn(BaseModel):
    note: str = Field(default="", max_length=400)


@router.post("/safety/incidents/{incident_id}/review")
def review(incident_id: int, body: ReviewIn, rt: Runtime = Depends(get_runtime)):
    row = rt.db.query_one("SELECT id FROM safety_incidents WHERE id = ?", (incident_id,))
    if not row:
        raise HTTPException(404, "Not found")
    rt.db.execute("UPDATE safety_incidents SET reviewed_at = ?, parent_note = ? WHERE id = ?", (utc_iso(datetime.now(timezone.utc)), body.note.strip(), incident_id))
    return {"ok": True}


@router.post("/safety/incidents/{incident_id}/reopen")
def reopen(incident_id: int, rt: Runtime = Depends(get_runtime)):
    rt.db.execute("UPDATE safety_incidents SET reviewed_at = NULL WHERE id = ?", (incident_id,))
    return {"ok": True}
