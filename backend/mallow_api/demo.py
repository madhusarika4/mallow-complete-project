"""Clearly-labelled demo family. Rows are real database rows flagged is_demo / is_sample.

Demo children are separate profiles (never mixed into a family's own children) and
can be reset or removed at any time from Parent space -> Settings.
"""

from __future__ import annotations

import json
import random
from contextlib import closing
from datetime import date, datetime, timedelta, timezone

from mallow_api.timeutil import local_tz
from runtime import Runtime
from services.age import band_for_age, age_in_years
from services.languages import parse_languages

DEMO_CHILDREN = [
    dict(nickname="Aanya", years=5, months=3, languages="English,Telugu", daily=30, blocked="ghosts",
         kinds=["story", "game", "riddle", "drawing", "quiz", "feelings"], quiz="Colours & shapes"),
    dict(nickname="Kabir", years=8, months=2, languages="English,Hinglish", daily=45, blocked="",
         kinds=["quest", "science", "math", "quiz", "game", "writing"], quiz="Space quiz"),
    dict(nickname="Meera", years=11, months=6, languages="English,Telugu,Hinglish", daily=60, blocked="gossip",
         kinds=["study", "quiz", "project", "flashcards", "writing", "learning"], quiz="Fractions check"),
]
CONVOS = {
    "4-6": [("Tell me a story about a bunny", "Once there was a little bunny who found a shiny red button. Where do you think it came from?"),
            ("I like the colour blue", "Blue is lovely, like the sky. Can you find something blue in the room?"),
            ("Why is the moon up", "The moon shines at night. It likes to watch over us while we sleep.")],
    "7-9": [("How do volcanoes work", "Hot melted rock called magma pushes up through cracks. When it escapes it is called lava. Want a mini quest about it?"),
            ("What is 7 times 8", "Seven times eight is fifty six. Nice question! Can you tell me how you would check it?"),
            ("Help me start a story", "Let's begin: In a quiet forest, a lantern began to glow. Who finds it?")],
    "10-12": [("Can you help me with fractions", "Of course. Let's start with one half and one quarter. Which is bigger, and how do you know?"),
              ("I need to plan my science project", "Great. First pick a question, then list three steps. What would you like to find out?"),
              ("Why do we have seasons", "The Earth is tilted as it goes around the Sun. Can you explain what the tilt changes?")],
}


