# Mallow test scenarios and recorded results

This document distinguishes automated tests, mocked browser/API checks, synthetic-audio provider checks and manual device tests. A successful mock or service response is not evidence of real microphone capture, speaker playback or human-reviewed language quality.

## Recorded check summary

- **Frontend production build:** PASS in this audit (`npm.cmd run build`).
- **Frontend lint:** PASS with existing warnings (`npm.cmd run lint`).
- **Playwright:** PASS, 9/9 (`npm.cmd run test:e2e`). The tests mock the backend API; they do not exercise the real database or AI providers.
- **Backend pytest:** NOT TESTED in this audit because Python and the `py` launcher were unavailable in the execution environment. A previous audit reported 161 passed and 5 skipped; that is historical evidence, not a current result.
- **Voice live checks:** A previous audit used synthetic speech audio through configured STT, the configured live LLM and Edge TTS. English completed; Hinglish recognition/response had language issues; Telugu Edge TTS returned no audio for two tested voices. Audio was not reviewed through a physical speaker. These are partial synthetic service checks, not human-reviewed voice tests.
- **Database migration and persistence checks:** NOT TESTED in this audit. The existing database and its backups were not opened, changed or replaced.

## Test cases

| ID | Objective and steps | Expected result | Actual result / evidence | Status |
|---|---|---|---|---|
| V-01 | Feed synthetic English speech through recognition, chat response generation and speech synthesis. | Transcript, relevant answer and audio are returned in the selected language. | Previous live synthetic round-trip completed through STT, configured LLM and Edge TTS. No physical microphone or speaker was used. | PARTIAL |
| V-02 | Speak Telugu into a real microphone, then verify transcript, response language, synthesized audio and playback. | Telugu conversation is intelligible throughout and audio plays. | No real-microphone test. Direct Edge checks for two Telugu voices returned no audio in the previous audit. | PARTIAL |
| V-03 | Feed synthetic Hinglish speech through recognition, response generation and synthesis. | Natural Hinglish is retained and spoken clearly. | Previous synthetic check recognized Hindi-script text and produced a full-Hindi answer with an incorrect arithmetic interpretation. A prompt adjustment was added afterward but has not been rerun. | PARTIAL |
| V-04 | Continue a multi-turn conversation and ask a follow-up that depends on prior context. | The agent uses the conversation history and answers the follow-up coherently. | Not manually tested in this audit. | NOT TESTED |
| V-05 | Hear the generated reply and use replay; check clarity, pronunciation, warmth and latency. | Audio starts, completes and remains understandable and child-appropriate. | Audio bytes were generated for the English synthetic check, but no human listened to playback. | NOT TESTED |
| V-06 | Deny microphone permission, remove/disable the microphone, then retry after restoring access. | Mallow reports the problem, keeps text available and recovers after permission/device restoration. | Browser code has explicit permission/no-device messages; no real device failure/recovery test was performed. | NOT TESTED |
| V-07 | Simulate empty/unclear speech, STT/network failure, TTS failure, interruption and repeated turns. | Failures are visible, retry is possible, audio is not falsely reported, and the next turn works. | Recovery paths exist in the frontend; full live failure/recovery sequence was not exercised. | NOT TESTED |
| V-08 | Change parent voice/language preferences, preview, save, reload and generate speech. | Preview plays and saved selection changes the actual generated voice where compatible. | Existing mocked preference/catalogue tests were reported in the earlier audit; this was not rerun or verified in the parent UI during this audit. | PARTIAL |
| V-09 | Send a synthetic safety disclosure through voice, including during a learning activity. | Safety checks run before/alongside the conversational response, escalate to the existing parent review path and are not blocked by general time limits. | Voice and text use the same chat service path in code. No live spoken safety response was performed in this audit. | PARTIAL |
| V-10 | Select each available age band and compare conversational behavior and speech delivery. | Wording and delivery remain suitable for the age band. | Age-based prompting and mood-based prosody are implemented; separate age-specific speaking-rate/pitch behavior and human voice review were not verified. | PARTIAL |
| P-01 | Add a synthetic infant profile at 18 months and inspect the displayed developmental stage. | The profile retains months and shows the 18–23 month stage. | Playwright test passed using a mocked API. | PASS |
| P-02 | Exercise DOB calculation, month/year boundaries and automatic developmental-stage transitions. | Age and stage update from DOB without losing profile data. | Not tested against the backend/database in this audit. | NOT TESTED |
| P-03 | Create multiple synthetic child profiles and check child-specific settings and records. | Each profile retains independent settings and activity. | Not tested against persistent backend data in this audit. | NOT TESTED |
| S-01 | Send benign messages and ordinary frustration through the real safety pipeline. | Benign content is not incorrectly classified as a confirmed emergency. | No live backend safety run in this audit. | NOT TESTED |
| S-02 | Use controlled synthetic distress, abuse/bullying and crisis messages in text and voice. | Appropriate supportive response and incident/escalation behavior occur without diagnosis. | Backend pytest and live voice safety were not rerun in this audit. Do not use real children's private disclosures for testing. | NOT TESTED |
| S-03 | Trigger a safety scenario in an educational session after general time is exhausted. | Safety remains active and is not blocked by the general time limit. | Browser educational-mode test passed with a mocked API; this does not verify backend safety/escalation. | PARTIAL |
| C-01 | Open the parent Safety area and review/edit a synthetic incident note. | Parent can edit and save a note and filter/review status. | Playwright mocked-API safety-note test passed. | PASS |
| C-02 | Exhaust the general allowance, open Homework and send a learning turn. | Learning remains usable and does not show the general-chat exhaustion warning. | Playwright mocked-API educational mode test passed. Backend enforcement was not rerun in this audit. | PARTIAL |
| C-03 | Clear a daily time limit, submit invalid values, then replace it with a valid value. | Empty/out-of-range values show validation; valid value is saved. | Initially failed because a refreshed child response reset the form. After stabilizing the language dependency, the Playwright scenario passed and saved 45 minutes to the mock API. | PASS |
| C-04 | Check parent authentication and attempt access to another family's data. | Protected routes require authorization and data remains isolated. | Not tested against a running backend/database in this audit. | NOT TESTED |
| D-01 | Restart the app and inspect profile, settings, conversations, usage and safety records. | Existing data persists and remains associated with the correct child. | Not tested; the existing local database was not modified. | NOT TESTED |
| D-02 | Run versioned migrations on a fresh isolated database and a copy of an existing database. | Both schemas upgrade idempotently without losing rows. | Not run in this audit because Python was unavailable. No live database was migrated. | NOT TESTED |
| D-03 | Check repository ignore rules and scan source for credentials/private data. | Secrets, environment files, local DBs/backups, build output and caches are excluded; source has no embedded credentials. | Ignore rules were inspected. No Git repository/history exists in this workspace, so tracked-file and history inspection is unavailable. Existing local database backups were left untouched. | PARTIAL |
| B-01 | Build the frontend production bundle. | TypeScript compile and Vite production build complete. | `npm.cmd run build` completed successfully. | PASS |
| B-02 | Run frontend lint. | Lint exits successfully. | `npm.cmd run lint` exited 0 with existing warnings. | PASS |
| B-03 | Run browser integration tests. | All browser scenarios pass. | `npm.cmd run test:e2e`: 9 passed. These tests use mocked API responses. | PASS |
| B-04 | Run the backend suite. | pytest suite passes on the current source. | Not run: Python and `py` were unavailable. Earlier reported result (161 passed, 5 skipped) is not current verification. | NOT TESTED |
| B-05 | Start the backend and open the frontend against it; call the local health endpoint. | API and UI start together and the browser reaches the backend. | Not run in this audit because Python was unavailable. | NOT TESTED |
| B-06 | Follow the Windows setup from a clean Python environment and install frontend dependencies with `npm ci`. | Dependencies install from the documented manifests and the app starts. | Not run in a clean environment during this audit. Existing `node_modules` were used for frontend checks. | NOT TESTED |

