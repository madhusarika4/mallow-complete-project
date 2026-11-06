# Mallow

Mallow is a voice-first conversational companion and learning prototype for children, with parent-managed profiles, age-aware interactions and safety review. It combines speech input, a conversational agent and spoken responses while retaining a text path when voice is unavailable.

## Problem and objectives

Text interfaces can make conversational AI less natural or accessible for some children. Mallow explores a speech-led experience that can respond in an age-aware way, support selected languages, provide learning activities and keep parents involved through family controls and safety review. It is a prototype, not a clinical, emergency-response or substitute-care service.

## What the project includes

- A child-facing voice and text conversation flow, stories, learning activities, quizzes and projects.
- Parent PIN access, multiple child profiles, child-specific settings, daily general-chat limits and conversation review.
- Educational chat accounting that is separate from general-chat time, enforced in the backend.
- Date-of-birth age calculation and month entry for ages 0–35 months. Children younger than four use the parent-led infant/toddler experience rather than an independent chatbot.
- Input and output safety checks, safety incidents for parent review, and age-appropriate supportive responses.
- Parent-managed voice selection, language settings, previews and same-language fallback where a compatible engine is available.
- Infant-care tracking, including care logs, growth records, milestones and reminders.

## Voice-first conversational architecture

The browser captures speech with `MediaRecorder` when server speech recognition is available. Otherwise, it can use the browser's `SpeechRecognition` API when the browser supports it. The selected language is passed to recognition; the app does not automatically identify or switch languages mid-utterance.

The transcript is sent to the same `/api/chat/turn` conversational route used by typed messages. That route runs the configured safety checks, applies conversation-purpose and time-limit rules, builds an age-aware prompt, calls the configured conversational model and checks the generated response before returning it. A voice turn is marked as voice input, but does not bypass safety or parental controls.

For speech output, the browser requests `/api/voice/speak`. The backend uses the configured voice service (online Edge TTS is available in the inspected setup; configured provider or optional local Piper engines may also be used). The browser plays the returned audio. If server speech fails, the UI can try a compatible device voice or leave the response readable and report the issue. Audio is processed in memory; chat text transcripts are stored by the app.

Language options in the interface include English, Telugu and Hinglish. This is not a claim that every language has been verified end to end: a synthetic English round-trip completed in the previous live check; a Hinglish sample exposed recognition/script and response-language issues; and Telugu Edge synthesis returned no audio for the tested voices. The language selector is explicit; automatic language switching is not implemented. See [TEST_SCENARIOS.md](TEST_SCENARIOS.md) for the current evidence and limitations.

Age bands affect the conversational instructions, vocabulary, tone and response length. Mood-based delivery can affect supported speech prosody. The tested code does not provide a separate parent-controlled speech-rate or pitch setting for each age band.

## Technology and system architecture

- **Frontend:** React, TypeScript, Vite and Tailwind CSS; Recharts is used for parent-dashboard charts.
- **Backend:** Python, FastAPI, Pydantic and Uvicorn.
- **Persistence:** SQLite, with schema and versioned migrations in `backend/database/`.
- **Voice and AI integrations:** OpenAI-compatible chat/STT/TTS adapters, online Edge TTS and optional local Piper support. These depend on environment configuration, network and available voice models.
- **Automated checks:** pytest, Playwright and Oxlint.

```text
Browser UI (React)
  ├─ speech capture / browser recognition
  ├─ /api/voice/transcribe ──> configured STT
  ├─ /api/chat/turn ─────────> safety + conversation agent + configured LLM
  └─ /api/voice/speak ───────> TTS ──> browser audio playback
                                  │
                                  └─ SQLite stores profiles, settings,
                                     transcripts, usage and safety records
```

During development Vite proxies `/api` to `http://127.0.0.1:8000` by default. `MALLOW_API` can override that target. When `frontend/dist` exists, FastAPI serves the built frontend as well as the API.

## Project layout

```text
backend/       FastAPI application, services, SQLite schema/migrations and tests
frontend/      React application, browser tests and assets
devtools/      Local development helpers
README.md      Project overview and setup
TEST_SCENARIOS.md  Recorded test scenarios and evidence
```

## Requirements

- Windows 10 or later with PowerShell.
- Python 3.10 or later.
- Node.js 20.19+ or 22.12+ with npm.
- A modern browser. Microphone access requires browser permission and a working input device.
- Provider credentials and network access only for provider-dependent AI/voice features. Do not commit credentials.

## Windows installation and configuration

From the project root, create a backend environment and install dependencies:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

`backend/.env.example` documents supported variables. If you need a local `.env`, copy the example only when `.env` does not already exist, then configure only the providers you plan to use. Never overwrite an existing `.env`, and keep credentials out of source control. Some provider-dependent features will not work without their configuration.

## Database

The default SQLite file is `backend/database/nani.db`. `NANI_DB_PATH` can select another path. The application initializes a new database on first start and applies versioned migrations to an existing database. Startup migrations are designed to preserve existing rows and create a backup before a pending migration. Keep database files and backups private; do not reset or replace a populated database as part of setup.

## Run the local prototype

Start the backend in one PowerShell window:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python run.py
```

Open `http://127.0.0.1:8000`. For frontend hot reload, open a second window:

```powershell
cd frontend
npm ci
npm run dev
```

Vite normally serves `http://127.0.0.1:5173` and proxies API requests to port 8000. A hosted demo is not included. The intended demo is the local prototype above; backend startup and a live local frontend/backend session were not verified in this audit because Python was unavailable in its execution environment.

## Run checks

Backend tests use pytest and isolated databases:

```powershell
cd backend
python -m pytest -q
```

Frontend checks:

```powershell
cd frontend
npm ci
npm run build
npm run lint
npm run test:e2e
```

The normal automated tests use mocks for external services. Live voice tests are opt-in and may send audio/text to configured providers. A passing mocked test or provider availability check does not establish real microphone, speaker or language quality. See [TEST_SCENARIOS.md](TEST_SCENARIOS.md) for the latest recorded results and manual checks.

## Privacy, safety and limitations

- Parent access uses a family PIN rather than separate parent identities. Parent authentication tokens are held in memory and need to be reissued after a server restart.
- Without an external notification provider, safety incidents are visible in the parent dashboard but are not sent as external alerts.
- A configured online AI or speech provider receives the content needed for that request. Review its data-handling terms before enabling it for family use.
- Safety checks are safeguards, not diagnosis or emergency response. A child who may be in danger needs prompt support from a trusted adult or local emergency services.
- Online voices require network access. Optional Piper voices require local models. Browser voice availability, particularly Telugu, depends on the device.
- Live microphone and speaker review, Telugu voice generation and consistent Hinglish recognition/response still need verification. English and Hinglish synthetic-audio results are recorded in the scenario document.
- No live hosted deployment or recorded walkthrough is included.

## Team contributions

The project team has one member. The member's project responsibilities include conception and problem definition, requirements and product direction, feature planning and integration, conversational experience evaluation, testing and submission documentation. This describes project responsibilities and does not claim authorship of third-party libraries, AI models or voice services.

## Future scope

- Complete supervised microphone/speaker evaluation across supported devices and languages.
- Improve Hinglish recognition and response consistency and verify Telugu speech generation with an available provider.
- Evaluate conversational quality and age-adaptive spoken delivery with appropriate human review.
- Add a hosted demonstration only after selecting and approving suitable infrastructure and privacy controls.
