"""End-to-end API tests (real FastAPI app, real SQLite, mock-free offline companion)."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from config import AppConfig, ProviderConfig, DEFAULT_HELPLINE
from mallow_api.main import create_app
from services.safety_escalation import NotificationResult


@pytest.fixture
def client(tmp_path: Path):
    cfg = AppConfig(
        llm=ProviderConfig("", "", ""), stt=ProviderConfig("", "", ""), tts=ProviderConfig("", "", ""),
        tts_voices=(), moderation_model="", helpline_text=DEFAULT_HELPLINE,
        db_path=tmp_path / "t.db", enable_online_voices=False,
    )
    app = create_app(cfg)
    c = TestClient(app)
    c.post("/api/auth/consent")
    token = c.post("/api/auth/setup-pin", json={"pin": "1234"}).json()["token"]
    c.headers["X-Parent-Token"] = token
    return c


def mk(client, name="Aanya", age=5, **kw):
    r = client.post("/api/children", json={"nickname": name, "age": age, "languages": ["English", "Telugu"], **kw})
    assert r.status_code == 201, r.text
    return r.json()


def test_bootstrap_and_auth(client):
    b = client.get("/api/bootstrap").json()
    assert b["consent"] and b["pin_set"] and b["services"]["offline_companion"] is True
    anon = TestClient(client.app)
    assert anon.post("/api/children", json={"nickname": "X", "age": 5}).status_code == 401
    assert anon.post("/api/auth/login", json={"pin": "0000"}).status_code == 401
    assert anon.post("/api/auth/login", json={"pin": "1234"}).status_code == 200


def test_pin_lockout(client):
    anon = TestClient(client.app)
    for _ in range(4):
        assert anon.post("/api/auth/login", json={"pin": "bad!"}).status_code == 401
    assert anon.post("/api/auth/login", json={"pin": "bad!"}).status_code == 429
    assert anon.post("/api/auth/login", json={"pin": "1234"}).status_code == 429


def test_add_edit_remove_child_and_age_bands(client):
    a, b, c, baby = mk(client, "A", 5), mk(client, "B", 8), mk(client, "C", 11), mk(client, "Baby", 1)
    assert [x["age_band"] for x in (a, b, c, baby)] == ["4-6", "7-9", "10-12", "0-3"]
    assert baby["voice_enabled"] is False and baby["is_infant"] is True
    r = client.patch(f"/api/children/{a['id']}", json={"age": 8, "nickname": "A2", "daily_minutes": 20})
    assert r.json()["age_band"] == "7-9" and r.json()["nickname"] == "A2" and r.json()["daily_minutes"] == 20
    assert client.post("/api/children", json={"nickname": "Old", "age": 15}).status_code == 422
    assert client.post("/api/children", json={"nickname": "F", "dob": (date.today() + timedelta(days=3)).isoformat()}).status_code == 422
    assert client.post("/api/children", json={"nickname": "", "age": 5}).status_code == 422
    assert client.delete(f"/api/children/{b['id']}").status_code == 400
    assert client.delete(f"/api/children/{b['id']}?confirm=true").status_code == 200
    assert client.get(f"/api/children/{b['id']}").status_code == 404
    assert len(client.get("/api/children").json()) == 3


def test_child_grows_into_new_band(client):
    dob = date.today() - timedelta(days=int(6.99 * 365.25))
    kid = client.post("/api/children", json={"nickname": "Grow", "dob": dob.isoformat()}).json()
    assert kid["age_band"] == "7-9" or kid["age_band"] == "4-6"
    rt = client.app.state.runtime
    rt.db.execute("UPDATE children SET dob = ?, age_band = '4-6' WHERE id = ?", ((date.today() - timedelta(days=int(7.2 * 365.25))).isoformat(), kid["id"]))
    assert client.get(f"/api/children/{kid['id']}").json()["age_band"] == "7-9"  # auto-updates, data kept


@pytest.mark.parametrize("months,stage", [
    (0, "0-5 months"), (5, "0-5 months"), (6, "6-11 months"),
    (11, "6-11 months"), (12, "12-17 months"), (17, "12-17 months"),
    (18, "18-23 months"), (23, "18-23 months"), (24, "24-29 months"),
    (29, "24-29 months"), (30, "30-35 months"), (35, "30-35 months"),
])
def test_create_child_with_month_age_uses_dob_as_source(months, stage, client):
    from services.age import age_in_months, parse_dob

    response = client.post("/api/children", json={"nickname": "Toddler", "age_months": months})
    assert response.status_code == 201, response.text
    child = response.json()
    assert child["age_months"] == months
    assert child["developmental_stage"] == stage
    assert child["age_band"] == "0-3" and child["is_infant"] is True
    assert child["voice_enabled"] is False
    assert child["dob_exact"] is False
    stored = client.app.state.runtime.db.get_child(child["id"])
    assert age_in_months(parse_dob(stored["dob"])) == months


def test_month_age_range_transitions_to_existing_year_system(client):
    toddler = client.post("/api/children", json={"nickname": "Three", "age": 3}).json()
    assert toddler["age_months"] == 36
    assert toddler["age_band"] == "0-3"
    assert toddler["developmental_stage"] == "3 years"
    assert client.post("/api/children", json={"nickname": "Too old for months", "age_months": 36}).status_code == 422

    from services.age import dob_from_age_months
    rt = client.app.state.runtime
    rt.db.execute("UPDATE children SET dob = ? WHERE id = ?", (dob_from_age_months(47).isoformat(), toddler["id"]))
    at_47 = client.get(f"/api/children/{toddler['id']}").json()
    assert at_47["age_months"] == 47 and at_47["age_band"] == "0-3"
    rt.db.execute("UPDATE children SET dob = ? WHERE id = ?", (dob_from_age_months(48).isoformat(), toddler["id"]))
    at_48 = client.get(f"/api/children/{toddler['id']}").json()
    assert at_48["age_months"] == 48 and at_48["age_band"] == "4-6"
    assert at_48["developmental_stage"] == "4-6 years"


def test_public_view_hides_parent_fields(client):
    kid = mk(client, blocked_topics=["ghosts"])
    anon = TestClient(client.app)
    pub = anon.get(f"/api/children/{kid['id']}").json()
    assert "blocked_topics" not in pub
    assert client.get(f"/api/children/{kid['id']}").json()["blocked_topics"] == ["ghosts"]


def test_chat_flow_data_separation_and_blocked_topics(client):
    a, b = mk(client, "A", 5, blocked_topics=["ghosts"]), mk(client, "B", 9)
    sa = client.post("/api/chat/session", json={"child_id": a["id"], "language": "English"}).json()["session_id"]
    sb = client.post("/api/chat/session", json={"child_id": b["id"], "language": "English"}).json()["session_id"]
    r = client.post("/api/chat/turn", json={"child_id": a["id"], "session_id": sa, "text": "tell me a story"}).json()
    assert r["reply"] and r["offline"] is True and not r["blocked"]
    # a child cannot use another child's session
    assert client.post("/api/chat/turn", json={"child_id": b["id"], "session_id": sa, "text": "hi"}).status_code == 404
    client.post("/api/chat/turn", json={"child_id": b["id"], "session_id": sb, "text": "what is 3 plus 4"})
    msgs_a = client.get(f"/api/chat/session/{sa}/messages", params={"child_id": a["id"]}).json()
    msgs_b = client.get(f"/api/chat/session/{sb}/messages", params={"child_id": b["id"]}).json()
    assert all("plus" not in m["text"] for m in msgs_a) and any("7" in m["text"] for m in msgs_b)
    blocked = client.post("/api/chat/turn", json={"child_id": a["id"], "session_id": sa, "text": "tell me about ghosts"}).json()
    assert blocked["blocked"]
    inc = client.get("/api/safety/incidents", params={"child_id": a["id"]}).json()
    assert inc and inc[0]["category"] == "parent_blocked_topic"
    assert client.get("/api/safety/incidents", params={"child_id": b["id"]}).json() == []


def test_general_chat_routes_to_general_llm_and_story_only_when_asked(client):
    from services.errors import ServiceError
    from services.llm_service import MockLLM

    kid = mk(client, "Meera", 11)
    sid = client.post("/api/chat/session", json={"child_id": kid["id"], "mode": "story"}).json()["session_id"]
    rt = client.app.state.runtime

    llm = MockLLM(responder=lambda messages: "Start with ten minutes on fractions, then a short break.")
    rt.chat.llm = llm
    plan = client.post("/api/chat/turn", json={
        "child_id": kid["id"], "session_id": sid, "mode": "story",
        "text": "Help me make a study plan for my maths test in five days.",
    }).json()
    assert "ten minutes" in plan["reply"]
    general_prompt = llm.calls[-1]["messages"][0]["content"]
    assert "The child asked for a story" not in general_prompt

    story = client.post("/api/chat/turn", json={
        "child_id": kid["id"], "session_id": sid, "mode": "story",
        "text": "Please tell me a short story about a brave little cat.",
    }).json()
    assert story["reply"]
    story_prompt = llm.calls[-1]["messages"][0]["content"]
    assert "The child asked for a story" in story_prompt

    rt.chat.llm = MockLLM(error=ServiceError("provider down"))
    failed = client.post("/api/chat/turn", json={
        "child_id": kid["id"], "session_id": sid, "mode": "story",
        "text": "Explain how plants make food.",
    }).json()
    assert "thinking helper" in failed["reply"]
    assert "story helper" not in failed["reply"]
    assert failed["provider_error"] is True


def test_duplicate_turn_not_repeated(client):
    kid = mk(client)
    sid = client.post("/api/chat/session", json={"child_id": kid["id"]}).json()["session_id"]
    body = {"child_id": kid["id"], "session_id": sid, "text": "hello", "client_turn_id": "abc"}
    first = client.post("/api/chat/turn", json=body).json()
    second = client.post("/api/chat/turn", json=body).json()
    assert second["duplicate"] and second["reply"] == first["reply"]
    assert len(client.get(f"/api/chat/session/{sid}/messages", params={"child_id": kid["id"]}).json()) == 2


def test_disclosure_flags_parent_and_is_supportive(client):
    kid = mk(client, "Meera", 10)
    sid = client.post("/api/chat/session", json={"child_id": kid["id"]}).json()["session_id"]
    r = client.post("/api/chat/turn", json={"child_id": kid["id"], "session_id": sid, "text": "I don't feel safe at home"}).json()
    assert r["is_disclosure"] and "trusted adult" in r["reply"] and r["helpline"]
    inc = client.get("/api/safety/incidents", params={"status": "open"}).json()
    assert inc[0]["severity"] == "high"
    client.post(f"/api/safety/incidents/{inc[0]['id']}/review", json={"note": "Spoke with her"})
    assert client.get("/api/safety/incidents", params={"status": "open"}).json() == []
    assert client.get("/api/safety/incidents", params={"status": "reviewed"}).json()[0]["parent_note"] == "Spoke with her"


def test_time_limit_and_voice_permission(client):
    kid = mk(client, daily_minutes=0)
    sid = client.post("/api/chat/session", json={"child_id": kid["id"]}).json()
    assert sid["limit_reached"] is True
    r = client.post("/api/chat/turn", json={"child_id": kid["id"], "session_id": sid["session_id"], "text": "hi"}).json()
    assert r["limit_reached"]
    off = mk(client, "Quiet", 6, voice_enabled=False)
    resp = client.post("/api/voice/speak", json={"child_id": off["id"], "text": "Hello there"})
    assert resp.status_code == 403 and resp.json()["detail"]["code"] == "voice_off"
    resp = client.post("/api/voice/transcribe", data={"child_id": off["id"], "language": "English"}, files={"audio": ("a.webm", b"x" * 2000)})
    assert resp.status_code == 403


def test_educational_chat_is_unlimited_and_separate_from_general_allowance(client):
    kid = mk(client, "Aanya", 8, daily_minutes=0)
    other = mk(client, "Kabir", 9, daily_minutes=5)
    general = client.post("/api/chat/session", json={"child_id": kid["id"], "mode": "chat"}).json()
    assert general["limit_reached"] is True
    blocked = client.post("/api/chat/turn", json={
        "child_id": kid["id"], "session_id": general["session_id"], "mode": "chat", "text": "hello",
    }).json()
    assert blocked["limit_reached"] is True

    learning = client.post("/api/chat/session", json={"child_id": kid["id"], "mode": "homework"}).json()
    assert learning["limit_reached"] is False and learning["purpose"] == "educational"
    rt = client.app.state.runtime
    started = (datetime.now().astimezone() - timedelta(minutes=2)).astimezone().isoformat(timespec="seconds")
    rt.db.execute("UPDATE sessions SET started_at = ? WHERE id = ?", (started, learning["session_id"]))
    answer = client.post("/api/chat/turn", json={
        "child_id": kid["id"], "session_id": learning["session_id"], "mode": "homework",
        "source": "voice", "text": "Help me understand fractions with an example.",
    }).json()
    assert answer["reply"] and answer["limit_reached"] is False
    session = rt.db.get_session(learning["session_id"])
    assert session["purpose"] == "educational" and session["educational_turns"] == 1
    assert session["duration_seconds"] >= 110
    status = rt.controls.usage(rt.db.get_child(kid["id"]))
    assert status.used_seconds == 0 and status.remaining_seconds == 0

    other_mode = client.post("/api/chat/session", json={"child_id": other["id"], "mode": "chat"}).json()
    assert other_mode["limit_reached"] is False
    rt.db.execute("UPDATE sessions SET duration_seconds = 120 WHERE id = ?", (other_mode["session_id"],))
    assert rt.controls.usage(rt.db.get_child(other["id"])).used_seconds == 120
    assert rt.controls.usage(rt.db.get_child(other["id"])).remaining_seconds == 180
    activity = client.post(f"/api/children/{kid['id']}/activities", json={
        "kind": "science", "title": "Science lesson", "duration_seconds": 60,
    })
    assert activity.status_code == 201
    stats = client.get(f"/api/dashboard/child/{kid['id']}").json()
    assert stats["totals"]["general_minutes_used_today"] == 0
    assert stats["totals"]["general_minutes_remaining_today"] == 0
    assert stats["totals"]["educational_sessions"] == 2
    assert stats["totals"]["educational_minutes"] >= 3


def test_educational_label_does_not_unlock_ordinary_chat(client):
    kid = mk(client, daily_minutes=0)
    study = client.post("/api/chat/session", json={"child_id": kid["id"], "mode": "study"}).json()
    response = client.post("/api/chat/turn", json={
        "child_id": kid["id"], "session_id": study["session_id"], "mode": "study", "text": "Tell me a joke.",
    }).json()
    assert response["blocked"] is True and response["limit_reached"] is False
    assert "space is for learning" in response["reply"].lower()
    assert client.app.state.runtime.db.get_session(study["session_id"])["educational_turns"] == 0
    general = client.post("/api/chat/session", json={"child_id": kid["id"], "mode": "chat"}).json()
    mismatch = client.post("/api/chat/turn", json={
        "child_id": kid["id"], "session_id": general["session_id"], "mode": "study", "text": "What is gravity?",
    })
    assert mismatch.status_code == 409


@pytest.mark.parametrize("mode", ["chat", "study"])
@pytest.mark.parametrize("message", [
    "I want to kill myself.",
    "I am being bullied.",
    "My uncle hits me.",
    "Someone is threatening me.",
    "An adult at school told me to keep what happened a secret.",
    "I am in immediate danger.",
    "I feel hopeless.",
])
def test_crisis_safety_precedes_educational_and_time_checks(client, mode, message):
    kid = mk(client, "Aanya", 8, daily_minutes=0)
    opened = client.post("/api/chat/session", json={"child_id": kid["id"], "mode": mode}).json()
    assert opened["limit_reached"] is (mode == "chat")

    response = client.post("/api/chat/turn", json={
        "child_id": kid["id"], "session_id": opened["session_id"], "mode": mode,
        "source": "voice" if message == "I am in immediate danger." else "text",
        "text": message,
    }).json()

    assert response["is_disclosure"] is True
    assert response["limit_reached"] is False
    assert response["safety_layer"] == "disclosure"
    assert "trusted adult" in response["reply"].lower()
    assert response["helpline"]
    incident = client.get("/api/safety/incidents", params={"child_id": kid["id"]}).json()[0]
    assert incident["severity"] == "high"
    assert incident["notification_status"] == "dashboard_only"
    if mode == "study":
        session = client.app.state.runtime.db.get_session(opened["session_id"])
        assert session["purpose"] == "educational"
        assert session["educational_turns"] == 0


def test_ordinary_homework_frustration_is_not_escalated_as_a_crisis(client):
    kid = mk(client, "Aanya", 8, daily_minutes=0)
    opened = client.post("/api/chat/session", json={"child_id": kid["id"], "mode": "study"}).json()
    response = client.post("/api/chat/turn", json={
        "child_id": kid["id"], "session_id": opened["session_id"], "mode": "study",
        "text": "This maths homework is frustrating and I feel stuck.",
    }).json()

    assert response["is_disclosure"] is False
    assert response["safety_layer"] == "educational_boundary"
    assert client.get("/api/safety/incidents", params={"child_id": kid["id"]}).json() == []


def test_voice_failure_is_graceful(client):
    kid = mk(client)
    r = client.post("/api/voice/speak", json={"child_id": kid["id"], "text": "Hello there"})
    assert r.status_code == 503 and r.json()["detail"]["code"] == "tts_unavailable"
    r = client.post("/api/voice/transcribe", data={"child_id": kid["id"], "language": "English"}, files={"audio": ("a.webm", b"x" * 2000)})
    assert r.status_code == 503 and r.json()["detail"]["code"] == "stt_unavailable"
    r = client.post("/api/voice/transcribe", data={"child_id": kid["id"], "language": "English"}, files={"audio": ("a.webm", b"x")})
    assert r.status_code == 422 and r.json()["detail"]["code"] == "no_audio"


def test_voice_speak_with_mock_engine(client):
    from services.tts_service import SpeechAudio

    kid = mk(client)
    rt = client.app.state.runtime
    seen = {}

    class Fake:
        name, label = "edge", "Fake"

        def entries(self): return []
        def synthesize(self, *a, **k): return SpeechAudio(b"ID3audio")
        def synthesize_mood(self, text, voice_id, language, mood):
            seen["mood"] = mood
            return SpeechAudio(b"ID3audio")
    from services.voice_catalogue import VoiceCatalogue, VoiceEntry
    entry = VoiceEntry(engine="edge", voice_id="en-US-X", display_name="X", language="English", locale="en-US", gender="Female",
                       accent="US", engine_label="Fake", online_or_offline="online", installed_status="ready",
                       availability_status="ready", model_license="n/a", license_url="", download_url="", notes="")
    rt.voice_service.catalogue.find = lambda e, v: entry
    rt.voice_service.catalogue.engines = {"edge": Fake()}
    rt.voice_service.catalogue.compatible_entries = lambda lang: [entry]
    rt.voice_service.catalogue.compatibility_score = lambda e, l: 1
    r = client.post("/api/voice/speak", json={"child_id": kid["id"], "text": "I am sorry you feel sad.", "emotion": "sad"})
    assert r.status_code == 200 and r.content == b"ID3audio" and seen["mood"] == "comfort"


def test_activities_progress_and_dashboard_use_real_data(client):
    kid = mk(client, "Kabir", 8)
    empty = client.get(f"/api/dashboard/child/{kid['id']}").json()
    assert empty["totals"]["activities"] == 0 and empty["timeline"] == []
    for kind, s in [("quiz", 4), ("quiz", 5), ("game", None)]:
        r = client.post(f"/api/children/{kid['id']}/activities", json={"kind": kind, "title": "t", "score": s, "max_score": 5 if s else None, "duration_seconds": 300})
        assert r.status_code == 201
    assert client.post(f"/api/children/{kid['id']}/activities", json={"kind": "quiz", "score": 9, "max_score": 5}).status_code == 422
    sid = client.post("/api/chat/session", json={"child_id": kid["id"]}).json()["session_id"]
    client.post("/api/chat/turn", json={"child_id": kid["id"], "session_id": sid, "text": "hello"})
    d = client.get(f"/api/dashboard/child/{kid['id']}").json()
    assert d["totals"]["quizzes"] == 2 and d["totals"]["games"] == 1 and d["totals"]["conversations"] == 1
    assert d["totals"]["minutes_week"] >= 15
    assert len(d["daily"]) == 7 and d["daily"][-1]["avg_score"] == 90
    assert {x["kind"] for x in d["distribution"]} >= {"quiz", "game", "chat"}
    prog = client.get(f"/api/children/{kid['id']}/progress").json()
    assert prog["streak_days"] == 1 and prog["stars"] >= 3
    ov = client.get("/api/dashboard/overview").json()
    assert ov["family"]["children"] == 1 and ov["compare_names"] == ["Kabir"]


def test_overview_separates_children(client):
    a, b = mk(client, "A", 5), mk(client, "B", 9)
    client.post(f"/api/children/{a['id']}/activities", json={"kind": "game"})
    ov = client.get("/api/dashboard/overview").json()
    by = {c["child"]["nickname"]: c["totals"] for c in ov["children"]}
    assert by["A"]["games"] == 1 and by["B"]["games"] == 0


def test_creations_journal_projects(client):
    kid = mk(client, "M", 11)
    cid = kid["id"]
    png = "data:image/png;base64,iVBORw0KGgo="
    assert client.post(f"/api/children/{cid}/creations", json={"kind": "drawing", "title": "Cat", "content": png}).status_code == 201
    assert client.post(f"/api/children/{cid}/creations", json={"kind": "drawing", "title": "Bad", "content": "nope"}).status_code == 422
    assert len(client.get(f"/api/children/{cid}/creations").json()) == 1
    r = client.post(f"/api/children/{cid}/journal", json={"text": "I want to disappear forever", "mood": "sad"}).json()
    assert r["support"]
    assert client.get("/api/safety/incidents", params={"child_id": cid}).json()[0]["severity"] == "high"
    d = client.get(f"/api/dashboard/child/{cid}").json()
    assert d["journal_entries"] == 1 and "disappear" not in str(d)  # journal text stays private
    p = client.post(f"/api/children/{cid}/projects", json={"title": "Model", "steps": [{"text": "a"}, {"text": "b"}]}).json()
    up = client.patch(f"/api/children/{cid}/projects/{p['id']}", json={"steps": [{"text": "a", "done": True}, {"text": "b"}], "status": "done"}).json()
    assert up["steps"][0]["done"] and up["status"] == "done"
    other = mk(client, "N", 11)
    assert client.get(f"/api/children/{other['id']}/projects").json() == []


def test_infant_care_full_flow(client):
    baby = mk(client, "Kiran", 0)
    other = mk(client, "Aanya", 5)
    iid = baby["id"]
    assert client.get(f"/api/infant/{other['id']}/logs").status_code == 400
    now = datetime.combine(date.today(), datetime.min.time())
    one = now.isoformat()
    assert client.post(f"/api/infant/{iid}/feeding", json={"at": one, "subtype": "bottle", "amount_ml": 120}).status_code == 201
    assert client.post(f"/api/infant/{iid}/feeding", json={"at": one, "subtype": "bottle", "amount_ml": 9999}).status_code == 422
    assert client.post(f"/api/infant/{iid}/feeding", json={"at": (now + timedelta(days=2)).isoformat(), "subtype": "bottle"}).status_code == 422
    assert client.post(f"/api/infant/{iid}/diaper", json={"at": one, "subtype": "wet"}).status_code == 201
    # sleep across midnight is split between both days
    start = (datetime.combine(date.today(), datetime.min.time()) - timedelta(hours=2)).isoformat()
    end = (datetime.combine(date.today(), datetime.min.time()) + timedelta(hours=6)).isoformat()
    r = client.post(f"/api/infant/{iid}/sleep", json={"start": start, "end": end, "kind": "night"})
    assert r.status_code == 201 and r.json()["duration_minutes"] == 480
    assert client.post(f"/api/infant/{iid}/sleep", json={"start": end, "end": start}).status_code == 422
    assert client.post(f"/api/infant/{iid}/sleep", json={"start": start}).status_code == 422
    s = client.get(f"/api/infant/{iid}/summary").json()
    assert s["today"]["feeds"] == 1 and s["today"]["feed_ml"] == 120 and s["today"]["diapers"] == 1
    assert s["today"]["sleep_minutes"] == 360 and s["daily"][-2]["sleep_minutes"] == 120
    assert s["last"]["feeding"]["subtype"] == "bottle" and "normal" not in str(s).lower().replace("does not say whether patterns are normal", "")
    assert client.post(f"/api/infant/{iid}/growth", json={"measured_on": date.today().isoformat(), "weight_kg": 7.2, "length_cm": 66}).status_code == 201
    assert client.post(f"/api/infant/{iid}/growth", json={"measured_on": date.today().isoformat()}).status_code == 422
    assert len(client.get(f"/api/infant/{iid}/growth").json()) == 1
    assert client.post(f"/api/infant/{iid}/milestones", json={"achieved_on": date.today().isoformat(), "title": "Smiled"}).status_code == 201
    rid = client.post(f"/api/infant/{iid}/reminders", json={"title": "Vaccine", "due_at": (now + timedelta(days=2)).isoformat()}).json()["id"]
    assert client.get(f"/api/infant/{iid}/summary").json()["reminders"][0]["title"] == "Vaccine"
    client.post(f"/api/infant/{iid}/reminders/{rid}/toggle")
    assert client.get(f"/api/infant/{iid}/summary").json()["reminders"] == []
    logs = client.get(f"/api/infant/{iid}/logs").json()
    assert client.delete(f"/api/infant/{iid}/logs/{logs[0]['id']}").status_code == 200
    # data belongs to the right child
    baby2 = mk(client, "Other", 1)
    assert client.get(f"/api/infant/{baby2['id']}/logs").json() == []


def test_demo_seed_reset_and_remove(client):
    mk(client, "Real", 6)
    r = client.post("/api/demo/seed")
    assert r.status_code == 200
    kids = client.get("/api/children").json()
    assert len([k for k in kids if k["is_demo"]]) == 4 and len([k for k in kids if not k["is_demo"]]) == 1
    demo = next(k for k in kids if k["nickname"] == "Meera")
    d = client.get(f"/api/dashboard/child/{demo['id']}").json()
    assert d["totals"]["minutes_week"] > 0 and d["timeline"] and d["limit"]["status"] in ("ok", "near", "reached")
    baby = next(k for k in kids if k["is_infant"])
    s = client.get(f"/api/infant/{baby['id']}/summary").json()
    assert s["totals"]["feeds"] > 20 and len(s["growth"]) == 4 and s["last"]["feeding"]
    client.post("/api/demo/seed")  # reset
    assert len([k for k in client.get("/api/children").json() if k["is_demo"]]) == 4
    client.delete("/api/demo")
    kids = client.get("/api/children").json()
    assert [k["nickname"] for k in kids] == ["Real"]  # real data untouched


def test_delete_all_requires_confirmation(client):
    mk(client)
    assert client.post("/api/data/delete-all", json={"confirm": "no"}).status_code == 422
    assert client.post("/api/data/delete-all", json={"confirm": "DELETE"}).status_code == 200
    anon = TestClient(client.app)
    assert anon.get("/api/bootstrap").json()["pin_set"] is False


def test_migration_preserves_legacy_data(tmp_path: Path):
    """A database created by the old Streamlit build upgrades without losing rows."""
    import sqlite3
    old = tmp_path / "old.db"
    conn = sqlite3.connect(old)
    conn.executescript(
        "CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);"
        "CREATE TABLE children (id INTEGER PRIMARY KEY AUTOINCREMENT, nickname TEXT NOT NULL, age_band TEXT NOT NULL, languages TEXT NOT NULL, voice_preset TEXT NOT NULL, activities TEXT NOT NULL, blocked_topics TEXT NOT NULL DEFAULT '', daily_minutes INTEGER NOT NULL DEFAULT 30, voice_enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);"
        "CREATE TABLE infant_care (id INTEGER PRIMARY KEY AUTOINCREMENT, child_id INTEGER NOT NULL, event_type TEXT NOT NULL, timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, note TEXT NOT NULL DEFAULT '');"
        "INSERT INTO children (nickname, age_band, languages, voice_preset, activities) VALUES ('Old kid','7-9','English','default','stories,basic maths');"
        "INSERT INTO children (nickname, age_band, languages, voice_preset, activities) VALUES ('Old baby','0-3','English','default','');"
        "INSERT INTO infant_care (child_id, event_type, note) VALUES (2, 'feeding', 'Bottle');"
    )
    conn.commit(); conn.close()
    from database.db import Database
    db = Database(old)
    Database(old)  # second run is a no-op (repeatable)
    kids = db.list_children()
    assert [k["nickname"] for k in kids] == ["Old kid", "Old baby"]
    assert db.query("SELECT COUNT(*) AS n FROM infant_care")[0]["n"] == 1
    assert list(old.parent.glob("old.db.pre-migration-*.bak"))
    from database.migrations import LATEST_VERSION
    assert db.query("SELECT COUNT(*) AS n FROM schema_migrations")[0]["n"] == LATEST_VERSION
    from mallow_api.deps import normalize_activities
    assert "maths" in normalize_activities(kids[0]["activities"]) and "chat" in normalize_activities(kids[0]["activities"])


def test_legacy_sessions_purpose_column_is_added_before_index(tmp_path: Path):
    """A populated pre-education DB upgrades before schema indexes reference purpose."""
    import sqlite3

    old = tmp_path / "legacy_sessions.db"
    conn = sqlite3.connect(old)
    conn.executescript(
        "CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);"
        "CREATE TABLE children (id INTEGER PRIMARY KEY, nickname TEXT NOT NULL, age_band TEXT NOT NULL, "
        "languages TEXT NOT NULL, voice_preset TEXT NOT NULL, activities TEXT NOT NULL);"
        "CREATE TABLE sessions (id INTEGER PRIMARY KEY, child_id INTEGER NOT NULL, started_at TEXT NOT NULL, "
        "last_activity_at TEXT NOT NULL, duration_seconds INTEGER NOT NULL DEFAULT 0, language TEXT NOT NULL, "
        "activity TEXT NOT NULL DEFAULT 'chat', summary TEXT, is_sample INTEGER NOT NULL DEFAULT 0);"
        "CREATE TABLE messages (id INTEGER PRIMARY KEY, session_id INTEGER NOT NULL, child_id INTEGER NOT NULL, "
        "role TEXT NOT NULL, text TEXT NOT NULL, language TEXT NOT NULL);"
        "CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, "
        "applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);"
        "INSERT INTO children VALUES (1,'Existing child','7-9','English','default','study,chat');"
        "INSERT INTO sessions VALUES (1,1,'2026-11-05T10:00:00+00:00','2026-11-05T10:01:00+00:00',60,'English','study',NULL,0);"
        "INSERT INTO messages VALUES (1,1,1,'child','What is 2 + 2?','English');"
        "INSERT INTO schema_migrations (version,name) VALUES "
        "(1,'one'),(2,'two'),(3,'three'),(4,'four'),(5,'five'),(6,'six'),(7,'seven'),(8,'eight'),(9,'nine');"
    )
    conn.commit()
    conn.close()

    from database.db import Database
    from database.migrations import LATEST_VERSION

    db = Database(old)
    Database(old)  # migration and index creation are repeatable
    session = db.query_one("SELECT purpose, educational_turns FROM sessions WHERE id = 1")
    assert session == {"purpose": "general", "educational_turns": 0}
    assert db.query_one("SELECT COUNT(*) AS n FROM children")["n"] == 1
    assert db.query_one("SELECT COUNT(*) AS n FROM messages")["n"] == 1
    assert db.query_one("SELECT MAX(version) AS version FROM schema_migrations")["version"] == LATEST_VERSION
    indexes = {r["name"] for r in db.query("SELECT name FROM sqlite_master WHERE type='index'")}
    assert "idx_sessions_child_purpose" in indexes
    assert len(list(tmp_path.glob("legacy_sessions.db.pre-migration-*.bak"))) == 1


def test_fresh_database_creates_purpose_column_and_index(tmp_path: Path):
    from database.db import Database

    db = Database(tmp_path / "fresh.db")
    columns = {r["name"] for r in db.query("PRAGMA table_info(sessions)")}
    indexes = {r["name"] for r in db.query("SELECT name FROM sqlite_master WHERE type='index'")}
    assert {"purpose", "educational_turns"} <= columns
    assert "idx_sessions_child_purpose" in indexes


# ------------------------------------------------------- adult companion API
def test_parent_companion_is_parent_only_and_scoped(client):
    a, b = mk(client, "A", 8), mk(client, "B", 10)
    anon = TestClient(client.app)
    assert anon.post("/api/companion/parent", json={"text": "hello"}).status_code == 401

    r = client.post("/api/companion/parent", json={"text": "Bedtime is hard", "child_id": a["id"]})
    assert r.status_code == 200
    body = r.json()
    assert body["reply"] and body["offline"] is True and body["duplicate"] is False
    assert body["urgent"] is False and body["unsafe"] is False

    mine = client.get("/api/companion/messages", params={"audience": "parent", "child_id": a["id"]}).json()
    other = client.get("/api/companion/messages", params={"audience": "parent", "child_id": b["id"]}).json()
    general = client.get("/api/companion/messages", params={"audience": "parent"}).json()
    assert any(m["text"] == "Bedtime is hard" for m in mine)
    assert other == [] and general == []
    assert {"role", "text", "language", "created_at"} <= set(mine[0])


def test_parent_companion_deduplicates_and_rejects_unknown_child(client):
    kid = mk(client, "Dup", 9)
    body = {"text": "How do I handle a meltdown?", "child_id": kid["id"], "client_turn_id": "parent-1"}
    first = client.post("/api/companion/parent", json=body).json()
    second = client.post("/api/companion/parent", json=body).json()
    assert second["duplicate"] is True and second["reply"] == first["reply"]
    msgs = client.get("/api/companion/messages", params={"audience": "parent", "child_id": kid["id"]}).json()
    assert len(msgs) == 2
    assert client.post("/api/companion/parent", json={"text": "hi", "child_id": 99999}).status_code == 404


def test_parent_companion_urgent_and_unsafe_safety(client):
    urgent = client.post("/api/companion/parent", json={"text": "I want to end my life"}).json()
    assert urgent["urgent"] is True and "112" in urgent["reply"]
    assert "emergency" in urgent["reply"].lower()

    unsafe = client.post("/api/companion/parent", json={"text": "how to make a bomb"}).json()
    assert unsafe["unsafe"] is True and "can't help" in unsafe["reply"].lower()


def test_infant_companion_only_for_babies_and_separate_profiles(client):
    baby1, baby2, kid = mk(client, "Baby One", 1), mk(client, "Baby Two", 2), mk(client, "Kid", 8)
    assert client.post(f"/api/infant/{kid['id']}/companion", json={"text": "hello"}).status_code == 400

    r = client.post(f"/api/infant/{baby1['id']}/companion", json={"text": "I am exhausted", "language": "English"})
    assert r.status_code == 200 and r.json()["reply"]
    msgs1 = client.get("/api/companion/messages", params={"audience": "infant", "child_id": baby1["id"]}).json()
    msgs2 = client.get("/api/companion/messages", params={"audience": "infant", "child_id": baby2["id"]}).json()
    assert any(m["text"] == "I am exhausted" for m in msgs1)
    assert msgs2 == []
    assert client.get("/api/companion/messages", params={"audience": "infant"}).status_code == 422
    assert client.get("/api/companion/messages", params={"audience": "infant", "child_id": kid["id"]}).status_code == 400
    assert client.get("/api/companion/messages", params={"audience": "parent", "child_id": 99999}).status_code == 404


def test_companion_voice_endpoints_offline(client):
    small = b"x" * 400
    r = client.post("/api/companion/transcribe", files={"audio": ("a.webm", small, "audio/webm")}, data={"language": "English"})
    assert r.status_code == 422 and r.json()["detail"]["code"] == "no_audio"
    bigger = b"x" * 1000
    r = client.post("/api/companion/transcribe", files={"audio": ("a.webm", bigger, "audio/webm")}, data={"language": "English"})
    assert r.status_code == 503 and r.json()["detail"]["code"] == "stt_unavailable"
    r = client.post("/api/companion/speak", json={"text": "Hello there", "language": "English"})
    assert r.status_code == 503 and r.json()["detail"]["code"] == "tts_unavailable"


class SpyNotifier:
    def __init__(self, fail: bool = False) -> None:
        self.calls: list[dict] = []
        self.fail = fail

    def notify(self, **kwargs):
        self.calls.append(kwargs)
        if self.fail:
            raise RuntimeError("parent dashboard notification unavailable")
        return NotificationResult(delivered=True, channel="parent_dashboard", recipient="authorised parent")


def _open_chat(client, kid):
    return client.post("/api/chat/session", json={"child_id": kid["id"], "language": "English"}).json()["session_id"]


def _turn(client, kid, sid, text):
    return client.post(
        "/api/chat/turn",
        json={"child_id": kid["id"], "session_id": sid, "text": text},
    ).json()


def test_contextual_disclosure_escalates_and_records_delivery(client):
    kid = mk(client, "Meera", 10)
    sid = _open_chat(client, kid)
    spy = SpyNotifier()
    client.app.state.runtime.escalation.notifier = spy

    r = _turn(
        client,
        kid,
        sid,
        "I feel very uncomfortable and scared because of some adults at school.",
    )

    assert r["is_disclosure"] is True
    assert "trusted adult" in r["reply"] and "did nothing wrong" in r["reply"]
    assert r["helpline"]
    assert "keep it secret" not in r["reply"].lower()
    inc = client.get("/api/safety/incidents", params={"child_id": kid["id"]}).json()
    assert len(inc) == 1
    incident = inc[0]
    assert incident["child_id"] == kid["id"]
    assert incident["category"] == "serious_disclosure"
    assert incident["severity"] == "high"
    assert incident["notification_status"] == "delivered"
    assert incident["notification_channel"] == "parent_dashboard"
    assert incident["notification_recipient"] == "authorised parent"
    assert incident["notification_attempted_at"] and incident["notification_delivered_at"]
    assert len(spy.calls) == 1
    assert spy.calls[0]["incident_id"] == incident["id"]
    assert "I feel very uncomfortable" not in str(spy.calls[0])
    overview = client.get("/api/dashboard/overview").json()
    assert overview["family"]["safety_notifications_failed"] == 0


def test_notification_failure_is_recorded_and_visible(client):
    kid = mk(client, "Kabir", 8)
    sid = _open_chat(client, kid)
    client.app.state.runtime.escalation.notifier = SpyNotifier(fail=True)

    r = _turn(client, kid, sid, "I am afraid of being alone with an adult.")

    assert r["is_disclosure"] is True
    inc = client.get("/api/safety/incidents", params={"child_id": kid["id"]}).json()[0]
    assert inc["notification_status"] == "failed"
    assert inc["notification_attempted_at"]
    assert inc["notification_delivered_at"] is None
    stored = client.app.state.runtime.db.query_one(
        "SELECT notification_error FROM safety_incidents WHERE id = ?", (inc["id"],)
    )
    assert "notification unavailable" in stored["notification_error"]
    assert len(client.get("/api/safety/incidents", params={"status": "open"}).json()) == 1
    assert len(client.get("/api/safety/incidents", params={"status": "all"}).json()) == 1
    overview = client.get("/api/dashboard/overview").json()
    assert overview["family"]["safety_notifications_failed"] == 1
    child = client.get(f"/api/dashboard/child/{kid['id']}").json()
    assert child["totals"]["safety_notifications_failed"] == 1


def test_disclosure_is_not_lost_when_time_limit_is_reached(client):
    kid = mk(client, "Aanya", 5, daily_minutes=0)
    session = client.post("/api/chat/session", json={"child_id": kid["id"]}).json()
    assert session["limit_reached"] is True

    r = _turn(
        client,
        kid,
        session["session_id"],
        "An adult at school told me to keep what happened a secret.",
    )

    assert r["limit_reached"] is False
    assert r["is_disclosure"] is True
    inc = client.get("/api/safety/incidents", params={"child_id": kid["id"]}).json()
    assert len(inc) == 1 and inc[0]["notification_status"] == "dashboard_only"
    assert inc[0]["notification_delivered_at"] is None


def test_benign_teacher_mention_creates_no_incident(client):
    kid = mk(client, "Meera", 10)
    sid = _open_chat(client, kid)

    r = _turn(client, kid, sid, "My teacher helped me with my project today.")

    assert r["is_disclosure"] is False
    assert client.get("/api/safety/incidents", params={"child_id": kid["id"]}).json() == []


def test_unconfigured_notification_is_not_reported_as_delivered(client):
    kid = mk(client, "Meera", 10)
    sid = _open_chat(client, kid)
    response = _turn(client, kid, sid, "I feel uncomfortable around my teacher.")

    assert response["is_disclosure"] is True
    incident = client.get("/api/safety/incidents", params={"child_id": kid["id"]}).json()[0]
    assert incident["notification_status"] == "dashboard_only"
    assert incident["notification_attempted_at"] is None
    assert incident["notification_delivered_at"] is None
    assert client.get("/api/dashboard/overview").json()["family"]["safety_notifications_failed"] == 1


@pytest.mark.parametrize("message", [
    "I feel scared because of an adult at school.",
    "I feel uncomfortable around my teacher.",
    "my teacher make me uncomfy",
    "They keep trying to touch me",
    "A teacher touched me in a way I did not want.",
    "I am afraid of being alone with an adult.",
    "I'm afraid of being alone with him.",
    "An adult at school makes me scared.",
    "An adult told me to keep what happened a secret.",
    "Someone told me not to tell my parents.",
])
def test_safeguarding_disclosure_reaches_child_scoped_dashboard(client, message):
    kid = mk(client, "Meera", 9)
    sid = _open_chat(client, kid)

    response = _turn(client, kid, sid, message)

    assert response["is_disclosure"] is True
    assert "did nothing wrong" in response["reply"]
    incident = client.get("/api/safety/incidents", params={"child_id": kid["id"]}).json()[0]
    assert incident["child_id"] == kid["id"]
    assert incident["severity"] == "high"
    assert incident["notification_status"] == "dashboard_only"
    assert incident["notification_delivered_at"] is None
    assert client.get("/api/safety/incidents", params={"child_id": kid["id"] + 9999}).json() == []


def test_exact_multiturn_disclosure_is_committed_and_visible_to_authorised_parent(client):
    kid = mk(client, "Meera", 9)
    other = mk(client, "Kabir", 8)
    sid = _open_chat(client, kid)

    first = _turn(client, kid, sid, "my teacher make me uncomfy")
    second = _turn(client, kid, sid, "yes. They keep trying to touch me")

    assert first["is_disclosure"] is True
    assert second["is_disclosure"] is True
    for response in (first, second):
        assert "did nothing wrong" in response["reply"]
        assert "trusted adult" in response["reply"]

    # A fresh DB connection proves the incident committed and remained child-scoped.
    stored = client.app.state.runtime.db.query(
        "SELECT id, child_id, session_id, message_id, severity, reviewed_at, notification_status "
        "FROM safety_incidents WHERE child_id = ? AND session_id = ?",
        (kid["id"], sid),
    )
    assert len(stored) == 1  # the follow-up is part of the same open disclosure
    incident = stored[0]
    assert incident["child_id"] == kid["id"]
    assert incident["session_id"] == sid
    assert incident["message_id"] is not None
    assert incident["severity"] == "high"
    assert incident["reviewed_at"] is None
    assert incident["notification_status"] == "dashboard_only"

    opened = client.get("/api/safety/incidents", params={"status": "open"}).json()
    all_items = client.get("/api/safety/incidents", params={"status": "all"}).json()
    reviewed = client.get("/api/safety/incidents", params={"status": "reviewed"}).json()
    child_items = client.get(
        "/api/safety/incidents", params={"status": "open", "child_id": kid["id"]}
    ).json()
    other_items = client.get(
        "/api/safety/incidents", params={"status": "open", "child_id": other["id"]}
    ).json()

    assert [i["id"] for i in opened] == [incident["id"]]
    assert [i["id"] for i in all_items] == [incident["id"]]
    assert reviewed == [] and other_items == []
    assert child_items[0]["child_id"] == kid["id"]
    assert child_items[0]["notification_status"] == "dashboard_only"
    anon = TestClient(client.app)
    assert anon.get("/api/safety/incidents", params={"child_id": kid["id"]}).status_code == 401


def test_incident_stays_with_the_right_child(client):
    a, b = mk(client, "Aanya", 5), mk(client, "Kabir", 8)
    sa, sb = _open_chat(client, a), _open_chat(client, b)
    _turn(client, a, sa, "I am uncomfortable around my teacher.")
    _turn(client, b, sb, "My coach helps me feel confident.")

    assert len(client.get("/api/safety/incidents", params={"child_id": a["id"]}).json()) == 1
    assert client.get("/api/safety/incidents", params={"child_id": b["id"]}).json() == []
    b_stats = client.get(f"/api/dashboard/child/{b['id']}").json()
    assert b_stats["totals"]["safety_flags_open"] == 0
    assert b_stats["totals"]["safety_notifications_failed"] == 0
    assert client.get(f"/api/dashboard/child/{b['id']}/conversation/{sa}").status_code == 404
    anon = TestClient(client.app)
    assert anon.get("/api/safety/incidents").status_code == 401


def test_journal_disclosure_uses_the_same_escalation(client):
    kid = mk(client, "Meera", 10)
    client.app.state.runtime.escalation.notifier = SpyNotifier()

    r = client.post(
        f"/api/children/{kid['id']}/journal",
        json={"text": "An adult at school threatened me.", "mood": "worried"},
    )

    assert r.status_code == 201
    assert r.json()["support"]
    inc = client.get("/api/safety/incidents", params={"child_id": kid["id"]}).json()[0]
    assert inc["category"] == "serious_disclosure"
    assert inc["notification_status"] == "delivered"