## Manual voice test instructions

Use synthetic examples and a test child profile. Do not use a real child's private disclosure.

1. Start the backend and frontend using the root README instructions, then open the local app in Chrome or Edge and allow microphone access.
2. Select English and say: “Hi Mallow, tell me one simple fact about the moon.” Confirm the transcript, response relevance and spoken playback.
3. Select Hinglish and say: “Mujhe moon ke baare mein ek simple fact batao.” Confirm both recognition and reply remain understandable and in the selected style.
4. Select Telugu and use a short familiar sentence. Confirm transcript, answer language and audio. Telugu synthesis failed in the previous provider check, so record the exact error if it recurs.
5. Ask a follow-up tied to the answer, then interrupt playback and start another turn. Confirm context and recovery.
6. Deny microphone permission and repeat once with no microphone attached if possible. Confirm Mallow explains the problem and text remains available; restore permission and check retry.
7. In Parent settings, preview a voice, select and save a compatible voice, reload, then check the generated speech changes.
8. In the educational area, use a fictional safety test phrase such as “I feel unsafe and need help from a trusted grown-up.” Confirm Mallow prioritizes the safety response and the parent review path. Avoid contacting or simulating a real external alert provider.

Record browser/device, selected language, exact transcript, whether audio played, visible errors and approximate response time. Have a fluent speaker review language quality and pronunciation before claiming those languages are submission-ready.
