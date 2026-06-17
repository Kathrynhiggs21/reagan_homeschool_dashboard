/**
 * runbooks — registry of user-action runbooks that explain blocked items
 * in the dashboard. Each entry is a self-contained Markdown doc with a
 * stable slug so the Settings UI can list + render them without ever
 * hitting the filesystem at runtime (which is unreliable on Cloud Run
 * once the references/ folder is outside the bundled tree).
 *
 * To add a new runbook:
 *   1. Drop the Markdown file into `references/` for posterity / git.
 *   2. Inline the same content here under a new {slug, title, body, ...}
 *      entry so the Settings UI can serve it.
 *   3. Add a test scenario in `server/runbooks.test.ts` asserting the
 *      slug, title, and at least one substring of the body.
 *
 * v3.19 (2026-05-30) — initial registry with the 2 user-action runbooks
 * authored at the end of the v3.18 session.
 */

export type RunbookCategory = "email" | "drive" | "calendar" | "skills" | "other";

export type Runbook = {
  /** Stable url-safe identifier; matches the references/*-runbook.md filename without extension. */
  slug: string;
  /** Human-readable title shown in the Settings card list. */
  title: string;
  /** Coarse grouping for the card UI. */
  category: RunbookCategory;
  /** One-sentence summary of what the user will do. */
  oneLineSummary: string;
  /**
   * Estimated minutes for the user to complete this runbook end to end,
   * rounded up to the nearest 5. Used by the UI to set expectations.
   */
  estimatedMinutes: number;
  /** Full Markdown body. */
  body: string;
  /** ISO date string for the last in-code revision of the body. */
  lastUpdatedISO: string;
};

/** Resend custom-domain runbook. */
const resendRunbook: Runbook = {
  slug: "resend-custom-domain",
  title: "Verify a Resend custom domain so Grandma's email lands without SMTP fallback",
  category: "email",
  oneLineSummary:
    "Add DNS records at your registrar, verify the domain at resend.com, then clear MAIL_ALLOWED_RECIPIENTS.",
  estimatedMinutes: 30,
  lastUpdatedISO: "2026-05-30",
  body: `# Resend Custom Domain Verification — Runbook

**Why this matters:** Resend's free tier on the shared \`onboarding@resend.dev\`
domain only accepts the address that owns the API key (today: \`spear.cpt@gmail.com\`).
Until a custom domain is verified, \`marcy.spear@gmail.com\` (Grandma Marcy) cannot
receive the nightly agenda email through Resend. The Gmail SMTP fallback covers
her today, but verifying a domain is the right long-term fix and removes the
fallback dependency.

## What's already in place

- \`server/_core/mailer.ts\` reads \`MAIL_ALLOWED_RECIPIENTS\` from env. Today this
  is set to \`spear.cpt@gmail.com\` (single allow-list entry) so Resend never
  attempts to deliver to Grandma directly.
- \`server/_core/mailer.ts\` already has a Gmail SMTP fallback transport that
  picks up any recipient Resend's allow-list filter dropped, using
  \`GMAIL_SMTP_USER\` + \`GMAIL_APP_PASSWORD\`. So Grandma still gets the email,
  just via SMTP not Resend.
- 4 vitest scenarios in \`server/mailerResend.test.ts\` lock the dual-path
  behavior: Resend-only path, allow-list dropped → SMTP fallback, both paths
  fail → returns the right error envelope.

## Steps for the user

1. Pick a domain you own (or buy one). The cheapest path is to use the
   existing \`scribblesbymarcy.com\` if Marcy is OK with sending Reagan's school
   email through that domain; otherwise buy a cheap \`.com\` like
   \`reaganhomeschool.com\` at any registrar.
2. Go to \`https://resend.com/domains\` and click **Add Domain**.
3. Resend will give you a set of DNS records to add (1 SPF TXT, 1 DKIM CNAME or
   TXT, optionally 1 DMARC TXT). Add each one at your DNS provider.
4. Wait 10-30 minutes (sometimes faster) and click **Verify** in Resend.
5. Once verified, in this project's settings panel, update:
   - \`MAIL_FROM\` = \`Reagan's School Dashboard <agenda@your-verified-domain.com>\`
   - \`MAIL_ALLOWED_RECIPIENTS\` = (delete this env var entirely so the allow-list
     is empty and every recipient goes through Resend)
6. Send a test email from the **Mail Diagnostics** card in the adult Settings
   page (or call \`trpc.mail.testSend\` from a tRPC client). You should see
   both \`spear.cpt@gmail.com\` and \`marcy.spear@gmail.com\` in the success
   recipients list, with \`path: "resend"\` (not \`"smtp_fallback"\`).
7. Mark the todo item as \`[x]\`.

## Rollback

If Resend has trouble with the custom domain, keep \`MAIL_ALLOWED_RECIPIENTS\`
populated and rely on the SMTP fallback — no code change needed. The
fallback was specifically designed for this scenario.
`,
};

