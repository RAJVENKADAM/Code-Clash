# ⚔️ Battle Room — Complete System Documentation

> How a Battle Room is created, how it runs, and how it is scored.

A **Battle Room** is a private, real-time coding competition. The creator authors
custom coding questions (LeetCode/HackerRank style), the system generates a
unique 6-character **Room Key**, and up to `maxParticipants` others join with
that key to solve the questions under a timed, proctored battle.

Everything below is derived directly from the codebase:

| Area | Primary Files |
| --- | --- |
| Room model | `backend/src/models/BattleRoom.js` |
| Submission model | `backend/src/models/BattleRoomSubmission.js` |
| Room controller | `backend/src/controllers/battleRoomController.js` |
| Authoring controller | `backend/src/controllers/battleRoomAuthoringController.js` |
| Authoring service | `backend/src/services/battleRoomAuthoringService.js` |
| Routes | `backend/src/routes/battleRoomRoutes.js` |
| Execution engine client | `backend/src/services/executionService.js` |
| Judge wrapper generator | `backend/src/services/wrapperGenerator.js` |
| Signature parser | `backend/src/services/signatureParser.js` |
| Language templates | `backend/src/services/languageTemplates.js` |
| Reference solution | `backend/src/services/referenceSolutionService.js` |
| Cleanup jobs | `backend/src/services/cleanupJob.js` |
| Result email | `backend/src/services/emailService.js` |
| Frontend services | `frontend/src/services/battleRoomService.js` |
| Creation wizard | `frontend/src/pages/CreateBattleRoom.jsx` |
| Battle hub | `frontend/src/pages/BattleRoom.jsx` |
| Battle UI | `frontend/src/pages/BattleRoomChallenge.jsx` |
| Leaderboard | `frontend/src/pages/BattleRoomLeaderboard.jsx` |
| Proctoring | `frontend/src/hooks/useProctorGuard.js`, `frontend/src/components/editor/ProctorGuard.jsx` |
| Sharing modals | `RoomKeyModal.jsx`, `BattleRoomShareModal.jsx` |

---

## 1. Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                        BATTLE ROOM LIFECYCLE                      │
│                                                                    │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    │
│   │  CREATE  │───▶│  SHARE   │───▶│  START   │───▶│  CLOSE   │    │
│   │ UPCOMING │    │  KEY     │    │  ACTIVE  │    │  CLOSED  │    │
│   └──────────┘    └──────────┘    └──────────┘    └──────────┘    │
│         ▲              ▲                │                 │        │
│         │              │                ▼                 ▼        │
│   Authoring wizard   Room Key    Participants solve   Leaderboard  │
│   (create-room UI)   (6 chars)   & submit solutions  + emails      │
└────────────────────────────────────────────────────────────────────┘
```

Key properties of every room:

- **Private by default** — only people with the Room Key can join.
- **Custom questions** — 1 to 20 questions, each with visible + hidden test cases.
- **Timed** — creator sets `timeLimit` + `timeLimitUnit` (minutes/hours/days/weeks);
  the countdown starts when the creator starts the battle.
- **Language-restrictable** — the room can allow all of `c`, `cpp`, `java`, `python`,
  or a subset.
- **Proctored** — fullscreen is mandatory while active; violations instantly disqualify.
- **Scored** — each question is worth `points` (default 100); score is proportional to
  visible + hidden test cases passed.
- **Self-cleaning** — expired rooms auto-close every minute; rooms inactive for
  1 year are soft-deleted.

---

## 2. Data Model

### 2.1 `BattleRoom` (`backend/src/models/BattleRoom.js`)

| Field | Type | Notes |
| --- | --- | --- |
| `roomCode` | String (6, unique, uppercase) | Human-shareable key. Charset `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no ambiguous `I`, `O`, `0`, `1`). |
| `title`, `description` | String | Room metadata. |
| `createdBy` | ObjectId → `User` | Only the creator can start/close/delete/share the key. |
| `questions` | `[questionSchema]` | Embedded questions (max 20 at creation). |
| `languages` | `[String]` | `["all"]` or a subset of `c`, `cpp`, `java`, `python`. |
| `timeLimit` / `timeLimitUnit` | Number / String | Converted to a duration by `getDurationMinutes()`. |
| `status` | `UPCOMING` → `ACTIVE` → `CLOSED` | Lifecycle state. |
| `startTime` / `endTime` | Date | Set when the creator starts the battle. |
| `maxParticipants` / `participantCount` | Number | Cap and current count (incremented on join). |
| `isActive` / `isDeleted` / `deletedAt` | Boolean / Date | Soft-delete support. |
| `expiresAt` | Date | `createdAt + 1 year`; cleanup job soft-deletes expired rooms. |

