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

- [ ] Drive Hub cleanup: audit all folders, trash empties/orphans, fix push routing so every file type lands in the correct canonical folder
- [ ] Ohio curriculum standards reference file → auto-push into Curriculum and Resources folder on schedule
- [ ] Drive sub-folder dedupe job: nightly compare folder names + content hashes; auto-merge dupes by moving children of dupe → canonical and trashing the empty dupe
- [ ] Flashcard print-to-PDF: server procedure needs final test (UI wired in FlashcardMaker.tsx, PDF generation not yet validated end-to-end)
- [ ] Review system: wire reviewSessions/reviewQuestions to real AI quiz generation (currently placeholder LLM call)
- [ ] CK-12: add Grade 6 subject links for summer prep mode
- [ ] Skills: update `reagan-homeschool-grading` SKILL.md to document 6th grade grading expectations

---

## 🟡 Medium Priority — Queued

### Spaced-Repetition Review System
- [ ] Add `topicMastery` table: `(id, curriculumTopicId, gradeLevel, lastReviewedAt, nextReviewAt, masteryScore 0-100, attemptCount, weakSpots text)`
- [ ] Add `reviewAttempts` table: `(id, topicMasteryId, attemptedAt, score, kiwiQuizLog json, notes)`
- [ ] Add `blockType: "review"` to the scheduleBlocks enum
- [ ] `server/_lib/reviewBlockGenerator.ts` — picks N topics most overdue for review, generates 3-5 question quiz via LLM for Kiwi to deliver
- [ ] Inject 1 review block per day automatically (morning warm-up, ~15 min) — skip Fridays if short day
- [ ] AI agenda editor: when Mom says "review fractions" or "she needs more practice on writing", AI can manually queue a review block
- [ ] Kiwi chat: when active block is `review` type, Kiwi enters quiz mode — asks questions one at a time, tracks right/wrong
- [ ] At end of quiz, Kiwi summarizes results and posts to `reviewAttempts`, updates `topicMastery.masteryScore`
- [ ] `aiScheduleProposer.ts`: inject weak-topic context into LLM system prompt so AI naturally suggests review blocks
- [ ] Weekly digest email: include "Mastery Snapshot" section — subject by subject, strong/developing/needs work
- [ ] Curriculum page (adult): show mastery score badge next to each topic — green/yellow/red dot

### 6th Grade Summer Prep
- [ ] Summer Mode: when active, pull 6th grade preview topics for Math + ELA blocks
- [ ] Assignment library: tag 6th grade preview assignments with `gradeLevel: 6` so auto-attach only pulls them in Summer Mode
- [ ] Print packet: cover sheet shows "Summer Preview — 6th Grade" label when Summer Mode is active
- [ ] "Ready for 6th Grade" indicator: shows when all core 5th grade topics reach mastery ≥ 75
- [ ] Optional: "5th Grade Report Card" page — summary of all completed 5th grade topics with completion dates, for IH records
- [ ] Summer Mode: review blocks pull from 5th grade topics with mastery < 80 to fill gaps before 6th grade starts

### Analytics Page
- [ ] Add 5th-grade total / "approx levels" alongside mastery rings
- [ ] Add Apps usage card (per-app launches + minutes) — surface IXL / Khan / Prodigy activity
- [ ] Behavior & Learning Insights section (Day Summary, Voice Mood, focus%, trends, learning style profile, recommendations)

### Curriculum Hub Visual
- [ ] Change font + color + box treatment so it's visually distinct from other adult cards and easier to read

### Agenda Editor
- [ ] Add drag-and-drop reorder to manual block grid (with keyboard a11y fallback)
- [ ] Make blockType, subject, topic all inline-editable dropdowns that save on change
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