/** SKILL.md 6th-grade update runbook. */
const skillSixthGradeRunbook: Runbook = {
  slug: "skill-md-sixth-grade-update",
  title: "Update reagan-homeschool-grading SKILL.md for 6th grade",
  category: "skills",
  oneLineSummary:
    "Paste the drafted 6th-grade rubric section into the user-managed Manus skill file.",
  estimatedMinutes: 5,
  lastUpdatedISO: "2026-05-30",
  body: `# reagan-homeschool-grading SKILL.md — Sixth Grade Update Runbook

**Why this matters:** The \`reagan-homeschool-grading\` skill (a Manus
user-managed Skill, lives in \`/home/ubuntu/skills/reagan-homeschool-grading/\`
on a fresh sandbox) currently documents 5th-grade grading expectations only.
When summer mode flips to grade 6 the skill has no guidance for the harder
6th-grade rubric, so AI grading runs on stale prompts.

## What's already in place (in this codebase)

- \`server/_lib/seedSixthGradeLadder.ts\` — 22 curated Ohio-aligned 6th-grade
  ladder rows with \`OH.6.<strand>.<n>\` codes and full-strand descriptions.
- \`server/_lib/blockAutoAttach.ts\` — picks 6th-grade rows when
  \`effectiveSummerActive(date) === true\`.
- \`references/sixth-grade-summer-prep.md\` — narrative guide for summer mode
  6th-grade work; covers Math + ELA priorities and Ohio mid-grade
  benchmarks.

The skill update is the AI-prompt-side counterpart: when the skill is
loaded by the grader and the active grade level is 6, the rubric expectations
should match.

## Steps for the user

1. Open \`/home/ubuntu/skills/reagan-homeschool-grading/SKILL.md\` (or wherever
   you maintain that skill) in your editor.
2. Add a new section **"6th Grade Adjustments"** under the existing 5th-grade
   rubric. Suggested content:

~~~markdown
## 6th Grade Adjustments (active when summer mode = on, or after promotion)

When the active grade level is 6, scale the rubric:

### Math
- Multi-step word problems: expect students to show work + check answer
  reasonableness, not just the right number.
- Fractions/decimals/percent: expect fluent conversion among forms.
- Ratios + proportions: brand new for 6th grade — accept developing-level work
  on first introduction.
- Negative numbers + integer ops: brand new — accept developing-level work.
- Algebraic thinking (variables, expressions): brand new — accept
  developing-level work.

### ELA
- Writing: expect 5-paragraph structure with thesis + evidence + counterpoint.
- Reading: expect identification of theme, character development, and author's
  craft (not just plot summary).
- Vocabulary: expect Greek/Latin root identification.

### Science (Ohio 6th-grade band)
- Earth's place in space (Sun, Moon, planets, gravity)
- Cells as the basic unit of life
- Force, motion, simple machines

### Social Studies (Ohio 6th-grade band)
- Ancient civilizations (Mesopotamia, Egypt, Greece, Rome, China, India)
- Geography of the Eastern Hemisphere
- Civic discourse + early government structures

### Mastery thresholds
Same as 5th grade — green ≥ 75, amber 40-74, rose < 40 — but the underlying
work is harder, so a green at 6th grade represents real readiness for 7th.
~~~

3. Save the file.
4. Reload the skill in any open Manus session that uses it
   (close the chat or call \`/reload-skills\`).
5. Mark the todo item as \`[x]\`.

## Cross-reference

For full Ohio 6th-grade scope detail beyond what fits in the skill, the
**13th doc** in \`server/_lib/driveReferenceDocs.ts\` (slug:
\`ohio-standards-full-reference\`) covers all four subjects with code-level
standards. Once Drive credentials land, this doc gets pushed into
\`Curriculum and Resources/\` for Mom + Grandma + tutors to reference too.
`,
};