#### Embedded question schema

| Field | Notes |
| --- | --- |
| `title`, `description`, `explanation`, `constraints`, `difficulty`, `points` | Standard problem metadata. |
| `signature` | **Structured signature metadata** `{ name, returnType, params:[{name,type}] }` — the single source of truth. |
| `starterCode`, `starterCodeByLanguage` | Starter code is **never trusted from the DB** — it is re-generated fresh from `signature` every time the room is read (`attachFreshStartersToQuestion`). |
| `visibleTestCases` / `hiddenTestCases` | `{ input, expectedOutput, description? }`. Hidden cases are stripped from the public JSON. |
| `problemType` | `array`, `string`, `linked-list`, `tree`, `graph`, `matrix`, `dp`, … |
| `functionSignature`, `functionName` | Raw signature string + parsed function name (for display). |
| `expectedOutputSource` | `manual` or `reference` (auto-generated from the reference solution). |
| `referenceSolution`, `referenceSolutionLanguage` | Stored privately, never exposed to participants. |
| `wrapperByLanguage` | Optional explicit wrappers; otherwise wrappers are generated on demand. |

**Serialization strategy** (critical for security):

- `toPublicJSON()` — omits `hiddenTestCases` entirely.
- `toCreatorJSON()` — includes hidden test cases (creator only).
- `toLeaderboardJSON()` — room summary only.

### 2.2 `BattleRoomSubmission` (`backend/src/models/BattleRoomSubmission.js`)

One document per `(roomId, userId)` — the `{ roomId: 1, userId: 1 }` index is unique.

| Field | Notes |
| --- | --- |
| `questionResults` | Array of per-question results (status, score, passed/failed/total, execution time, memory, time-to-solve, code, language, per-case `results`). |
| `totalScore` / `totalPassed` / `totalFailed` / `totalQuestions` | Rolled-up aggregates. |
| `status` | `PENDING` → `COMPLETED` or `DISQUALIFIED`. |
| `disqualifyReason` | Stored when proctoring disqualifies a participant. |
| `startTime` / `submittedAt` | Used for duration & coding behavior. |
| `codingBehavior` | `totalLinesWritten`, `totalEdits`, `timePerQuestion`, `editFrequency` (edits/min), `languagesUsed[]`, `completedEarly`. Used for the "Non-AI Coder" profile in emails and share cards. |

---

## 3. How a Battle Room is Created

### 3.1 The Authoring Wizard (`frontend/src/pages/CreateBattleRoom.jsx`)

Creation is a **6-step wizard**. Each step gates the next (`canGoNext`):

| Step | Purpose | Validation gate |
| --- | --- | --- |
| 1. **Room Details** | Title, description, time limit + unit, max participants, allowed languages. | Title non-empty. |
| 2. **Question Info** | Per-question title, description, explanation, constraints, difficulty, points. Add/remove questions (max 20). | Title + description non-empty. |
| 3. **Type & Signature** | `SignatureEditor`: pick problem type, enter ONE function signature. | Signature non-empty. |
| 4. **Test Cases** | `BulkTestCaseEditor` for visible + hidden cases. Paste inputs separated by `---` and "Split Automatically". | ≥1 visible + ≥1 hidden case. |
| 5. **Reference Solution** | `ReferenceSolutionEditor`: optional reference solution used to auto-generate expected outputs. | Optional at wizard level. |
| 6. **Validate & Create** | Per-question `ValidationPanel` + room summary; **Create Room & Generate Key**. | — |