def _utc_naive(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def _utc_iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat(timespec="seconds")


def remove_demo(rt: Runtime) -> dict:
    ids = [c["id"] for c in rt.db.list_children() if c.get("is_demo")]
    for cid in ids:
        rt.db.delete_child(int(cid))
    return {"removed": len(ids)}


def seed_demo(rt: Runtime) -> dict:
    remove_demo(rt)
    rng = random.Random(2026)
    tz = local_tz()
    today = datetime.now(tz).replace(minute=0, second=0, microsecond=0)
    created: list[int] = []
    voice_cache: dict[str, object] = {}
    with closing(rt.db.connect()) as conn:
        for spec in DEMO_CHILDREN:
            dob = (date.today() - timedelta(days=int(spec["years"] * 365.25 + spec["months"] * 30.4)))
            band = band_for_age(age_in_years(dob))
            first = parse_languages(spec["languages"])[0]
            voice = voice_cache.setdefault(first, rt.voice_catalogue.default_selection(first))
            cur = conn.execute(
                "INSERT INTO children (nickname, age_band, languages, voice_preset, voice_engine, voice_id, voice_language, "
                "voice_locale, activities, blocked_topics, daily_minutes, voice_enabled, dob, dob_exact, is_demo, preferred_language) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,1,?,1,1,?)",
                (spec["nickname"], band, spec["languages"], voice.voice_id or "default", voice.engine, voice.voice_id,
                 voice.language, voice.locale,
                 "chat,stories,games,riddles,quizzes,learning,create,quests,science,maths,writing,journal,projects,study",
                 spec["blocked"], spec["daily"], dob.isoformat(), first))
            cid = int(cur.lastrowid)
            created.append(cid)
            langs = parse_languages(spec["languages"])
            for back in range(13, -1, -1):
                if back and rng.random() < 0.18:
                    continue  # quiet day
                day = today - timedelta(days=back)
                for _ in range(rng.choice([1, 1, 2])):
                    hour = rng.choice([16, 17, 18, 19]) if back else rng.choice([7, 8])
                    start = day.replace(hour=hour, minute=rng.choice([0, 10, 25, 40]))
                    if start > datetime.now(tz) - timedelta(minutes=30):
                        start = datetime.now(tz) - timedelta(minutes=45)
                    dur = rng.randint(6, 18) * 60
                    mode = rng.choice(["chat", "chat", "story", "study" if band == "10-12" else "chat"])
                    lang = rng.choice(langs)
                    s = conn.execute("INSERT INTO sessions (child_id, started_at, last_activity_at, duration_seconds, language, activity, is_sample) VALUES (?,?,?,?,?,?,1)",
                                     (cid, _utc_iso(start), _utc_iso(start + timedelta(seconds=dur)), dur, lang, mode))
                    sid = int(s.lastrowid)
                    for k in range(rng.randint(2, 4)):
                        q, a = rng.choice(CONVOS[band])
                        t = start + timedelta(seconds=40 * k)
                        conn.execute("INSERT INTO messages (session_id, child_id, role, text, language, is_sample, created_at, emotion) VALUES (?,?,?,?,?,1,?,?)",
                                     (sid, cid, "child", q, lang, _utc_naive(t), rng.choice(["", "", "curious", "happy"])))
                        conn.execute("INSERT INTO messages (session_id, child_id, role, text, language, is_sample, created_at) VALUES (?,?,?,?,?,1,?)",
                                     (sid, cid, "assistant", a, lang, _utc_naive(t + timedelta(seconds=15))))
                for n in range(rng.choice([1, 2, 3])):
                    kind = rng.choice(spec["kinds"])
                    t = day.replace(hour=rng.choice([15, 16, 17, 18]), minute=rng.randint(0, 59))
                    if t > datetime.now(tz):
                        t = datetime.now(tz) - timedelta(hours=1)
                    score = mx = None
                    title = {"story": "Bedtime story", "game": "Memory match", "riddle": "Riddle time", "drawing": "My drawing",
                             "quiz": spec["quiz"], "feelings": "Feelings check-in", "quest": "Planet quest", "science": "Science lab",
                             "math": "Maths sprint", "writing": "Story writing", "study": "Study session", "project": "Project step",
                             "flashcards": "Flashcards", "learning": "Learning plan"}.get(kind, kind.title())
                    if kind in ("quiz", "math", "quest", "flashcards", "science", "study"):
                        mx = 5
                        score = min(5, max(1, int(round(2.6 + (13 - back) * 0.12 + rng.uniform(-1, 1)))))
                    conn.execute("INSERT INTO activities (child_id, kind, title, score, max_score, duration_seconds, language, is_sample, created_at) VALUES (?,?,?,?,?,?,?,1,?)",
                                 (cid, kind, title, score, mx, rng.randint(180, 900), rng.choice(langs), _utc_iso(t)))
            # incidents (clearly flagged samples)
            if spec["nickname"] == "Aanya":
                conn.execute("INSERT INTO safety_incidents (child_id, category, detail, severity, is_sample, created_at) VALUES (?, 'parent_blocked_topic', ?, 'info', 1, ?)",
                             (cid, "A topic you blocked came up and Mallow steered away from it.", _utc_naive(today - timedelta(days=2))))
            if spec["nickname"] == "Kabir":
                conn.execute("INSERT INTO safety_incidents (child_id, category, detail, severity, is_sample, reviewed_at, parent_note, created_at) VALUES (?, 'personal_info', ?, 'info', 1, ?, 'Talked about not sharing details.', ?)",
                             (cid, "Mallow declined a request about personal information.", _utc_iso(today - timedelta(days=3)), _utc_naive(today - timedelta(days=4))))
            if spec["nickname"] == "Meera":
                conn.execute("INSERT INTO safety_incidents (child_id, category, detail, severity, is_sample, created_at) VALUES (?, 'serious_disclosure', ?, 'high', 1, ?)",
                             (cid, "Mallow noticed words that may mean your child feels unsafe or very upset. Please check in with them calmly. They were encouraged to talk to a trusted adult.", _utc_naive(today - timedelta(days=1))))
                for i, (txt, mood) in enumerate([("Today was a good day. I finished my maths worksheet.", "happy"),
                                                 ("A bit nervous about the science fair.", "worried"),
                                                 ("Played football at lunch.", "calm")]):
                    conn.execute("INSERT INTO journal_entries (child_id, text, mood, is_sample, created_at) VALUES (?,?,?,1,?)", (cid, txt, mood, _utc_naive(today - timedelta(days=i * 3 + 1))))
                conn.execute("INSERT INTO projects (child_id, kind, title, goal, due_on, steps_json, is_sample) VALUES (?, 'project', 'Solar system model', 'Build a model for the science fair', ?, ?, 1)",
                             (cid, (date.today() + timedelta(days=9)).isoformat(),
                              json.dumps([{"text": "Choose materials", "done": True}, {"text": "Paint the planets", "done": True}, {"text": "Write fact cards", "done": False}, {"text": "Practise the talk", "done": False}])))
                conn.execute("INSERT INTO projects (child_id, kind, title, goal, steps_json, is_sample) VALUES (?, 'plan', 'Fractions revision', 'Feel confident with fractions', ?, 1)",
                             (cid, json.dumps([{"text": "Review halves and quarters", "done": True}, {"text": "Practise adding fractions", "done": False}])))
            if spec["nickname"] == "Kabir":
                conn.execute("INSERT INTO creations (child_id, kind, title, content, is_sample) VALUES (?, 'story', 'The Moon Robot', 'A little robot lived on the moon. Every night it polished the stars so they would shine for everyone below.', 1)", (cid,))

        # ---- infant
        months = 8
        idob = date.today() - timedelta(days=int(months * 30.4))
        voice = rt.voice_catalogue.default_selection("English")
        cur = conn.execute(
            "INSERT INTO children (nickname, age_band, languages, voice_preset, activities, daily_minutes, voice_enabled, dob, dob_exact, is_demo, preferred_language) "
            "VALUES ('Baby Kiran','0-3','English','default','',0,0,?,1,1,'English')", (idob.isoformat(),))
        iid = int(cur.lastrowid)
        created.append(iid)
        now_local = datetime.now(tz).replace(tzinfo=None)
        for back in range(13, -1, -1):
            day = (now_local - timedelta(days=back)).replace(hour=0, minute=0, second=0, microsecond=0)
            for h in (6.5, 9.5, 12.5, 15.5, 18.5, 21.0) + ((2.5,) if rng.random() < 0.5 else ()):
                t = day + timedelta(hours=h + rng.uniform(-0.3, 0.3))
                if t > now_local:
                    continue
                typ = rng.choice(["bottle", "bottle", "breastfeeding", "solids"] if h in (12.5, 18.5) else ["bottle", "breastfeeding"])
                conn.execute("INSERT INTO infant_care (child_id, event_type, timestamp, amount_ml, duration_minutes, subtype, is_sample) VALUES (?,?,?,?,?,?,1)",
                             (iid, "feeding", t.isoformat(timespec="minutes"), rng.choice([120, 150, 180]) if typ == "bottle" else None,
                              rng.choice([10, 15, 20]) if typ == "breastfeeding" else None, typ))
            night_start = day.replace(hour=20, minute=rng.choice([0, 15, 30, 45]))
            night_end = night_start + timedelta(hours=rng.choice([9, 9.5, 10, 10.5]))
            for st, en, kind in [(night_start, night_end, "night")] + [
                    (day + timedelta(hours=h), day + timedelta(hours=h, minutes=rng.choice([45, 60, 75, 90])), "nap") for h in (9.0, 13.0)]:
                if st > now_local:
                    continue
                if en > now_local:
                    en = now_local
                conn.execute("INSERT INTO infant_care (child_id, event_type, timestamp, end_timestamp, duration_minutes, subtype, is_sample) VALUES (?,?,?,?,?,?,1)",
                             (iid, "sleep", st.isoformat(timespec="minutes"), en.isoformat(timespec="minutes"), int((en - st).total_seconds() // 60), kind))
            for h in (7, 10, 13, 16, 19, 21) + ((23,) if rng.random() < 0.4 else ()):
                t = day + timedelta(hours=h, minutes=rng.randint(0, 40))
                if t > now_local:
                    continue
                conn.execute("INSERT INTO infant_care (child_id, event_type, timestamp, subtype, is_sample) VALUES (?,?,?,?,1)",
                             (iid, "diaper", t.isoformat(timespec="minutes"), rng.choice(["wet", "wet", "wet", "dirty", "mixed"])))
        for i, (w, l, hc) in enumerate([(6.9, 66.0, 42.5), (7.4, 68.0, 43.4), (7.9, 70.0, 44.1), (8.3, 71.5, 44.8)]):
            d = date.today() - timedelta(days=(3 - i) * 30 + 2)
            conn.execute("INSERT INTO growth_records (child_id, measured_on, weight_kg, length_cm, head_cm, is_sample) VALUES (?,?,?,?,?,1)", (iid, d.isoformat(), w, l, hc))
        for d, title, cat in [(date.today() - timedelta(days=75), "First laugh", "social"), (date.today() - timedelta(days=40), "Rolled over", "movement"),
                              (date.today() - timedelta(days=12), "Sat without support", "movement")]:
            conn.execute("INSERT INTO milestones (child_id, achieved_on, title, category, is_sample) VALUES (?,?,?,?,1)", (iid, d.isoformat(), title, cat))
        for title, due in [("Vaccination appointment (sample)", datetime.now() + timedelta(days=5)), ("Start new solid food (sample)", datetime.now() + timedelta(days=2))]:
            conn.execute("INSERT INTO reminders (child_id, title, due_at, is_sample) VALUES (?,?,?,1)", (iid, title, due.replace(second=0, microsecond=0).isoformat(timespec="minutes")))
        conn.commit()
    return {"children": len(created), "ids": created}
