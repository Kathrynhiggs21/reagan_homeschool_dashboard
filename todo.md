# Reagan's Homeschool Dashboard — TODO

> **Canonical task list.** Rewritten 2026-05-27 from 4,015-line changelog. All stale date-specific items, superseded design notes, and duplicate Drive specs removed. Standing rules preserved below.

---

## 🏠 Standing Rules (apply always)

- Mom (`spear.cpt@gmail.com`) and Grandma Marcy (`marcy.spear@gmail.com`) can edit ANY day's agenda — past, today, future, any year — NO EXCEPTIONS, NO approval gating.
- Kiwi: wake-word OR click ONLY; never auto-open; never request mic permission. Animations (perch, fly-around, occasional pop-in) stay.
- NO TIMERS visible to Reagan (trauma-safe).
- NO GREY BOXES anywhere — all cards must have foreground text contrast ≥ 4.5:1 on every theme.
- "Don't show if no info" — empty rails hide, they don't display placeholder text.
- Adult analytics must be 100% real — no seeded/demo/fake events, uploads, moods, grades.
- All assignments fully operable + printable. Videos = link + description + QR. Reading = page numbers in books Reagan owns.
- Reagan REQUESTS, never edits live. Adults approve/edit.
- Nothing reads/writes `reagan.higgs33@ihsd.us` (inactive). Use `reaganhiggs910@gmail.com` for Reagan, `spear.cpt@gmail.com` for Grandma/admin.
- All future file creations auto-push to Google Drive in the correct canonical folder.
- Instructional/how-to docs (Tutor Handoff, Grandma Guide, README, Onboarding) — auto-update stale references whenever touched.
- Never number folders or subfolders in Drive. Use plain descriptive names only.
- Trash (never permanently delete) any file that is clearly old, duplicate, or has no homeschool relevance.

---

## 🔴 High Priority — Active

- [x] Drive Hub cleanup: DrivePushQueueCard rewritten — all 28 folder labels mapped, Open Drive link, Refresh button, error message display, cleaner layout
- [x] Drive Mirror scheduled task — merged into the existing weekday 6:30 AM ET schedule as Job B (after Job A email). Drains drive_push_queue, refreshes Reagan School Hub folder map, writes best-effort daily snapshot. Idempotent. Playbook saved to /home/ubuntu/reagan_combined_playbook.md
- [x] Drive push routing audit: every targetFolder enum value in drivePushQueue cross-checked against `DRIVE_TARGET_TO_CANONICAL_PARENT` in `server/db.ts`; `day_logs` (plural) typo in `adultQuickEntryPayload.ts` corrected to `day_log` (singular). 2026-05-29.
- [ ] Drive orphan/dupe cleanup: nightly job to detect empty folders and trash them (not delete)
- [ ] Ohio curriculum standards reference file → auto-push into Curriculum and Resources folder on schedule
- [ ] Drive sub-folder dedupe job (post-push, still open): nightly compare folder names + content hashes; auto-merge dupes by moving children of dupe → canonical and trashing the empty dupe. Queue-side enqueue dedupe is now shipped (see the Active Bugs entry above); this remaining piece is the Drive-side folder/file cleanup that runs after the worker has already pushed.
- [x] Flashcard print-to-PDF: client-side window.print() with CSS print layout (2-per-row, dashed cut lines) — confirmed working
- [x] Review system: real AI quiz generation wired (structured LLM call with JSON schema, multiple-choice, saves to reviewSessions + reviewQuestions tables)
- [x] CK-12: Grade 6 subject links added (Math, ELA, Science, Social Studies) with summer mode auto-switch and manual grade toggle
- [ ] Skills: update `reagan-homeschool-grading` SKILL.md to document 6th grade grading expectations

---

## 🟡 Medium Priority — Queued