### 3.2 Stateless Authoring Helpers (`battleRoomAuthoringController.js`)

These three endpoints power the wizard **without creating a room**:

| Endpoint | Purpose |
| --- | --- |
| `POST /api/battle-rooms/authoring/generate-starter` | Validates the signature and returns generated starter code for a chosen language. |
| `POST /api/battle-rooms/authoring/generate-outputs` | Runs the reference solution against all visible + hidden inputs and returns auto-generated expected outputs. |
| `POST /api/battle-rooms/authoring/validate` | Runs `validateQuestion()` and returns `{ valid, errors[] }`. |

### 3.3 The Question Authoring Pipeline

Defined in `battleRoomAuthoringService.js`. Each question goes through:

```
Raw signature string (any of the 4 languages)
        │  parseSignature() / validateSignature()
        ▼
Structured signature { name, returnType, params[] }        ◀── ONLY this is persisted
        │
        ├── composeStarterFile(signature, lang)   → starter code per language (fresh each load)
        ├── composeProgram(question, code, lang)  → judge wrapper (parser + serializer + main)
        │
        ▼
Bulk inputs ──splitBulkTestCases()──▶ deduplicateTestCases() ──▶ visible/hidden test cases
        │
        ▼
Reference solution ──generateExpectedOutputsForQuestion()──▶ expected outputs (batch engine call)
        │
        ▼
validateQuestion()  ──▶  detailed error array before publishing
```

Key invariants:

- **Starter code is NEVER persisted.** `normalizeQuestion()` sets
  `starterCodeByLanguage = {}` and fresh code is generated on every room read.
- **The reference solution is only executed during authoring**, to produce expected
  outputs. It is never run during a contest and is never visible to participants.
- `splitBulkTestCases()` splits a textarea on lines containing `---`.
- `deduplicateTestCases()` removes duplicates by input string, and by input+expected.

### 3.4 Backend `createRoom` (`battleRoomController.js`)

The flow of `POST /api/battle-rooms/create`:

1. **Validate payload**
   - `title` and at least one `question` required.
   - Max **20 questions**.
   - `timeLimitUnit` ∈ `{minutes, hours, days, weeks}`; converted to a duration;
     must be within valid range.
   - Every language in `languages` must be in `{c, cpp, java, python}` (or `"all"`).
   - Every question must have title, description, ≥1 visible case, ≥1 hidden case,
     and well-formed cases (`input` present, `expectedOutput` defined).
2. **Generate a unique Room Key**
   - 6 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`.
   - Collision-checked against existing active rooms (up to 10 attempts).
3. **Process each question**
   - If a raw `functionSignature` is given, parse it into structured `signature`
     via `validateSignature()`.
   - If a structured `signature` exists, `starterCodeByLanguage` is **cleared**
     (fresh starters generated on read).
4. **Persist the room** with status `UPCOMING` and `expiresAt = now + 1 year`.
5. **Return `201`** with `{ room, roomKey }`. The frontend then shows the
   **RoomKeyModal** with the key.

### 3.5 Room Key Sharing

- The **RoomKeyModal** (`frontend/src/components/battleRoom/RoomKeyModal.jsx`)
  displays the key with Copy and Share (Web Share API) buttons.
- The creator can re-share it any time via `POST /api/battle-rooms/:roomCode/share-key`
  (`shareKey`), which returns the key only to the creator.
- `RoomKeyModal` states that **only the creator** can see the key, and that the room
  is auto-deleted after 1 year of inactivity.

---

## 4. How the Judge Engine Works

### 4.1 From Signature to Executable Program

For every submission, the backend composes a **full judge program** on the fly:

```
Stored structured signature
        │  getStoredSignature()
        ▼
