# Scheduled-Task Playbook — Reagan's Homeschool Dashboard

> **Audience.** A fresh Manus AGENT-cron session spawned by the platform every 30 minutes. The agent has the **Gmail** and **Google Drive** MCP connectors attached, but no source code, no DB, and no session memory. Everything it needs is in this playbook plus the two auto-injected env vars.
>
> **Status.** This file is the source-of-truth contract for the cron prompt. The schedule itself (cadence, connector UIDs, registration) is **deferred until the dashboard is published to a stable `*.manus.space` URL** — see §6 (Registration). Until then, this playbook is a complete, ready-to-paste prompt; only the base URL changes when the site is published.

---

## 1. Roles and identities

| Identity | Email | Role on the site | Purpose |
|---|---|---|---|
| Reagan | `reaganhiggs910@gmail.com` | `user` (kid) | Owns student-facing flows. Never receives the nightly email. |
| Mom (Katy) | `marcy.spear@gmail.com` | `user` with family-admin email gate | Primary recipient of nightly agenda email. |
| Grandma | `spear.cpt@gmail.com` | `user` with family-admin email gate | Co-recipient. Owns the Google Drive Hub root. |
| Cron caller | `cron_<task_uid>@scheduled-task.manus.im` | Synthetic. Manus injects this on every callback. | Authenticated via `sdk.authenticateRequest` on every `/api/scheduled/*` route. No bearer token needed. |

The cron caller is granted `role = "user"` (not `admin`) by `buildCronUser` in `server/_core/sdk.ts`. Every `/api/scheduled/*` handler in `server/scheduledSync.ts` accepts `role === "user" || role === "admin"`, so the cron path works the same as Mom and Grandma without any extra plumbing.

## 2. Two jobs share one cron tick

The platform fires this prompt on a single cadence (every 30 minutes, ~06:00–22:00 EDT). Inside one tick the agent does **both** of the following, in order. Job A is short-circuit-friendly (idempotent on hash), so when nothing changed the agent quickly drops to Job B and exits.

```
   ┌────────────────────────────┐     ┌──────────────────────────────┐
   │  Job A — Nightly agenda    │ ──► │  Job B — Drive Hub mirror    │
   │  email (one-shot per day)  │     │  (drains the queue)          │
   └────────────────────────────┘     └──────────────────────────────┘
```

Either job is safe to skip — both endpoints are idempotent and the next tick will retry. The agent must **never** invent its own retry loop; the platform already does 3-attempt 5xx/429 retries with exponential backoff.

---

## 3. Environment available to the agent

Two env vars are auto-injected by the cron platform:

- `$SCHEDULED_TASK_ENDPOINT_BASE` — base URL of the deployed dashboard (e.g. `https://reagandash-mm3swgic.manus.space`). **Never hardcode this.** When the project is republished the URL stays the same; in dev, it rotates.
- `$SCHEDULED_TASK_COOKIE` — raw `app_session_id` JWT; pass as `Cookie: app_session_id=$SCHEDULED_TASK_COOKIE` on every request.

Connectors attached at schedule-creation time:

- **Gmail** (UID `9444d960-ab7e-450f-9cb9-b9467fb0adda`) — exposes `gmail_send_messages`, etc.
- **Google Drive** (UID `f8900a57-4bd7-46cc-83a3-5ebd2420a817`) — exposes the `gws` CLI and Drive MCP tools.

Use `curl` for the dashboard HTTP calls. Use the MCP tools / `gws` CLI for anything that hits Google. Never install extra Python packages — keep the cron runtime minimal and reproducible.

---

## 4. Job A — Nightly agenda email

### 4.1 Purpose

Send a single, kid-aware "Reagan's School Plan" email to Mom and Grandma each night, with the full agenda PDF and one PDF per worksheet block as attachments. The dashboard already builds the PDF, presigns the S3 URL, and enqueues the Drive mirror rows. The cron agent's only responsibilities are: **check** if anything changed, **send** the email, and **acknowledge** the result.

### 4.2 One-tick procedure

**Step A1 — Ask the dashboard whether to send.**

