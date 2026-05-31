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

const ALL_RUNBOOKS: Runbook[] = [resendRunbook, skillSixthGradeRunbook];

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
export type RunbookSummary = Omit<Runbook, "body">;

export function listRunbookSummaries(): RunbookSummary[] {
  return listRunbooks().map(({ body: _body, ...rest }) => rest);
}