composeProgram(question, participantCode, language, { isFullProgram: true })
        │
        ├── sanitizeCode()       (hoist imports, strip duplicate helpers/classes)
        ├── getDataStructureHelpers()  (inject ListNode/TreeNode ONLY if used)
        ├── build parsers        (inject ONLY for parameter types used)
        ├── build serializers    (inject ONLY for the return type)
        └── validateProgram()    (structural checks before sending to the engine)
        ▼
Full judge program = wrapper (parser + serializer + main)  +  participant Solution class
```

- **Python** wrapper: `main()` reads all stdin lines, parses args with `json.loads`,
  builds `ListNode`/`TreeNode` if needed, calls `sol.<name>(...)`, serializes with
  `json.dumps`.
- **Java** wrapper: `Main` class with `BufferedReader`, typed parsers
  (`parseIntArray`, `parseIntMatrix`, `parseListNode`, `parseTreeNode`, …) and a
  `serialize()` for the return type. All imports are hoisted before any class.
- **C++** wrapper: `main()` with `cin`, templated `parseArray<T>` / `parseMatrix<T>`,
  and overloaded `printOutput` serializers.
- **C** wrapper: `main()` with `fgets`-based readers, `readArray`, `readMatrix`,
  `printIntArray`, plus size-parameter adaptation via `deriveCSignature()`
  (e.g. `int* nums, int numsSize, int target`).

### 4.2 Execution Against the Secure Code Engine

`executionService.execute(code, testCases, language, options)`:

- Payload: `{ language, code, timeLimit (default 2000ms), memoryLimit (default 65536KB), testCases }`.
- POSTed to the external **Secure Code Engine**
  (`https://secure-code-engine.onrender.com/api/v1/execute`, overridable via
  `SECURE_CODE_ENGINE_URL`), with a 10s client timeout and optional `x-api-key`.
- Response normalized into `{ status, accepted, passed, failed, total, output, error, executionTime, memoryUsed, results[] }`.
- Each `result` has per-case `status` ∈ `PASSED | FAILED | SYSTEM_ERROR | ERROR`.

### 4.3 Run vs. Submit

| | **Run (Test)** | **Submit** |
| --- | --- | --- |
| Endpoint | `POST /api/battle-rooms/run` | `POST /api/battle-rooms/submit` |
| Test cases | **Visible only** | **Visible + hidden** |
| Creates a submission? | No — free debug runs, unlimited | Yes — final, one-shot per question |
| Requires active room? | Yes | Yes |
| Persists result? | No | Yes (in `BattleRoomSubmission.questionResults`) |
| Retry allowed? | Yes | **No** — once submitted, a question is locked (`REJECTED` or `ACCEPTED`) |

### 4.4 Scoring

For question `q` with `total = visible + hidden` cases:

```
passedCount  = number of test cases with status "PASSED"
questionScore = q.points × (passedCount / total)
totalScore    = Σ questionScore over all questions (rounded to 2 dp)
```

A submission is marked `COMPLETED` when **every** question has a non-`PENDING`
status (i.e. all questions submitted). `submittedAt` and `codingBehavior` are
finalized at that moment.

---

## 5. Room Lifecycle

### 5.1 `UPCOMING` → `ACTIVE`

- The room is created in `UPCOMING`. Non-creators **cannot see questions**
  (`questionsVisible: false`, only room metadata is returned by `getRoomByCode`).
- Only the **creator** can start it: `POST /api/battle-rooms/:roomCode/start`
  (`startRoom`). This validates `status === "UPCOMING"` and creator identity,
  then sets `status = "ACTIVE"`, `startTime = now`,
  `endTime = startTime + durationMinutes`.

### 5.2 Joining

`POST /api/battle-rooms/join` (`joinRoom`):

1. Room must exist, not `CLOSED`, and **already `ACTIVE`**.
2. `participantCount < maxParticipants` else "Battle room is full".
3. If the user already completed or was disqualified → cannot re-enter.
4. Otherwise a `BattleRoomSubmission` is created with one `PENDING`
   `questionResult` per question and `participantCount` is incremented.