```sh
RESP=$(curl -sS -X POST "$SCHEDULED_TASK_ENDPOINT_BASE/api/scheduled/nightly-agenda-email" \
  -H "Content-Type: application/json" \
  -H "Cookie: app_session_id=$SCHEDULED_TASK_COOKIE" \
  -d '{}')
```

The body is **empty** by default. The endpoint auto-resolves the next school day (skipping weekends, IH off-days, and summer mode) using the live calendar in `school_calendar` and `summer_mode.*` app settings. To target a specific date instead, pass `{"forDate":"2026-09-08"}`. To force a re-send on the same hash, pass `{"force": true}`.

**Step A2 — Branch on `status`.**

| `status` | Meaning | Agent action |
|---|---|---|
| `no_plan` | No `dailyPlans` row exists for the resolved date. | Stop Job A, fall through to Job B. |
| `unchanged` | The latest sent row's `agendaHash` matches the freshly-built PDF. | Stop Job A. **Do not send.** Fall through to Job B. |
| `send_ready` | First send for this date+hash. | Continue to Step A3. |
| `resend_ready` | A prior send exists, but the agenda has changed (new blocks, new worksheets, etc.). The subject will be prefixed with `[UPDATED] ` automatically. | Continue to Step A3. |

The handler also returns `recordId` (number) — store it; you'll POST it back in Step A5.

**Step A3 — Decode the attachments to /tmp.**

The response includes an `attachments[]` array. Each element is:

```json
{
  "filename": "2026-09-08 - Reagan - Agenda.pdf",
  "contentBase64": "JVBERi0xLjQKJ...",
  "mimeType": "application/pdf",
  "byteSize": 38421,
  "kind": "agenda" | "worksheet",
  "blockSortOrder": 3
}
```

Decode each `contentBase64` and write it to `/tmp/agenda-${forDate}-${filename}`. Build a parallel array of absolute file paths — that's what the Gmail MCP tool expects.

```sh
python3 - <<'PY'
import json, os, base64, pathlib
data = json.loads(os.environ["RESP"])
for a in data["attachments"]:
    p = pathlib.Path("/tmp") / f"agenda-{data['forDate']}-{a['filename']}"
    p.write_bytes(base64.b64decode(a["contentBase64"]))
    print(p)
PY
```

**Step A4 — Send via Gmail MCP.**

The Gmail MCP `gmail_send_messages` tool accepts these fields:

- `to` — list of email addresses. Use `recipients` from the response (defaults to `marcy.spear@gmail.com` and `spear.cpt@gmail.com`).
- `subject` — use `subject` from the response verbatim. It already has the `[UPDATED] ` prefix on a resend.
- `content` — **plain-text body only.** The MCP does not accept `htmlBody`. Convert the HTML returned in `htmlBody` to plain text by stripping tags and inserting `\n\n` between blocks; the dashboard's text fallback is the kid-summary line plus the block list, ending with the value of `pdfDownloadUrl` on its own line so Gmail auto-links it.
- `attachments` — array of **absolute file paths**, not base64. Pass the `/tmp/agenda-…` paths you wrote in A3.

> **Critical: use `pdfDownloadUrl` for the body link, not `pdfUrl`.** The response carries both. `pdfDownloadUrl` is an **absolute presigned S3 URL** that works without dashboard cookies; `pdfUrl` is a relative `/manus-storage/…` path that requires the recipient's OAuth cookie and **will 401 from a Gmail click**. The dashboard documents this contract in `scheduledSync.ts` lines 1208–1231 (cron-agent contract block).

A minimal plain-text body looks like:

```
Reagan's School Plan — Tuesday, September 8

Tutor: Madison · arrives 9:00 · leaves 12:00

What's coming up: Reagan has 5 blocks tomorrow — Math, Reading, Science, Adventure, Wind-down.

1. 9:00 · 30 min · Math · Topic 5.NBT.1
   Place value to the millions; pages 12–14 in Math Mammoth Gr5-A.
2. 9:35 · 25 min · Reading
   Frindle, chapter 6.
…

Download today's agenda PDF:
https://manus-storage-us1.s3.amazonaws.com/nightly-agendas/2026-09-08/agenda_5f1c2b9e.pdf?X-Amz-Algorithm=…

PDFs are also attached. If anything changes before school start, this email
will be re-sent automatically.
```