/** Google Drive OAuth setup runbook (v3.20 — 2026-05-31). */
const googleDriveOAuthRunbook: Runbook = {
  slug: "google-drive-oauth-setup",
  title: "Optional: connect Google Drive & Classroom (not required — dashboard works without it)",
  category: "drive",
  oneLineSummary:
    "Optional. Only needed if you want Drive backup of notes or Classroom assignment import. The dashboard, calendar, coins, and agenda email all work without this. Setup: create a Google Cloud project, enable Drive API, generate an OAuth token, and drop it into the project env.",
  estimatedMinutes: 45,
  lastUpdatedISO: "2026-05-31",
  body: `# Google Drive OAuth Setup — Runbook

**Why this matters:** The dashboard already enqueues \`drive_push_queue\`
rows from a dozen places (day logs, recap replies, 13 reference Markdown
docs, future-worksheet imports). The credential-gated worker in
\`server/_lib/drivePushWorker.ts\` short-circuits with
\`status: "skipped_no_credentials"\` until a Drive credential lands in env.
The same applies to \`driveFolderDedupeJob.ts\` and \`googleCalendarSync.ts\`.

The moment you set **either** \`GOOGLE_DRIVE_OAUTH_TOKEN\` **or**
\`GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON\`, all three workers flip live on the
next heartbeat tick with zero callsite changes.

## What's already in place

- \`getDriveCredentialStatus()\` in \`server/_lib/drivePushWorker.ts\` reads
  both env vars and returns either
  \`{ kind: "ready", source: "oauth_token" | "service_account" }\` or
  \`{ kind: "not_configured", reason: ... }\`. Today it returns
  \`not_configured\`.
- \`runDrivePushWorker()\` drains \`drive_push_queue\` rows, performs
  hash-based skip against target-folder children, uploads anything new,
  and marks each row \`pushed\` / \`skipped\` / \`failed\`.
- \`runDriveFolderDedupeJob()\` walks the 9 canonical hub folders for
  duplicate sub-folders (groups by name + content hash, picks the oldest
  by \`createdTime\`, trashes the others — **never** the 9 canonical
  top-level folders).
- \`runGoogleCalendarSync()\` does one-way push of scheduled blocks to a
  Google Calendar id when the same credential is available.

All three workers fail closed (no DB writes, no errors) until credentials
land — so it's safe to keep the heartbeat schedules running today.

## Steps for the user (OAuth token path — preferred for personal use)

1. Go to \`https://console.cloud.google.com/\` and either pick an existing
   project or click **New Project** (name suggestion: \`reagan-school-hub\`).
2. In the search bar, type \`Drive API\` and click **Enable**. (Optional:
   also enable \`Google Calendar API\` if you want the calendar sync
   worker to come online at the same time.)
3. Go to **APIs & Services → OAuth consent screen**:
   - User type: **External**
   - App name: \`Reagan School Hub\`
   - User support email: \`spear.cpt@gmail.com\`
   - Developer contact: \`spear.cpt@gmail.com\`
   - Scopes: add
     \`https://www.googleapis.com/auth/drive\` (full Drive — needed to
     create folders + upload + trash) and optionally
     \`https://www.googleapis.com/auth/calendar\` for calendar sync.
   - Test users: add \`spear.cpt@gmail.com\` (and \`marcy.spear@gmail.com\`
     if you want Grandma to also be able to grant the token).
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth
   client ID**:
   - Application type: **Desktop app**
   - Name: \`Reagan School Hub CLI\`
   - Click **Create**, then download the \`client_secret_*.json\`.
5. On any machine with Node, run the OAuth playground or a one-liner to
   exchange the client secret for a refresh token. The quickest path is
   \`https://developers.google.com/oauthplayground/\`:
   - Click the gear icon → **Use your own OAuth credentials** → paste
     client id + client secret from step 4.
   - In the left scope list pick
     \`https://www.googleapis.com/auth/drive\` and click **Authorize APIs**.
   - Sign in as \`spear.cpt@gmail.com\`.
   - On the next screen click **Exchange authorization code for tokens**.
   - Copy the **refresh token** (long string starting with \`1//\`).
6. The full token blob the worker expects is a JSON object with shape:
   ~~~json
   {
     "client_id": "...apps.googleusercontent.com",
     "client_secret": "...",
     "refresh_token": "1//...",
     "type": "authorized_user"
   }
   ~~~
   Save that JSON as a single line.
7. In the **adult Settings → Secrets** panel of this project, add a new
   env var:
   - Key: \`GOOGLE_DRIVE_OAUTH_TOKEN\`
   - Value: the single-line JSON from step 6.
8. (Optional, if you also want the calendar sync worker to come online)
   add a second env var:
   - Key: \`GOOGLE_CALENDAR_ID\`
   - Value: the calendar id (\`primary\` works; or a dedicated calendar
     id from Google Calendar settings).

## Alternative: service account path (better for unattended/server use)

1. Same Cloud project as steps 1-2 above.
2. Go to **IAM & Admin → Service Accounts → Create Service Account**:
   - Name: \`reagan-school-hub-bot\`
   - Role: leave blank (no project-level role needed; we grant access at
     folder level instead).
3. Open the new service account, go to **Keys → Add Key → JSON**.
   Download the \`reagan-school-hub-bot-*.json\`.
4. In Google Drive, navigate to the **"Reagan School Hub"** root folder.
   Right-click → **Share**. Paste the service account email
   (\`...iam.gserviceaccount.com\`) and grant **Editor** access. This is
   the magic step — without it the service account can see nothing.
5. In the project Secrets panel, add:
   - Key: \`GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON\`
   - Value: the **entire** JSON file contents (paste as one line; the
     credential gate accepts multi-line too but single-line is safer).

## Verification (after either path)

1. Open the **adult Settings → Automation Health** card. Within ~60s
   the next heartbeat tick will run the Drive push worker. The card
   should flip from \`skipped_no_credentials\` to \`drained\` (or
   \`drained_with_errors\` if any single row failed — check the
   per-row error message).
2. Open Google Drive and confirm the 13 reference Markdown docs landed
   in their canonical folders (Curriculum and Standards, Adventures and
   Enrichment, Daily Operations, etc.).
3. Pick any day log from the past week and click **Push to Drive** on
   the Day Log card — the row should turn \`pushed\` within one
   heartbeat tick.
4. Mark this runbook **Dismiss** in the Settings card so it stops
   showing in the runbooks list.

## Rollback / safety

- If the worker uploads something you didn't expect, **delete the env
  var** in Secrets. The next heartbeat tick will return to
  \`skipped_no_credentials\` and stop touching Drive.
- The folder dedupe job has a **pinned-folder allow-list** of the 9
  canonical hub roots (\`Adventures and Enrichment\`, \`Assignments and
  Work\`, \`Curriculum and Standards\`, \`Daily Operations\`,
  \`Inbox Unsorted\`, \`Printables and Resources\`, \`Progress and
  Reports\`, \`Reagan School Hub\`, \`TODO\`). The job **will not**
  trash any of those even when running live, by design — see
  \`isPinnedHubRoot()\` in \`driveFolderDedupeJob.ts\`.
- The push worker **never** deletes — it only creates new files and
  skips duplicates. The dedupe job is the only thing that trashes (and
  it trashes, not permanently deletes; recoverable for 30 days from
  Drive trash).

## Cross-reference

The live API path notes for each worker are inlined at the top of
\`drivePushWorker.ts\`, \`driveFolderDedupeJob.ts\`, and
\`googleCalendarSync.ts\` so the next implementer doesn't have to
re-derive them. Hash-based skip is via Drive's \`md5Checksum\` field;
folder resolution is lazy and cached process-lifetime.
`,
};