### 5.3 Submitting Solutions (guards in `submitQuestionSolution`)

- Room must be `ACTIVE` and not past `endTime`.
- Language must be valid and allowed by `room.languages`.
- User must have joined; submission must not be `COMPLETED`/`DISQUALIFIED`.
- The question must still be `PENDING` for the user (no retries).
- `codingBehavior` is updated on every submit (lines written, edits, languages used).
- The composed judge program runs against **all** visible + hidden cases.
- If all questions are now non-`PENDING`, the submission becomes `COMPLETED`.

### 5.4 `ACTIVE` → `CLOSED`

Two paths close a room:

1. **Creator closes manually** — `POST /api/battle-rooms/:roomCode/close`
   (`closeRoom`): creator-only; auto-submits any `PENDING` submissions as
   `COMPLETED`, sets `status = "CLOSED"`, then sends result emails to all
   completed participants.
2. **Cleanup job auto-closes** — `cleanupJob.js` runs **every minute** and closes
   any `ACTIVE` room whose `endTime <= now`: auto-submits pending submissions,
   sets `CLOSED`, and emails results.

After closing, the leaderboard is **creator-only**; public leaderboard requests
return `403`.

### 5.5 Deletion & Expiry

- **Soft delete**: `DELETE /api/battle-rooms/:roomCode` (creator-only) sets
  `isDeleted = true`, `deletedAt = now`. All queries filter
  `isActive: true, isDeleted: false`.
- **1-year expiry**: rooms are created with `expiresAt = now + 1 year`. A daily
  cleanup job (`0 3 * * *`) soft-deletes rooms older than a year or past
  `expiresAt`.

---

## 6. The Battle Experience (`BattleRoomChallenge.jsx`)

When a participant opens `/battle-room/:roomCode/challenge`:

- **`getRoomByCode`** returns room data + `questionsVisible`, `isCreator`,
  `isParticipant`, `userSubmission`, `timeRemaining`.
- If `UPCOMING`: creator sees a **"Start Battle Now"** prompt; others see
  "Waiting for the room creator to start…".
- When `ACTIVE`, the workspace renders:
  - **Top bar** — room key, title, countdown timer (`RoomTimer`), Share Key
    (creator), Leaderboard link. Timer turns red under 5 minutes and fires
    `onTimeUp` → auto-submits the view (`submitted = true`) and fetches the leaderboard.
  - **Left panel** — resizable question list (with per-question status dots:
    pending/accepted + score), description, explanation, constraints, visible test cases.
  - **Editor** — `CodeEditorSandbox` (Monaco) with per-language starter code.
  - **Console** — `Console` shows run/submit results with per-case pass/fail,
    execution time, memory, and expected vs. actual output.
  - **Per-language memory** — code is cached in `codeByLanguageRef` so switching
    languages preserves each language's code; switching questions restores the
    code saved for that language.
- **Run/Submit rules in the UI**:
  - A submitted question is `readOnly` — you cannot run or resubmit it.
  - Once *all* questions are done (or time is up / disqualified), the battle view
    is replaced by a "Battle Complete!" / "Disqualified" screen.
- **ProctorGuard** is enabled when the room is `ACTIVE` and the user has not
  finished.

---

## 7. Proctoring & Integrity

`useProctorGuard.js` + `ProctorGuard.jsx` implement strict, **single-violation
disqualification** (score 0):

| Violation | Trigger |
| --- | --- |
| Exited fullscreen | `fullscreenchange` when `document.fullscreenElement` is null |
| Tab switch | `visibilitychange` when `document.hidden` |
| Window focus lost | `window.blur` |
| Copy outside editor | `copy` event outside `.monaco-editor` |
| Paste outside editor | `paste` event outside `.monaco-editor` |
| Dev tools (F12, Ctrl+Shift+I/J) | `keydown` |
| View source (Ctrl+U) | `keydown` |
| Failed to enter fullscreen | `requestFullscreen()` rejection |

