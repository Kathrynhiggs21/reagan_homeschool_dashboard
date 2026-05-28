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
- [ ] Drive push routing audit: verify each targetFolder enum value maps to the correct canonical Drive folder ID in driveSyncPaths.ts
- [ ] Drive orphan/dupe cleanup: nightly job to detect empty folders and trash them (not delete)
- [ ] Ohio curriculum standards reference file → auto-push into Curriculum and Resources folder on schedule
- [ ] Drive sub-folder dedupe job: nightly compare folder names + content hashes; auto-merge dupes by moving children of dupe → canonical and trashing the empty dupe
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
- [ ] Kiwi quiz: persist completed quiz results to `reviewAttempts` + update `topicMastery.masteryScore` (currently prompt-based only)
- [ ] `aiScheduleProposer.ts`: inject weak-topic context into LLM system prompt so AI naturally suggests review blocks
- [ ] Weekly digest email: include "Mastery Snapshot" section — subject by subject, strong/developing/needs work
- [x] Curriculum page (adult): mastery dot next to each topic title (green ≥75, amber 40-74, rose <40) — topicMastery.listBySubject + CurriculumTopicsTree dot rendering

### 6th Grade Summer Prep
- [x] Summer Mode: when active, pull 6th grade preview topics for Math + ELA blocks (PracticeHub grade toggle + reviewBlockGenerator uses gradeLevel)
- [x] Assignment library: gradeLevel field already on skillLadder (varchar "3","4","5","6") — Grade 6 skills can be seeded with gradeLevel="6"
- [x] Print packet: cover sheet shows "☀️ Summer Preview — 6th Grade" banner when Summer Mode is active (agendaPdf.ts renderCoverPage + agendaAssembler.ts summer detection)
- [ ] Wire Summer Mode into agenda AI: when summer active, Math + ELA blocks source from 6th-grade preview topics (sixth-grade-summer-prep.md)
- [x] PDF agenda printout: embed image worksheets (PNG/JPG) inline; show prominent "📄 PRINT SEPARATELY" dashed box for PDF/external links
- [x] PDF agenda printout: resolve /manus-storage/ relative paths to absolute signed URLs; absolute http URLs passed through as-is
- [ ] Seed 6th-grade preview assignments in skillLadder with gradeLevel="6"; update auto-attach to filter by gradeLevel + Summer Mode
- [x] "Ready for 6th Grade" indicator: ReadyFor6thBadge component on Today page — shows per-subject mastery bars + banner when all 4 subjects ≥ 75%; self-hides when summer mode is off
- [ ] Optional: "5th Grade Report Card" page — summary of all completed 5th grade topics with completion dates, for IH records
- [x] Summer Mode: review blocks pull from topics with mastery < 80 (reviewBlockGenerator.ts uses topicMastery table, SM-2 intervals)

### Analytics Page
- [x] Add approx level + pctMastered under each arc in CurriculumProgressArcs (skillLadder.summary query)
- [x] Apps usage card (top 10 apps by launch count, last 30 days) — appLaunches table + launchStats procedure + AppsUsageCard component in Analytics
- [ ] Behavior & Learning Insights section (Day Summary, Voice Mood, focus%, trends, learning style profile, recommendations)

### Curriculum Hub Visual
- [x] Change font + color + box treatment: chalk-green header bar, subject-tinted left border on topic rows, better padding/spacing

### Agenda Editor
- [x] Drag-and-drop reorder already implemented (native HTML5 drag, ☰ grip handle, blockReorderM.mutate); added keyboard a11y (↑↓ arrow keys on grip handle)
- [x] blockType, subject, topic already inline-editable Select dropdowns that save on change; added "review" to BLOCK_TYPES list
- [ ] AI agenda chat: file/image upload (assignment, worksheet) and "create custom worksheet" op

### Google Calendar Sync
- [ ] One-way sync: each auto-built daily block written as a timed event
- [ ] Today + Schedule pages embed a read-only Google Calendar widget
- [ ] When a tutor is on the day, their email is added as a guest on that day's events

### Apps & Integrations Page
- [ ] Per-app card supports BOTH Student (reaganhiggs910@gmail.com) and Parent (spear.cpt@gmail.com) Google sign-in buttons; default = Student

### Block Resource Generators
- [ ] Video link + description + QR (printable + tap-to-play)
- [ ] Adventure: numbered steps + materials list + outdoor option
- [ ] Practice: primary problems + backup pool (for re-roll without burning the day)
- [ ] Per-type generator wired into PDF builder + Reagan-side block view

### Summer / Catch-up
- [ ] Catch-up engine: per-subject mastery % + traffic-light + next-3 topics
- [ ] Weekly summer digest email (Sunday evenings)

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