If `htmlBody` is preferred over a custom strip — many MCP wrappers accept HTML inline as `content` and Gmail will render it — the agent can pass `htmlBody` in the `content` field directly. Empirically Gmail MCP renders inline HTML correctly; both options are documented here so the cron prompt has a fallback if one breaks.

**Step A5 — Acknowledge.**

```sh
curl -sS -X POST "$SCHEDULED_TASK_ENDPOINT_BASE/api/scheduled/nightly-agenda-email/result" \
  -H "Content-Type: application/json" \
  -H "Cookie: app_session_id=$SCHEDULED_TASK_COOKIE" \
  -d "{\"recordId\": $RECORD_ID, \"status\": \"sent\"}"
```

On send failure, post `{"recordId": …, "status": "failed", "errorMessage": "…"}` instead. The dashboard exposes this in the `NightlyAgendaEmailHistoryCard` so Mom can see exactly why a send didn't happen. Do **not** retry the send on the same tick — the next tick (30 min later) will see the queued/failed row, hash-match against the freshly-built PDF, and either short-circuit (`unchanged`) or re-send.

**No drive-mirror work in Job A.** The dashboard already enqueues `agenda_pdf` and `worksheets` rows in `drive_push_queue` at the moment the PDF is built (see `scheduledSync.ts` lines 1086–1097 and 1067–1078). Job B will pick those up on this same tick.

### 4.3 Idempotency and re-sends

`agendaHash` is a SHA-256 of the rendered agenda payload. The handler stores it on every `nightly_agenda_emails` row. On every call:

1. If the most recent **sent** row matches the new hash → respond `unchanged`. No email, no DB write.
2. If the most recent row exists but the hash changed → respond `resend_ready` and prefix the subject with `[UPDATED] `.
3. If no prior row → respond `send_ready`.

This means the agent can run every 30 minutes all day and only one email per agenda version goes out. If Mom edits a block after the first send, the **next** tick will re-send because the hash changed.

---

## 5. Job B — Continuous Drive Hub mirror

### 5.1 Purpose

The dashboard never writes directly to Google Drive. Instead, every Mom/Grandma/Reagan upload (worksheets, agenda PDFs, day logs, recap replies, off-plan topic markdowns, …) creates a row in `drive_push_queue` with a target folder slug like `worksheets`, `agenda_pdf`, `day_log`, etc. Job B is the worker that drains that queue into Mom's Google Drive Hub:

```
Reagan School Hub (Dashboard)/
├── Admin and Homeschool Records/
├── Adventures and Enrichment/
├── Assignments and Work/
│   ├── Worksheets to Do/
│   ├── Submitted Work/
│   └── Photos of Work/
├── Curriculum and Standards/
├── Daily Operations/
│   ├── Day Logs/
│   ├── Daily Agenda PDFs/
│   └── Recap Replies/
├── Inbox (Unsorted)/
├── Printables and Resources/
├── Progress and Reports/
└── Todo/
```

The 9 top-level folders **already exist** in `spear.cpt@gmail.com`'s Drive and their IDs are persisted in `app_settings.drive.folder.*`. The cron worker must **never recreate them**. Subfolders (the second tier) may need to be created on first run; the dashboard caches resolved subfolder IDs under `app_settings.drive.folderMap.<parent>.<sub>` once the worker reports them back.

### 5.2 One-tick procedure

**Step B1 — Resolve / refresh the folder map.**

```sh
MAP=$(curl -sS "$SCHEDULED_TASK_ENDPOINT_BASE/api/scheduled/drive-folder-map" \
  -H "Cookie: app_session_id=$SCHEDULED_TASK_COOKIE")
```

The response shape is:

```json
{
  "ok": true,
  "rootFolderId": "1r3bJacP…",
  "rootFolderOwner": "spear.cpt@gmail.com",
  "topLevel": {
    "Admin and Homeschool Records": { "id": "1A…", "subfolders": ["IEP Snapshots (preserved)", …] },
    "Daily Operations":             { "id": "1D…", "subfolders": ["Day Logs", "Daily Agenda PDFs", "Recap Replies"] },
    …
  }
}
```

For each top-level folder:

1. List children using `gws drive list --parent <id>` (or the equivalent Drive MCP `drive_list_files`).
2. For each canonical `subfolders[]` name not already present, **create it** with `gws drive mkdir --parent <id> --name "<sub>"` and remember the new id.
3. Collect all `(parentName, subfolderName, driveFolderId)` tuples — both the ones that already existed and the ones you just created.

Then POST them back so the dashboard caches the IDs and skips the listing on the next tick:

```sh
curl -sS -X POST "$SCHEDULED_TASK_ENDPOINT_BASE/api/scheduled/drive-folder-map/result" \
  -H "Content-Type: application/json" \
  -H "Cookie: app_session_id=$SCHEDULED_TASK_COOKIE" \
  -d '{"entries":[{"parentName":"Daily Operations","subfolderName":"Day Logs","driveFolderId":"1xyz…"}, …]}'
```

> **Never recreate the 9 top-level folders.** Their IDs are pinned. If `topLevel["Daily Operations"].id` is non-null, do not call `mkdir` for it — only for its missing children.

**Step B2 — Drain the push queue.**

```sh
PEND=$(curl -sS "$SCHEDULED_TASK_ENDPOINT_BASE/api/scheduled/drive-push/pending" \
  -H "Cookie: app_session_id=$SCHEDULED_TASK_COOKIE")
```

Response:

```json
{
  "ok": true,
  "count": 7,
  "items": [
    {
      "id": 4821,
      "fileKey": "nightly-agendas/2026-09-08/agenda_5f1c2b9e.pdf",
      "fileUrl": "https://manus-storage-us1.s3.amazonaws.com/nightly-agendas/…?X-Amz-…",
      "fileName": "2026-09-08 - Reagan - Agenda.pdf",
      "mimeType": "application/pdf",
      "contentText": null,
      "targetFolder": "agenda_pdf",
      "targetSubpath": "2026-09",
      "canonicalParentSlug": "dailyOperations",
      "canonicalParentFolderId": "1D…",
      "subfolderName": "Daily Agenda PDFs",
      "status": "pending",
      "createdAt": "2026-09-07T22:14:11.000Z"
    },
    …
  ]
}
```

The enrichment fields (`canonicalParentSlug`, `canonicalParentFolderId`, `subfolderName`) tell you exactly where the file goes without any classification logic on the agent side. For each item, the destination folder is the cached id from Step B1's `entries[]` matching `(parentName=<the parent of canonicalParentSlug>, subfolderName)`. If `targetSubpath` is non-null (typically `YYYY-MM` for month bucketing), make sure that month subfolder exists under the resolved subfolder, creating it if necessary.

For each row, do exactly one of:

| Row shape | Action |
|---|---|
| `fileUrl` is set, `contentText` is null | Download the file from `fileUrl` (curl), upload to Drive with `gws drive upload` into the resolved month subfolder, name it `fileName`, mime `mimeType`. |
| `fileUrl` is null, `contentText` is set | Create the file directly from the markdown blob (`gws drive create --name "$fileName" --mime "text/markdown" --content-stdin <<< "$contentText"`), no S3 download needed. |
| Both null | `status: "skipped"` with `errorMessage: "no fileUrl or contentText"`. |

After the upload succeeds, capture the new Drive file id and report it:

```sh
curl -sS -X POST "$SCHEDULED_TASK_ENDPOINT_BASE/api/scheduled/drive-push/result" \
  -H "Content-Type: application/json" \
  -H "Cookie: app_session_id=$SCHEDULED_TASK_COOKIE" \
  -d "{\"id\": 4821, \"status\": \"pushed\", \"driveFileId\": \"1ABC…\"}"
```

Valid `status` values are `pushed`, `skipped`, `failed`. On failure, include `errorMessage` so Mom can see it in the `DrivePushQueueCard` UI.