On any violation:

1. Frontend sets `disqualified`, shows the disqualification overlay.
2. `disqualifyRoomSubmission(roomCode, reason)` is called →
   `POST /api/battle-rooms/:roomCode/disqualify`.
3. Backend sets submission `status = "DISQUALIFIED"`, `totalScore = 0`, all
   `PENDING` question results become `REJECTED` with score 0, and
   `disqualifyReason` is stored.
4. The user is blocked from re-entering the room.

---

## 8. Leaderboard, Results & Emails

### 8.1 Ranking (`getRoomLeaderboard`)

Only `COMPLETED` and `DISQUALIFIED` submissions are ranked. The sort is:

```
1. Higher totalScore
2. More totalPassed
3. Fewer totalFailed
4. Lower sum of timeToSolve
```

The leaderboard row exposes `rank`, name/email/organization, score, passed,
status, `timeToSolve`, `disqualifyReason`, `completedEarly`, and whether the row
is the current user.

Endpoints:
- `GET /api/battle-rooms/:roomCode/leaderboard` — authenticated; `CLOSED` rooms are creator-only.
- `GET /api/battle-rooms/:roomCode/public-leaderboard` — unauthenticated; returns `403` once the room is `CLOSED`.
- `GET /api/battle-rooms/:roomCode/my-result` — user's own submission + rank + total participants.

### 8.2 Closing & Emails (`closeRoom`, `cleanupJob`)

When a room closes (manually or via cleanup):

- Pending submissions are finalized as `COMPLETED`.
- `sendBattleRoomResultEmail(...)` is called for every completed participant with
  their score, pass rate, rank, room code, and a **coding-style summary** derived
  from `codingBehavior` (e.g. "You wrote concise, efficient code…").
- Email transport uses SMTP config (`EMAIL_USER`/`EMAIL_PASS`) or an Ethereal test
  account in development (a preview URL is logged).

### 8.3 Sharing Achievements (`BattleRoomShareModal.jsx`)

From the leaderboard, a participant can view "My Result" and:

- Download a **PNG score card** rendered on a `<canvas>` (score, passed, rate,
  rank, coding behavior, a developer quote, "Non-AI Coder" badge).
- Share the result **on LinkedIn** with a generated summary.
- **Copy** a text summary.

---

## 9. API Reference

All routes under `/api/battle-rooms` — most require `authenticate`
(`Authorization: Bearer <token>`).

### Authoring helpers (stateless, do NOT create rooms)

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/authoring/generate-starter` | ✅ | Generate starter code from a signature |
| POST | `/authoring/generate-outputs` | ✅ | Auto-generate expected outputs from the reference solution |
| POST | `/authoring/validate` | ✅ | Validate a question before publishing |

### Room management

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/create` | ✅ | Create a room (returns `roomKey`) |
| POST | `/:roomCode/start` | ✅ creator | Start the battle |
| POST | `/join` | ✅ | Join an active room with a key |
| GET | `/my-rooms` | ✅ | Rooms the user created |
| GET | `/joined-rooms` | ✅ | Rooms the user joined |
| GET | `/:roomCode` | ✅ | Get room (questions hidden for non-creators when `UPCOMING`) |
| DELETE | `/:roomCode` | ✅ creator | Soft-delete a room |
| POST | `/:roomCode/share-key` | ✅ creator | Re-fetch the room key |

### Submission & judging

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/run` | ✅ | Debug run (visible cases only, no submission) |
| POST | `/submit` | ✅ | Final submission (visible + hidden) |
| POST | `/:roomCode/disqualify` | ✅ | Set a user's score to 0 (proctoring) |

### Leaderboard & results

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/:roomCode/leaderboard` | ✅ | Authenticated leaderboard (creator-only once closed) |
| GET | `/:roomCode/public-leaderboard` | ❌ | Public leaderboard (denied once closed) |
| GET | `/:roomCode/my-result` | ✅ | User's own result + rank |
| POST | `/:roomCode/close` | ✅ creator | Close the battle & email results |

