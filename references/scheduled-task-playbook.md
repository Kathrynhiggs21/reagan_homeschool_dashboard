# Scheduled-Task Playbook v2 — JWT + tRPC routes (2026-05-27)

> **Why v2?** The original playbook (`scheduled-task-playbook.md`) routed every call through `/api/scheduled/*`, which requires a separate `CRON_SECRET` env var that the platform does not inject into agent-cron sessions. v2 switches to the public tRPC routes with a long-lived JWT cookie that the user generated from their own browser session.

## AUTHENTICATION

Use the following JWT cookie for ALL dashboard API calls (trpc routes):

- **Cookie name**: `app_session_id`
- **Cookie value**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvcGVuSWQiOiJjUjJRazluTG1wb1hlRTdXNEZjNGlGIiwiYXBwSWQiOiJtbTNzd0dpY3RRTEhEV0tQSkNHaUhwIiwibmFtZSI6IkthdGhyeW4gSGlnZ3MiLCJleHAiOjE4MDg4OTUyNjl9.pnlm8lAcZHnr7HDxXf-P7nuijht_aBj4aoHMuvm-BTE`
- **Expires**: April 2027
- **Use as**: `-b "app_session_id=<value above>"`
- **Base URL**: `https://reaganschool.manus.space`

> **IMPORTANT**: Do NOT use `/api/scheduled/*` endpoints (they require a separate CRON_SECRET that is unavailable). Use `/api/trpc/*` routes instead.

## JOB A — NIGHTLY AGENDA EMAIL

1. **Determine the next school day:**
   - If today is Friday → next school day = Monday
   - If today is Saturday → next school day = Monday
   - If today is Sunday → SKIP email entirely (no email on Sunday)
   - Otherwise → next school day = tomorrow

2. **Fetch the agenda via trpc:**
   ```sh
   curl -s -b "app_session_id=<JWT>" \
     'https://reaganschool.manus.space/api/trpc/agendaEditor.snapshot?batch=1&input={"0":{"json":{"date":"<YYYY-MM-DD>"}}}'
   ```

3. **If the response has blocks** (blocks array is non-empty):
   - Format a clean email:
     - Subject: `Reagan's School Day — <Day, Month Date>`
     - Body: List each block with title, description, duration, subject
   - Send via Gmail MCP to: `spear.cpt@gmail.com`, `marcy.spear@gmail.com`
   - If today is Saturday, also include a "Weekend preview" note

4. **If blocks array is empty** → no plan exists for that day. Send a short notice email:
   - Subject: `No plan yet for <Day>`
   - Body: `No blocks have been added for <date>. Mom can add them in the dashboard.`

## JOB B — DRIVE HUB MIRROR

**Hub root folder ID:** `1r3bJacPLJN7VHI8y72rcx1-GRxspqo1r`

### Target folder map

| Folder name | Drive folder ID |
|---|---|
| Finished Work | `1xQ7vJp8kR9mN3wL5tY2bA6dF4hG0jK8` |
| Worksheets | `1SmXWhLk7SF_JNoVa5TWqtAdH60tNSjWA` |
| Apps & Tools | `11nFevBu1OP-GhKSSJvS5PyEpKS8p-FQW` |
| Daily Schedule | (find by name under Hub root) |
| Printables | (find by name under Hub root) |
| Report Cards | (find by name under Hub root) |
| Journal | (find by name under Hub root) |
| Analytics | (find by name under Hub root) |
| Adult Notes | (find by name under Hub root) |
| Kiwi Coins | (find by name under Hub root) |
| Tutor / Tutor Handoffs | (find by name under Hub root) |
| Bookshelf | (find by name under Hub root) |
| Adventures | (find by name under Hub root) |
| Practice for Coins | (find by name under Hub root) |
| Notebook | (find by name under Hub root) |
| Curriculum Checklist | (find by name under Hub root) |
| Assignments | (find by name under Hub root) |

### STEP 1 — Collect files from dashboard via trpc

**a) Submissions (uploaded work photos):**
```sh
curl -s -b "app_session_id=<JWT>" \
  'https://reaganschool.manus.space/api/trpc/submissions.list?batch=1&input={"0":{}}'
```
Each item has: `id, title, fileKey, fileUrl, submissionType`. Download each file from `https://reaganschool.manus.space/manus-storage/<fileKey>` and upload to "Finished Work" folder.

**b) Notebook attachments:**
```sh
curl -s -b "app_session_id=<JWT>" \
  'https://reaganschool.manus.space/api/trpc/notebookAttachments.list?batch=1&input={"0":{}}'
```
Upload to "Notebook" folder.

**c) Printables (today's worksheets):**
```sh
curl -s -b "app_session_id=<JWT>" \
  'https://reaganschool.manus.space/api/trpc/printables.today?batch=1&input={"0":{}}'
```
Upload to "Worksheets" folder.

### STEP 2 — Daily snapshot

Create folder: `Snapshots/<YYYY-MM-DD>/<HHMM>/` under Hub root. Save these files:
- `snapshot.json`: Full `agendaEditor.snapshot` response for today
- `schedule_next7.csv`: Agenda snapshots for next 7 days
- `submissions.csv`: Current submissions list

### STEP 3 — Prune old snapshots

Keep only the last 7 days of snapshot folders. Delete older ones.

### STEP 4 — Update README

Update the "Last refreshed" line in `Reagan School Hub/README.md` with current timestamp and status.

## SKIP CONDITIONS

- **Sunday**: Skip the agenda email (no school tomorrow is Monday but preview not needed on Sunday)
- If `agendaEditor.snapshot` returns empty blocks for target date: still send notice email
- If trpc routes return errors: log the error, update README with failure note, do not retry

## NOTES

- The `/api/scheduled/*` endpoints are BROKEN (CRON_SECRET not available). Do NOT use them.
- Use `/api/trpc/*` routes with the JWT cookie instead.
- The JWT expires April 2027. If it stops working, the user needs to generate a new one by logging into the dashboard and extracting the cookie from browser dev tools.
- Drive operations use the `gws` CLI (pre-configured with `spear.cpt@gmail.com`).