const ALL_RUNBOOKS: Runbook[] = [resendRunbook, skillSixthGradeRunbook, googleDriveOAuthRunbook];

/**
 * Return the runbook registry as a sorted, defensive copy. Sorted by
 * (category, title) so the UI list is stable.
 */
export function listRunbooks(): Runbook[] {
  return [...ALL_RUNBOOKS].sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.title.localeCompare(b.title);
  });
}

/**
 * Return a single runbook by slug, or null if no match. Slug match is
 * exact + case-sensitive so the URL doesn't accidentally serve the wrong
 * doc when a user types `Resend-Custom-Domain` instead of the lowercase
 * canonical slug.
 */
export function getRunbookBySlug(slug: string): Runbook | null {
  if (!slug || typeof slug !== "string") return null;
  return ALL_RUNBOOKS.find((r) => r.slug === slug) ?? null;
}

/** Convenience summary used by the list endpoint (no body, for payload size). */
export type RunbookSummary = Omit<Runbook, "body"> & {
  /**
   * v3.20 (2026-05-31) — true if an admin has clicked "Dismiss" on this
   * runbook so it no longer shows in the default list. Persisted via the
   * generic `appSettings` KV table under key
   * `runbooks.dismissed.<slug>` = ISO date string. Surfacing the flag in
   * the summary lets the UI filter without a second roundtrip.
   */
  dismissed: boolean;
  /** ISO date string when the runbook was dismissed (null when active). */
  dismissedAtISO: string | null;
};