---

## 10. Key Files Map

| Concern | File |
| --- | --- |
| Room schema, serializers (`toPublicJSON`/`toCreatorJSON`/`toLeaderboardJSON`), duration calc | `backend/src/models/BattleRoom.js` |
| Submission schema, per-question results, coding behavior | `backend/src/models/BattleRoomSubmission.js` |
| All battle room endpoints | `backend/src/controllers/battleRoomController.js` |
| Authoring wizard endpoints | `backend/src/controllers/battleRoomAuthoringController.js` |
| Question normalization, dedup, validation, starter/wrapper/output generation | `backend/src/services/battleRoomAuthoringService.js` |
| Express router | `backend/src/routes/battleRoomRoutes.js` |
| Secure Code Engine client | `backend/src/services/executionService.js` |
| Judge wrapper composition (Python/Java/C++/C) | `backend/src/services/wrapperGenerator.js` |
| Signature parsing (canonical `{name, returnType, params}`) | `backend/src/services/signatureParser.js` |
| Starter code templates, type maps, DS helpers | `backend/src/services/languageTemplates.js` |
| Reference-solution → expected outputs | `backend/src/services/referenceSolutionService.js` |
| Import hoisting / duplicate class stripping | `backend/src/services/sanitizer.js` |
| Structural program validation | `backend/src/services/validator.js` |
| Cron jobs (auto-close, expiry, org recalibration) | `backend/src/services/cleanupJob.js` |
| Result emails | `backend/src/services/emailService.js` |
| Frontend API client | `frontend/src/services/battleRoomService.js` |
| 6-step creation wizard | `frontend/src/pages/CreateBattleRoom.jsx` |
| Hub (create / join / my-rooms / joined-rooms) | `frontend/src/pages/BattleRoom.jsx` |
| Battle workspace (timer, editor, run/submit, proctor) | `frontend/src/pages/BattleRoomChallenge.jsx` |
| Leaderboard + close/delete/share | `frontend/src/pages/BattleRoomLeaderboard.jsx` |
| Proctoring logic | `frontend/src/hooks/useProctorGuard.js`, `frontend/src/components/editor/ProctorGuard.jsx` |
| Room key display/copy/share | `frontend/src/components/battleRoom/RoomKeyModal.jsx` |
| Achievement score card / LinkedIn share | `frontend/src/components/battleRoom/BattleRoomShareModal.jsx` |
| Constants (languages, statuses, limits, signatures) | `frontend/src/utils/constants.js` |
| Routes | `frontend/src/routes/AppRouter.jsx` |

---

## 11. Authoring Checklist (as enforced by the platform)

A question is publishable only when it passes `validateQuestion()`:

- ✅ Title, description, and constraints are non-empty.
- ✅ Difficulty is `EASY`, `MEDIUM`, or `HARD`.
- ✅ A valid function signature (with name + params) is present.
- ✅ At least one visible and one hidden test case, each with non-empty input.
- ✅ No duplicate test-case inputs (visible + hidden combined).
- ✅ If `expectedOutputSource === "reference"`, every test case has a generated
  expected output and a reference solution is stored.

---

## 12. Tips & Gotchas

- **Starters regenerate on read** — never edit `starterCodeByLanguage` in the DB
  directly; edit the stored `signature` instead.
- **Hidden test cases are stripped** from any non-creator payload; the judge runs
  them server-side only.
- **One submission per question** — there is no retry after submit, so "Run"
  against visible cases is the only way to iterate.
- **Time is enforced two ways** — the backend rejects submissions after `endTime`,
  and the cleanup job auto-closes expired rooms every minute.
- **Rooms are private but not encrypted** — the 6-char key is the only gate;
  share it only with intended participants.
- **Legacy compatibility** — questions without a `signature` fall back to direct
  `executionService.execute(code, testCases, lang)` (raw full-program style),
  while questions with a `signature` are always wrapped by the judge.