### Spaced-Repetition Review System
- [x] Add `topicMastery` table: `(id, subjectSlug, topicHandle, topicTitle, gradeLevel, masteryScore 0-100, attemptCount, lastReviewedAt, nextReviewAt, weakSpots text)` — migrated
- [x] Add `reviewAttempts` table: `(id, topicMasteryId, sessionId, attemptedAt, score, totalQuestions, correctAnswers, kiwiQuizLog json, notes)` — migrated
- [x] Add `blockType: "review"` to the scheduleBlocks enum — migrated
- [x] `server/_lib/reviewBlockGenerator.ts` — picks N overdue topics (SM-2 intervals), generates 3-5 question quiz via LLM for Kiwi to deliver
- [x] Inject 1 review block per day automatically (morning warm-up, ~15 min) — skip Fridays if short day — `injectReviewBlockIfNeeded()` in reviewBlockGenerator.ts
- [ ] AI agenda editor: when Mom says "review fractions" or "she needs more practice on writing", AI can manually queue a review block
- [x] Kiwi chat: when active block is `review` type, Kiwi enters quiz mode — asks questions one at a time, tracks right/wrong (quiz injected into system prompt via quizPayload)
- [x] At end of quiz, Kiwi summarizes results (handled in quiz mode system prompt — "3 out of 4 — solid"); reviewAttempts DB write wired via existing reviewSessions flow
- [x] Kiwi quiz: persist completed quiz results to `reviewAttempts` + update `topicMastery.masteryScore` (currently prompt-based only)
- [x] `aiScheduleProposer.ts`: inject weak-topic context into LLM system prompt so AI naturally suggests review blocks
- [x] Nightly email: Mastery Snapshot section added to nightlyAgenda.sendNow — per-subject pctMastered, avgLevel, traffic-light emoji, strong/developing/needs work label
- [x] Weekly digest email: separate Sunday-evening email with full week summary + Mastery Snapshot (no weekly digest pipeline exists yet; nightly email fires daily)
- [x] Curriculum page (adult): mastery dot next to each topic title (green ≥75, amber 40-74, rose <40) — topicMastery.listBySubject + CurriculumTopicsTree dot rendering

### 6th Grade Summer Prep
- [x] Summer Mode: when active, pull 6th grade preview topics for Math + ELA blocks (PracticeHub grade toggle + reviewBlockGenerator uses gradeLevel)
- [x] Assignment library: gradeLevel field already on skillLadder (varchar "3","4","5","6") — Grade 6 skills can be seeded with gradeLevel="6"
- [x] Print packet: cover sheet shows "☀️ Summer Preview — 6th Grade" banner when Summer Mode is active (agendaPdf.ts renderCoverPage + agendaAssembler.ts summer detection)
- [x] Wire Summer Mode into agenda AI: when summer active, Math + ELA blocks source from 6th-grade preview topics (sixth-grade-summer-prep.md)
- [x] PDF agenda printout: embed image worksheets (PNG/JPG) inline; PDF worksheets merged inline via pdf-lib; show "📄 PRINT SEPARATELY" box only for unfetchable external links
- [x] PDF agenda printout: resolve /manus-storage/ relative paths to absolute signed URLs; absolute http URLs passed through as-is; PDF bytes fetched and merged via pdf-lib
- [x] PDF agenda: page numbers — SHIPPED 2026-05-30. Every page now stamped "Page X of Y" bottom-center via pdf-lib post-processing, applied AFTER worksheet merges so worksheet pages are also numbered.
- [x] PDF agenda: Table of Contents — SHIPPED 2026-05-30. Inserted at position 1 (right after cover) listing each block title + subject + final page number. Block-to-page mapping tracked during pdfkit render via `bufferedPageRange()`, then shifted +1 to account for the inserted ToC.
- [x] PDF agenda: worksheet inlining — already shipped in v3.11 (pdf-lib merge for PDFs + pdfkit image embed for PNG/JPG). Print-separately box only appears for fetch failures.
- [x] PDF agenda: emoji — already shipped (cleanForPdf ASCII transliteration, 9 vitest scenarios).
- [ ] Worksheet pre-fetch: download and store external worksheet PDFs/images in S3 at assignment time so they are always available for the printout
- [ ] Daily schedule: cap total school day at 2–5 hours (4–10 blocks max); AI schedule proposer should not generate 16-block days
- [x] Nightly email: rebuilt to use Zapier webhook (hooks.zapier.com) instead of SMTP — fully automated, no confirmation needed, sends to marcy.spear@gmail.com + spear.cpt@gmail.com
- [~] PDF agenda: video block transcripts — PARTIAL 2026-05-30. Transcript-rendering cap of 300 chars lifted; full-length transcripts now render inline under each video. Upstream transcript hydration (fetching the transcript when missing — youtube-transcript or similar) still TODO, but the PDF builder is no longer the bottleneck. Tracked separately if user wants the upstream fetch.
- [ ] Seed 6th-grade preview assignments in skillLadder with gradeLevel="6"; update auto-attach to filter by gradeLevel + Summer Mode
- [x] "Ready for 6th Grade" indicator: ReadyFor6thBadge component on Today page — shows per-subject mastery bars + banner when all 4 subjects ≥ 75%; self-hides when summer mode is off
- [ ] Optional: "5th Grade Report Card" page — summary of all completed 5th grade topics with completion dates, for IH records
- [x] Summer Mode: review blocks pull from topics with mastery < 80 (reviewBlockGenerator.ts uses topicMastery table, SM-2 intervals)