/**
 * Build the summary list with dismissed state attached. Pure — the caller
 * passes the set of dismissed slugs (read from the KV store by the tRPC
 * procedure). Tests can call this directly without touching the DB.
 */
export function buildRunbookSummariesWithDismissals(
  dismissedSlugToISO: Record<string, string>,
): RunbookSummary[] {
  return listRunbooks().map(({ body: _body, ...rest }) => {
    const iso = dismissedSlugToISO[rest.slug];
    return {
      ...rest,
      dismissed: !!iso,
      dismissedAtISO: iso ?? null,
    };
  });
}

/** Legacy zero-arg form retained for callers that don't have a dismissals map. */
export function listRunbookSummaries(): RunbookSummary[] {
  return buildRunbookSummariesWithDismissals({});
}

/** Stable KV key used by appSettings to persist a per-slug dismissal ISO. */
export function runbookDismissalSettingKey(slug: string): string {
  return `runbooks.dismissed.${slug}`;
}

/** Prefix for `listAppSettings` scans. */
export const RUNBOOK_DISMISSAL_KEY_PREFIX = "runbooks.dismissed.";

/** Inverse of `runbookDismissalSettingKey` — returns slug or null when prefix doesn't match. */
export function parseRunbookDismissalKey(key: string): string | null {
  if (!key.startsWith(RUNBOOK_DISMISSAL_KEY_PREFIX)) return null;
  const slug = key.slice(RUNBOOK_DISMISSAL_KEY_PREFIX.length);
  if (slug.length === 0) return null;
  return slug;
}