**Step B3 — Snapshot the live state (optional, every tick).**

```sh
SNAP=$(curl -sS "$SCHEDULED_TASK_ENDPOINT_BASE/api/scheduled/drive-snapshot" \
  -H "Cookie: app_session_id=$SCHEDULED_TASK_COOKIE")
```

Response shape:

```json
{
  "ok": true,
  "generatedAt": "2026-09-08T01:30:00.000Z",
  "snapshot": {
    "assignments": [...],
    "finishedWork": [...],
    "scheduleNext7": [...],
    "coins": { "balance": 142, "ledger": [...] },
    "analytics": { "skills": [...], "struggles": [...] },
    "journal": [...]
  }
}
```

Convert the JSON to two files and upload them to Drive Hub > **Snapshots/{YYYY-MM-DD}/{HHMM}/**:

- `snapshot.json` — the raw payload, pretty-printed.
- `snapshot.csv` — a flat CSV of assignments + finishedWork (one row per item), good enough for a quick spreadsheet glance.

The Snapshots folder lives under "Reagan School Hub (Dashboard)" itself, not under one of the 9 canonical parents. Resolve / create it on first run the same way as the canonical subfolders. This step is **best-effort** — if it fails, log the error and move on; the queue work in B2 is the load-bearing path.

---

## 6. Registration (deferred until publish)

> **Do not register the cron until `*.manus.space` is live.** The bizserver POSTs to a fixed production URL; dev sandbox URLs rotate every restart, so a cron registered against a dev URL will silently fail after the next sandbox refresh.

When the dashboard is published (likely `https://reagandash-mm3swgic.manus.space` or `https://reaganschool.manus.space`), register an AGENT-cron from inside this Manus session:

```sh
manus-config schedule create \
  --title "Reagan dashboard — agenda email + Drive mirror" \
  --cron "0 */30 10-22 * * *" \
  --connector-uids "9444d960-ab7e-450f-9cb9-b9467fb0adda,f8900a57-4bd7-46cc-83a3-5ebd2420a817" \
  --agent-task-mode standard \
  --repeated \
  --playbook "$(cat /home/ubuntu/reagan_homeschool_dashboard/references/scheduled-task-playbook.md)" \
  --detail "Runs every 30 min from ~06:00–18:00 EDT. Job A sends the nightly agenda email when the day's plan changes; Job B drains drive_push_queue and refreshes the Drive folder map. Idempotent on agendaHash; safe to over-fire."