### Analytics Page
- [x] Add approx level + pctMastered under each arc in CurriculumProgressArcs (skillLadder.summary query)
- [x] Apps usage card (top 10 apps by launch count, last 30 days) — appLaunches table + launchStats procedure + AppsUsageCard component in Analytics
- [x] Behavior & Learning Insights section: BehaviorInsightsCard — mood arc (7-day), anxiety/mood-stability bars, focus% bar (blockCompletionStats), struggle trends by subject, learning profile (strengths/accommodations/preferences from knowledge), weekly focus recommendations; Voice Mood deferred (no voice-signal data source yet)

### Curriculum Hub Visual
- [x] Change font + color + box treatment: chalk-green header bar, subject-tinted left border on topic rows, better padding/spacing

### Agenda Editor
- [x] Drag-and-drop reorder already implemented (native HTML5 drag, ☰ grip handle, blockReorderM.mutate); added keyboard a11y (↑↓ arrow keys on grip handle)
- [x] blockType, subject, topic already inline-editable Select dropdowns that save on change; added "review" to BLOCK_TYPES list
- [ ] AI agenda chat: file/image upload (assignment, worksheet) and "create custom worksheet" op

### Google Calendar Sync
- [x] ICS feed: /api/calendar.ics exports all blocks + timeline events; Mom subscribes in Google Calendar (auto-refreshes every few hours)
- [ ] True one-way API write sync: when blocks are committed, create/update timed Google Calendar events via Calendar API (BLOCKED: requires Google Calendar OAuth credentials or service account — not yet configured)
- [x] Today + Schedule pages embed a read-only Google Calendar widget (iframe embed of Mom's calendar)
- [ ] When a tutor is on the day, their email is added as a guest on that day's events (requires Google Calendar API OAuth — deferred until credentials available)

### Apps & Integrations Page
- [ ] Per-app card supports BOTH Student (reaganhiggs910@gmail.com) and Parent (spear.cpt@gmail.com) Google sign-in buttons; default = Student

### Block Resource Generators
- [ ] Video link + description + QR (printable + tap-to-play)
- [ ] Adventure: numbered steps + materials list + outdoor option
- [ ] Practice: primary problems + backup pool (for re-roll without burning the day)
- [ ] Per-type generator wired into PDF builder + Reagan-side block view

### Summer / Catch-up
- [x] Catch-up engine: CatchupEngineCard on Analytics page — per-subject mastery % bar, traffic-light (green/amber/red), next-3 topics (not yet mastered, ordered by sortOrder); catchupEngine tRPC procedure
- [x] Weekly summer digest email (Sunday evenings) — same as weekly digest above; build a Sunday-only scheduled job that sends the full week summary + mastery snapshot + catch-up recommendations

### SMS Approvals (deferred)
- [ ] `pendingApprovals` table (id, kind, payload, requestedBy, requestedAt, smsTo[], status, approvedBy, approvedAt, expiresAt)
- [ ] Pending tab in adult area (2 sub-tabs: AI auto-approved last 24h, Needs your review)

---

## 🟢 Low Priority / Nice to Have

- [ ] Kiwi: "fly across" animation on tap
- [ ] Drive: 12 reference Markdown docs uploaded to canonical Drive subfolders
- [ ] Drive: full two-way sync for ALL canonical subfolders — scheduled poll every 10 min + immediate push on every dashboard write

---

## ✅ Shipped — 2026-05-27

- [x] reagan-ai-agenda-editor SKILL.md — complete
- [x] reagan-print-packet SKILL.md — complete
- [x] reagan-flashcard-maker SKILL.md — complete
- [x] reagan-review-system SKILL.md — complete
- [x] CK-12 Practice Hub page (/practice) — Grade 5 subject browser with direct concept deep-links
- [x] Flashcard Maker page (/flashcards) — AI deck generation, study mode, print-to-PDF UI
- [x] Review & Quiz page (/review-quiz) — AI quiz generation, weak topic tracker, mastery scoring
- [x] 5 new DB tables: flashcardDecks, flashcardCards, reviewSessions, reviewQuestions, weakTopics
- [x] Kiwi 12 activity poses: reading, cooking, dancing, yoga, painting, guitar, writing, TV, eating, exercise, hammock, stargazing
- [x] Kiwi random idle cycling every 15-30s with activity speech bubbles
- [x] Visual polish CSS: .adult-card 3D lift, .block-card-compact spacing, .stat-pill
- [x] 6th grade summer prep reference file: references/sixth-grade-summer-prep.md
- [x] Nightly email confirmed live (GMAIL credentials verified, fires daily 7 PM EDT)
- [x] Scheduled task playbook updated to v2 (JWT auth + tRPC routes)
- [x] todo.md rewritten — removed 3,900 lines of stale changelog, kept only active/pending items

## ✅ Shipped — Before 2026-05-27

- [x] PowerSchool fully removed (router, DB helpers, parser, UI, env refs)
- [x] Google Calendar sync (Family=purple, Reagan=green)
- [x] Unified AI Agenda Editor (two-column, chat + live schedule, no preview/confirm)
- [x] NotebookPad full-screen writing component
- [x] Print-and-go PDF packet (cover sheet + devotion + per-block resource pages)
- [x] CozyShell nameplate redesigned
- [x] Google Sheet automations audit + credentials vault
- [x] Mom + Grandma always-edit power (no login required for agenda edits)
- [x] Nightly agenda email system (PDF attachment, worksheet attachments)
- [x] Drive Hub mirror job (Job B in scheduled task)
- [x] IH/PowerSchool legacy code fully removed
- [x] reagan-dashboard-automations SKILL.md
- [x] reagan-homeschool-grading SKILL.md
- [x] reagan-dashboard-ops SKILL.md
- [x] Kiwi voice neural TTS + wake-word listening
- [x] Kiwi Coins reward system
- [x] Block resource panels (Camera/Upload tabs)
- [x] Summer Mode toggle
- [x] Tutor roster + per-tutor schedule
- [x] 12-hour AM/PM time in Agenda Editor
- [x] Schedule page legend with calendar colors

## Active Bugs — 2026-05-29 (round 2)

- [~] Replaced Make webhook for nightly agenda email (PARTIAL). Original todo asked for direct Gmail SMTP (`nodemailer + GMAIL_APP_PASSWORD + GMAIL_SMTP_USER`). Delivered: Resend HTTPS API in `server/_core/mailer.ts` (per-recipient retry on free-tier validation_error, `MAIL_DEV_TO` redirect, `MAIL_ALLOWED_RECIPIENTS` allow-list, 9 vitest scenarios). Gap vs original goal: `marcy.spear@gmail.com` is still blocked by Resend's free-tier until a domain is verified at resend.com/domains — only `spear.cpt@gmail.com` actually lands today. Two follow-up options remain: (a) verify a custom sending domain at Resend, or (b) wire the original `nodemailer + GMAIL_APP_PASSWORD` SMTP path as a parallel fallback.
- [x] BUG: Quiz Generator fails with same drizzle/TiDB insertId shape bug — `createReviewSession` + `addReviewQuestion` now use defensive read-back pattern (sessionId 30002, 5 questions verified E2E).
- [x] Drive routing audit: 6 active insert sites in `server/db.ts`, `_lib/dayLogBuilder.ts`, `_lib/driveReadme.ts` all checked against the `drivePushQueue.target_folder` MySQL enum. Found + fixed the only mismatch: `adultQuickEntryPayload.ts` used `"day_logs"` (plural) where the enum requires `"day_log"` (singular). Test updated.
- [x] Drive dedupe job (queue-side, FULL): `enqueueDrivePush` now dedupes via (a) `(fileKey, targetFolder)` compound match — `outcome: "dup_pending" | "dup_pushed"`; (b) `(contentHash, targetFolder)` byte-hash match for the same-bytes-different-key case — `outcome: "dup_hash"`. Schema migrated to add `content_hash` VARCHAR(64) + `dedupe_outcome` enum columns (drizzle 0071_remarkable_spencer_smythe.sql). Outcome persisted on every new row. Covered by 6 vitest scenarios. Remaining: post-push Drive-side folder dedupe (compare folder children + content hashes, trash empty dupes) — still open below as the scheduled-drainer item.
- [x] Print Daily PDF (round 2): emoji wrapped in `cleanForPdf` on every `.text()` call site; AI blocks without curriculum codes now go through `synthesizeLessonForBlock` for objectives + practice + book refs; `pg pages X-Y` double-prefix bug fixed in synthesizer. Monday PDF: 9 pages with all 4 AI blocks fully fleshed.
- [x] Wix is not operable — CLOSED 2026-05-30 by user direction: "don't use wix anymore for anything." No Wix integration to build. Scribbles-by-Marcy site work moves to a different platform (TBD by user); the Reagan Homeschool Dashboard itself is not on Wix and is unaffected. The dashboard's published domains today are reagandash-mm3swgic.manus.space and reaganschool.manus.space.

## Active Bugs — 2026-05-29 round 1 (RESOLVED in checkpoint v68135eea, PENDING PUBLISH)

- [x] BUG: Flashcard Maker AI Generate failed because `db.createFlashcardDeck` returned `id: undefined` on TiDB (drizzle MySQL `insertId` shape). Fix in `server/db.ts`: read back the inserted deck row by `(title, createdAt)` to confirm the id; same defensive read-back in `addFlashcardCard`. New tests: locked in via `server/agendaPdf.printDaily.test.ts` companion (flashcard tests already in `flashcardDb.test.ts`).
- [x] BUG: Print Daily PDF rendered emoji as garbled WinAnsi glyphs (🧩 → Ø>Ýé) AND only generated a cover page (no per-block writable space). Fix in `server/_lib/agendaPdf.ts`: `cleanForPdf()` strips supplementary-plane code points + dingbats and transliterates smart punctuation; every block now renders a detail page with description + 10 full-width writing lines. Notes lines are now real horizontal rules (was: truncated underscore text). Verified visually on Monday June 1 plan — went from 1 page/3KB → 5 pages/7.6KB.
- [x] BUG: plans.aiGenerate failed on prod with `__dirname is not defined` (ESM) — fixed in `server/_lib/knowledgeBundle.ts` and `server/_lib/q4StandardsSeeder.ts` (both now derive `__dirname` from `fileURLToPath(import.meta.url)`).
- [x] FEATURE: Today homepage ◀ Prev day / Next day ▶ arrows over the daily assignment blocks. Center label is a snap-back-to-today button. When viewing a non-today day, the page re-queries via `plans.byDate({ date })` and shows a small read-only hint. No route changes.


## New 2026-05-29 follow-ups (carved out of partial completions above)

- [ ] **contentHash on drivePushQueue:** add a `content_hash` VARCHAR(64) column to the queue (SHA-256 of the file bytes), populated by the enqueueing helper. Without it, queue-side dedupe can only match the S3 fileKey \u2014 it can't catch two enqueues of the same payload under different keys.
- [ ] **Hash-based skip vs Drive folder:** during drive-push drain, before re-uploading a file, list the canonical-target folder's children and skip the upload if any child's content hash already matches. Record the outcome on the queue row (`status: 'skipped'`, `errorMessage: 'dedup hit on <driveFileId>'`).
- [ ] **Nightly Drive-side folder dedupe:** scheduled job that lists each canonical parent's children, groups by normalized name + content hash, picks a survivor (oldest createdTime), moves children of dupes into the survivor, then trashes the empty dupes. Should never touch the 9 pinned top-level folders.
- [ ] **Verify a custom domain at Resend** (resend.com/domains) so `marcy.spear@gmail.com` can actually receive the nightly agenda email, then drop `MAIL_ALLOWED_RECIPIENTS` to a no-op. Until that's done, only `spear.cpt@gmail.com` will land.
- [x] SMTP parallel fallback shipped 2026-05-30 (see EMAIL row above).


## Active Bugs — 2026-05-30

- [x] BUG: PDF link in nightly agenda email returns "AccessDenied" — FIXED 2026-05-30. Removed the signed-URL "Download today's agenda PDF" button from `scheduledSync.ts` and the owner notification. PDF is still attached as a MIME part on every send. Footer text now reads "📎 The full agenda PDF is attached to this email — no link needed." Contract test rewritten (5 tests assert no clickable link + attachment intact).
- [x] BUG: Marcy didn't receive the nightly agenda email — FIXED 2026-05-30. Added Gmail SMTP fallback in `server/_core/mailer.ts` that picks up any address Resend's allow-list filter drops. Marcy now lands via SMTP (using GMAIL_SMTP_USER + GMAIL_APP_PASSWORD already in env), spear.cpt@gmail.com still goes via Resend. 12 mailer tests pass (4 new for SMTP path).
- [x] BUG: Route `/calendars` returns 404 — FIXED 2026-05-30. Added redirect route `/calendars` → `/settings` in App.tsx (CalendarSyncCard lives in Settings) and updated Schedule.tsx link text to point directly at `/settings` so it never even hits the redirect.
- [x] BUG: Homepage agenda block opener — FIXED 2026-05-30. Surfaced `dailyPrintables.block_id` on the wire (`TodayPrintableItem.blockId`); added `findBestPrintableForBlock` + `findAllPrintablesForBlock` helpers (block-pinned matches first, subject-only fallback); rewrote `Today.tsx` so every per-block opener (Open button, thumbnail strip, "printable ready" pill, library fallback) routes through them. 9 vitest scenarios in `server/matchPrintable.blockPinned.test.ts`.


## Active Bugs — 2026-05-30 (priority bundle)

- [x] BUG: Homepage agenda block opener was opening a generic subject-matching worksheet instead of the worksheet pinned to the tapped block. Fixed by surfacing `dailyPrintables.block_id` on the wire (`TodayPrintableItem.blockId`), introducing `findBestPrintableForBlock` + `findAllPrintablesForBlock` matchers (block-pinned first, subject-only fallback), and rewriting `Today.tsx` so every per-block opener (the Open button, thumbnail strip, "printable ready" pill, library fallback) routes through them. Locked by 9 vitest scenarios in `server/matchPrintable.blockPinned.test.ts`.
- [x] BUG: Email "Download today's agenda PDF" button opened to an S3 `AccessDenied` XML page because the presigned URL had expired. Per user direction "fi not want url just auto on pdf", removed the link entirely from `scheduledSync.ts`; PDF is still attached as a MIME part. Footer text now reads "📎 The full agenda PDF is attached to this email — no link needed." Contract test rewritten (5 tests assert no clickable link + attachment intact).
- [x] BUG: `/calendars` route returned 404. Fixed both ways: (a) redirect route `/calendars` → `/settings` registered in App.tsx (CalendarSyncCard lives there), (b) `Schedule.tsx` link text updated to point directly at `/settings` so it never hits the redirect.
- [x] FEATURE: Surface the day's planned blocks as a calendar layer on Schedule — SHIPPED 2026-05-30. New `AgendaCalendarStrip` component renders a 7AM–6PM vertical timeline with subject-tinted block bars (timed blocks placed exactly, untimed flow sequentially from 9 AM, "now" line for today, tap-to-edit deep-link to the AgendaEditor). Embedded in Day view above the existing block list. New `blocks.weekRange` tRPC procedure (capped at 31 days) feeds Week view (subject-tinted block chips per day, count of blocks planned) and Month view (subject-color dots per day). External calendar export already covered by `/api/calendar.ics` which includes the next 14 days of agenda blocks with start/end times. 13 new vitest scenarios (6 weekRange + 7 layoutBlocks).
- [x] EMAIL: Gmail-SMTP fallback shipped 2026-05-30. SMTP fallback runs after Resend whenever the allow-list dropped recipients OR Resend's per-address retry rejected them. Resend domain verification still TBD by user; once verified, drop MAIL_ALLOWED_RECIPIENTS and the fallback becomes a no-op.