```

Cron expression notes:

- 6-field UTC: `sec min hour dom mon dow`. `0 */30 10-22 * * *` = on the hour and half-hour, hours 10–22 UTC inclusive (~06:00–18:00 EDT, which covers both the nightly send window and the daytime Drive mirror).
- Min interval is 60 s; 30-min spacing is well within bounds.
- Adjust the hour window after watching one full day in production.
- **Alternative split-cadence schedule** (preferred once Job B grows hot): register Job A and Job B as two separate AGENT crons. Job A runs `0 0 23 * * 1-5` (8 PM ET weeknights only — the nightly send window) with the same playbook §4 only. Job B runs `0 */15 * * * *` (every 15 min, 24×7) and skips §4 entirely. Both share the same playbook file but pass different `--detail` notes. Idempotency makes the split safe even if the two crons fire on the same minute.
- The current single-cadence schedule (`0 */30 10-22 * * *`) is still the recommended starting point; the split is an optimization for when the Drive queue routinely has >50 pending rows.

After registration, capture the returned `task_uid`. Inspect runs with `manus-heartbeat list` and `manus-heartbeat logs --task-uid <uid>` (the AGENT-cron and Heartbeat backends share the same listing surface). Pause / resume / delete with the same CLI.

---

## 7. Operational notes and gotchas

1. **Auth is automatic.** The cron caller's `app_session_id` cookie carries `openId = cron_<task_uid>`; `sdk.authenticateRequest` short-circuits this into a synthetic `role: "user"` `AuthenticatedUser` (`isCron: true`). All `/api/scheduled/*` handlers accept this. **Never** attempt to mint your own JWT, OAuth, or Bearer token.
2. **Idempotency everywhere.** Agenda email is hash-gated; drive-push uses row-state machine (`pending` → `pushed`/`skipped`/`failed`); folder-map cache is upsert. Re-running the cron 4× in a row yields the same end state as running it once.
3. **No retry loops on the agent side.** The platform retries 5xx and 429 (3 attempts, 3s → 1m backoff). Other 4xx are business failures; surface them in `errorMessage` so Mom can see the cause and fix the underlying input.
4. **2-minute handler timeout.** Each `/api/scheduled/*` call must return within 2 minutes. Job A typically returns under 5 s (PDF build is the slow part, ~3 s for a full day). Job B's per-row Drive upload is sub-second; cap at 100 rows per tick (the endpoint already does).
5. **Agenda hash, not date, is the dedupe key.** A re-send for the same date is intentional when blocks change. Do not add a "send-once-per-day" guard on the agent side — the dashboard already owns that policy.
6. **`pdfDownloadUrl` vs `pdfUrl`.** The cron MUST use `pdfDownloadUrl` (absolute presigned S3) in the email body. `pdfUrl` is the cookie-gated dashboard path and only works for an authenticated browser tab. Tested and broken from Gmail click-throughs (Mom and Grandma do not have dashboard cookies in Gmail).
7. **Worksheet attachments are deduped by url.** `hydrateLessonForBlock` URL-dedupes per-block printables against the assignmentsLibrary worksheet rows; you do not need to filter on the agent side.
8. **Drive Hub root is owned by Grandma (`spear.cpt@gmail.com`).** All file uploads land in her Drive. Mom has Editor access. Reagan has no access to the Hub root — kid-side flows go through the dashboard UI only.
9. **Tutor handoff PDFs land in `Daily Operations / Tutor Handoffs / {YYYY-MM} /`.** When a `drive_push_queue` row arrives with `targetFolder: "tutor"` and `contentText` set (markdown), create the file with mime `text/markdown` directly under the resolved subfolder. The `tutorHandoffSummary` mutation enqueues these on every tutor-day rollover (Sophie M/W/F, Anna T/Th by default — see `tutorOfDayStrip` for the active map). The cron worker does not need to know the tutor name; the row's `fileName` (e.g. `2026-09-08 - Sophie - Reagan Handoff.md`) already encodes it.
10. **Calendar awareness is server-side.** `ensurePlanForDate` already skips IH 2025-26 off-days and the summer auto-window (Jun 6 – Aug 15). The agent should never second-guess the date the email endpoint returns; if `forDate` is set, that's the next legitimate school day.
11. **`gmail_send_messages` parameter shape.** The MCP accepts `to`, `subject`, `content`, and `attachments` (file paths). It does **not** accept `htmlBody`, `bcc`, or `cc` as separate fields. If a CC is ever needed, append it to `to`.

---

## 8. Endpoint quick reference

| Method + path | Purpose |
|---|---|
| `POST /api/scheduled/nightly-agenda-email` | Build the next-school-day agenda PDF, return `status` + `attachments[]` + `pdfDownloadUrl` + `recordId`. Idempotent on hash. |
| `POST /api/scheduled/nightly-agenda-email/result` | `{ recordId, status, errorMessage?, drivePushed? }` — close the loop. |
| `GET /api/scheduled/drive-folder-map` | Returns hub root + 9 canonical parents (with persisted IDs) + canonical subfolder names. |
| `POST /api/scheduled/drive-folder-map/result` | `{ entries: [{parentName, subfolderName, driveFolderId}] }` — cache resolved subfolder IDs. |
| `GET /api/scheduled/drive-push/pending` | Up to 100 enriched queue rows (each with `canonicalParentFolderId` and `subfolderName`). |
| `POST /api/scheduled/drive-push/result` | `{ id, status: "pushed"\|"skipped"\|"failed", driveFileId?, errorMessage? }` — close one row. |
| `GET /api/scheduled/drive-snapshot` | Live JSON snapshot (assignments / finishedWork / scheduleNext7 / coins / analytics / journal). Used for B3. |

---

## 9. Cron prompt (paste-ready)

When registering, use the following as the agent prompt body. The agent already has Gmail and Drive MCPs attached.

> You are a Manus scheduled-task agent for Reagan's Homeschool Dashboard. Two env vars are pre-set: `$SCHEDULED_TASK_ENDPOINT_BASE` (the dashboard's HTTPS root) and `$SCHEDULED_TASK_COOKIE` (the `app_session_id` JWT). Pass the cookie on every dashboard request as `Cookie: app_session_id=$SCHEDULED_TASK_COOKIE`. Use Gmail MCP and Google Drive (`gws`) MCP for Google work; use `curl` for the dashboard.
>
> **Job A — Nightly agenda email.**
>
> 1. POST `$SCHEDULED_TASK_ENDPOINT_BASE/api/scheduled/nightly-agenda-email` with body `{}`.
> 2. If `status` is `unchanged` or `no_plan`, skip to Job B.
> 3. Else, decode each `attachments[i].contentBase64` (base64) into `/tmp/agenda-{forDate}-{filename}`.
> 4. Call `gmail_send_messages` with `to = recipients`, `subject = subject` (verbatim), `content` = a plain-text version of `htmlBody` (strip tags; ensure the `pdfDownloadUrl` value appears on its own line so Gmail auto-links it), and `attachments` = the list of `/tmp/agenda-…` absolute file paths from step 3. **Use `pdfDownloadUrl`, never `pdfUrl`, for the body link.**
> 5. POST `$SCHEDULED_TASK_ENDPOINT_BASE/api/scheduled/nightly-agenda-email/result` with `{ "recordId": <recordId>, "status": "sent" }`. On send failure use `"failed"` with an `errorMessage`.
>
> **Job B — Drive Hub mirror.**
>
> 1. GET `$SCHEDULED_TASK_ENDPOINT_BASE/api/scheduled/drive-folder-map`. For each top-level folder, list children via `gws drive`. For every canonical subfolder name not present, create it. **Never recreate the 9 top-level folders.** POST resolved `(parentName, subfolderName, driveFolderId)` tuples back to `/api/scheduled/drive-folder-map/result`.
> 2. GET `$SCHEDULED_TASK_ENDPOINT_BASE/api/scheduled/drive-push/pending`. For each item, find the destination folder using `canonicalParentFolderId` + `subfolderName` from the response and `targetSubpath` for the month bucket (creating the month subfolder if missing). If `fileUrl` is set, curl-download then `gws drive upload`. If `contentText` is set, create the file directly from the markdown blob with mime `text/markdown`. POST `/api/scheduled/drive-push/result` with `{ id, status: "pushed", driveFileId }` on success or `"failed"` with `errorMessage` on failure.
> 3. GET `$SCHEDULED_TASK_ENDPOINT_BASE/api/scheduled/drive-snapshot`. Upload `snapshot.json` (pretty-printed) and a flat `snapshot.csv` of assignments + finishedWork to `Reagan School Hub (Dashboard) / Snapshots / {YYYY-MM-DD} / {HHMM}/`. Best-effort — do not fail the run if this step errors.
>
> Idempotency: every endpoint is safe to call repeatedly. The platform handles 5xx/429 retries; you must not loop. Stay under 100 queue rows per tick.

---

## 10. Maintenance hooks

- **Source-pattern test.** `server/scheduledTaskPlaybookContract.test.ts` reads this file as text and asserts the response-shape claims (e.g. that the playbook still mentions `pdfDownloadUrl`, the 9 canonical parents, the `recordId` ack pattern). If the agenda endpoint contract changes, update this file and the test in the same push.
- **When adding a new `/api/scheduled/*` route.** Cross-link it from §8 and from the relevant Job (or add a new Job §). The cron prompt in §9 should list every endpoint the agent calls.
- **When publishing the site.** Replace the placeholder URL guidance in §6 with the final `*.manus.space` URL, run `manus-config schedule create`, and store the returned `task_uid` in the project README's "Operations" section.
