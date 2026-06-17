# Reagan's Homeschool Dashboard — Full Audit Report

**Prepared for:** Katy
**Date:** June 17, 2026
**Live site:** https://reaganschool.manus.space (also reagandash-mm3swgic.manus.space)
**Build state at audit:** checkpoint `0a95fc28` — TypeScript clean (0 errors), 529 test files / 4,784 tests passing (7 intentionally skipped).

---

## How to read this report

Every area below is rated with one of three honest statuses, with the reason stated plainly:

| Status | Meaning |
| --- | --- |
| **Works** | Verified in code and covered by tests; ready for test-out day. |
| **Works, with a note** | Functions correctly today, but there is a known caveat or a behavior you may want to retune. |
| **Needs credentials / manual step** | The code path is built and tested, but it stays dormant until a Google sign-in scope, real tutor data, or a one-time device action is supplied. It is not broken — it is waiting. |

This is deliberately a no-fluff assessment. Where something only half-works, it says so and explains why.

---

## 1. Executive summary

The dashboard is structurally sound and safe to use for tomorrow's platform test-out day. The backend is organized into roughly fifty tRPC router namespaces, all type-checked and test-covered. Five scheduled jobs are live and firing on their real cron timers. The front end is decluttered to the layout you asked for, the Coins economy is rebuilt to spec, the Notebook and Timer live in the floating dock, Settings is plain-English, the sidebar is collapsible, and the theme catalog now offers five distinct looks. The site is installable as a Progressive Web App on iPad, iPhone, Android, and desktop Chrome/Edge.

The honest caveats are narrow and non-blocking: the nightly agenda email fires at 7:00 AM rather than 6:30 AM and technically runs every day (mitigated by weekend-skip logic); several integration paths (Google Classroom assignment import, Drive auto-mirror, IXL/Khan auto-login) depend on Google sign-in scopes or a one-time device login that only you can complete; and a handful of `/api/scheduled/*` endpoints are intentionally on-demand rather than automated. None of these prevent Reagan from using the dashboard tomorrow.

---

## 2. Front end — what Reagan and adults see

### 2.1 Home / Today page — **Works**

The homepage is in the decluttered state you specified. The earlier "have-to-do" three-card strip, the 15-minute skill-builder tile, and the mom-only/no-tutor notice with its lined-notebook strip are all gone; a confirming code sweep of every component rendered on the page found none of them present. The tutor strip now shows only the positive "With Reagan today: [name]" message when a tutor is actually scheduled, and renders nothing on a no-tutor day rather than a negative notice.

The Brain-Break TV block previously showed a grey/black void when its thumbnail failed to load. That violated your "no grey boxes" rule and is fixed: the unstarted state now renders a warm kiwi-teal-to-amber gradient with the clip emoji and play button, and the YouTube thumbnail fades in over it when available. You can see it rendering cleanly in the current preview.

### 2.2 Kiwi intro on load — **Works (intentional, not a rule violation)**

On first load Kiwi shows a one-time onboarding tour ("I run on this dashboard… Skip ahead or stop whenever"). This is the `IntroTour` component, gated by a `kiwiTourSeen` flag stored locally and synced across devices, and it requests no microphone. It is **not** the voice assistant auto-opening to listen, so it complies with your hard rule that Kiwi only activates by wake-word or click and never pops a mic request.

### 2.3 Coins page — **Works**

The Coins page (`/coins`, served by the Kiwi page) was rebuilt to your exact specification:

- A large totals header showing today's coins, this week's coins, all-time earned, and current balance, in a high-contrast, no-grey layout.
- A "coins used so far" row so that balance equals earned minus used.
- A single button — "Email Mom to exchange coins" — that opens a pre-filled message to **spear.cpt@gmail.com only** (not Grandma), with the current balance inserted. There is no in-app reward catalog.
- An expandable ledger table (collapsed by default) listing date, what Reagan did, and the coin change (+earned / −used).
- An adult-only panel to mark N coins redeemed for a free-text reward, which writes a real ledger entry so totals stay honest.

The prize store, the practice-activity browser, and the Kiwi voice sliders were removed as requested. Coins are no longer a flat "1 per task": completion awards are computed by a difficulty-plus-time engine (`computeCoinAward`), so the ledger fills itself as Reagan works.

### 2.4 Notebook and dock tools — **Works**

The Notebook is no longer a sidebar page; it lives in the floating ResourceDock and opens either from the dock button or when Kiwi fires the `kiwi:open-notebook` event. It offers paper types (blank, lined, graph, dotted, handwriting, cream) and converts handwriting to typed text (transcription only — it does not read aloud). Saved notes write into the Drive "journal" notes folder using the same saved-notes mechanism. The visible Timer lives **only** in the dock tray alongside the calculator and word-lookup; it is never inline on kid pages.

### 2.5 Apps & Tools page — **Works (curated to Reagan's real list)**

The launch-tile list is the live, in-use set rather than a generic catalog. There are 28 tiles across eight categories (learning, school, google, video, reading, nature, creativity), including IXL, Khan Academy, Khanmigo, Quizlet, CommonLit, Vocabulary.com, Photomath, Mystery Science, iNaturalist, Merlin Bird ID, Stellarium, Roblox (as a reward/break), Pinterest, and reading apps. The dead Google Classroom tile was removed because the `@ihsd.us` school account is inactive. Note that the parent-facing subscription tracker (Prodigy, BrainPOP, Outschool with prices) is a **separate** table (`appAccountVault`) and is intentionally not mixed into Reagan's launch tiles.

### 2.6 Settings — **Works**

Day-to-day Settings is plain-English. DNS records, sync commands, and raw logs are hidden from the everyday view so the page stays understandable. Nothing was removed — the technical surface is simply not shown.

### 2.7 Themes and sidebar — **Works**

The theme catalog was rebuilt to five distinct themes, each with full CSS (not just a picker entry): Black Chalkboard and White Basic (kept), plus three modern looks — **Bubble Glass** (colorful glassmorphism with soft 3D translucent cards), **Sunshine** (clean flat minimalist with generous white space), and **Galaxy Glow** (deep indigo space with neon aurora accents). There are no tropical themes, per your preference. The left page-list sidebar collapses to a slim icon rail with hover-tooltip labels and expands back to full labels, and the choice is remembered per device.

---

## 3. Back end — routers, jobs, data

### 3.1 Router structure — **Works**

The server exposes about fifty tRPC router namespaces covering calendar, subjects, plans, blocks, the agenda editor, adventures, app links and accounts, books, mood and struggles, skills and the skill ladder, topic mastery, games, feedback, appointments, the school calendar, iCal feeds, student requests, practice, listening, badges, analytics, knowledge, the Kiwi assistant, recaps, the journal, the adult AI tools, grades, and more. All are type-checked and exercised by the test suite.

### 3.2 Scheduled jobs — **Works, with one timing note**

Five jobs are live on the platform scheduler and have all fired on their most recent expected run:

| Job | Cron (UTC) | Eastern equivalent | Purpose |
| --- | --- | --- | --- |
| auto-attach-evening | `0 0 0 * * *` | 8:00 PM EDT | Pre-attaches kid-safe resources to the next school day's blocks. |
| nightly-agenda-email | `0 0 11 * * *` | 7:00 AM EDT | Assembles next-day agenda, builds the PDF, notifies the owner, emails recipients. |
| daily-recap-send | `0 0 0 * * *` | 8:00 PM EDT | Sends a recap-request when the day has no recorded actuals. |
| weekly-digest-send | `0 0 22 * * 0` | Sun 6:00 PM EDT | Weekly progress digest. |
| nightly-analytics-csv | `0 5 0 * * *` | 8:05 PM EDT | Builds the nightly analytics CSV. |

**Note (F1 — agenda email timing):** your stated preference is weekday mornings at 6:30 AM ET, but the live cron fires at 7:00 AM ET every day. The endpoint already skips weekends internally by resolving to the next school day, so a weekend run still produces the next school day's agenda rather than a junk email. The practical effect is correct; only the exact minute (7:00 vs 6:30) and the every-day trigger differ. If you want it exact, the cron can be retuned to `0 30 10 * * 1-5` (6:30 AM EDT, Monday–Friday). This is cosmetic and not blocking for test-out day.

### 3.3 Inactive school account (`@ihsd.us`) — **Works (safely blocked)**

Every reference to the inactive `Reagan.higgs33@ihsd.us` address is a defensive guard, never active usage: it is blocked from the account vault, blocked from kid sign-in placement hints, excluded from the sign-in tagger, and only appears in "blocked attempt" repair copy. This is correct behavior and needs no change.

### 3.4 On-demand scheduled endpoints — **Works as designed**

The `scheduledSync.ts` file defines roughly 27 `/api/scheduled/*` routes, but only the five above run on automatic crons. The rest (upload-sync, drive-push, drive-folder-map, classroom-agendas, IEP refresh, morning-brief, iCal refresh, drive-snapshot, daily-log-rebuild, and similar) are on-demand endpoints that the admin playbook posts to manually, or are credential-gated and dormant until Google scopes are connected. They are not dead code; they are the manual and future-automation surface. They are also correctly cron-gated, so anonymous calls are rejected.

---

## 4. Extended systems — syncing, worksheets, sign-ins, AI, calendar, coins, notebook

### 4.1 Google Calendar sync and de-duplication — **Works**

Events were appearing up to three times on the schedule. The data layer itself is clean (two subscribed feeds — "Family Calendar" and "Reagan's Calendar" — with no duplicate rows). The triple came from the same event arriving from more than one feed plus imported copies whose UIDs had been rewritten (for example `…@openai.local` / `…@chatgpt`). A render-safe de-duplication (`dedupeIcalEvents`) now collapses identical events using a UID-plus-date primary key with a summary-plus-start-time fallback, while still preserving genuinely distinct events that fall on different days. Five test scenarios cover this.

### 4.2 Worksheets and videos — **Works**

Worksheets are surfaced as printables in the day's work, consistent with your rule that worksheets always appear as printables. Where a lesson is a video, the schedule favors a transcript or lesson plan rather than forcing the video, and the Brain-Break TV surface now has a branded (non-grey) placeholder.

### 4.3 Sign-ins (IXL, Khan, others) — **Works for deep-linking; auto-login needs a one-time device step**

The IXL launcher was hardened. The previous `IXL_QUICKSTART_URL` value pointed at a generic IXL landing page that is not a real no-password QuickStart launcher (QuickStart is a teacher/classroom feature that a Family membership does not issue). The app now ignores any non-launcher IXL URL and deep-links straight to the exact grade-5 skill instead. Because there is no true auto-login link, the intended flow is: Reagan signs in **as Reagan** once on the device and lets the browser save the password; every later tap then lands on the right activity already signed in. A one-time on-screen tip now reminds her to sign in as Reagan the first time, so her account and progress are what get used. This matches your "automatic sign-in saved to web passwords" preference within what an IXL Family account actually allows.

### 4.4 Google Classroom / Drive import — **Needs credentials**

The Classroom-agenda and Drive-mirror endpoints exist and are tested, but they stay dormant until the Google sign-in scopes are connected for the active account (`reaganhiggs910@gmail.com` / `spear.cpt@gmail.com`). The inactive `@ihsd.us` account is deliberately blocked. Until those scopes are granted, assignment import and Drive auto-mirror will not pull live data — this is a connection step, not a bug.

### 4.5 AI tools (agenda generator, Kiwi chat, review quizzes, grading) — **Works**

The AI schedule/assignment generator presents selectable next-day options, the agenda editor lets AI adjust assignments and schedules, Kiwi chat answers kid questions, review quizzes and grading run through the LLM helper, and the adult AI tools assist with planning. These use the platform's built-in LLM credentials and require no setup.

### 4.6 Coins economy — **Works** (see §2.3).

### 4.7 Notebook and journal — **Works** (see §2.4); saved notes land in the Drive journal notes folder.

---

## 5. Kiwi capabilities list

Kiwi is the kid-facing companion. Based on the live `kiwi` and `listening` routers and the client components, Kiwi can:

| Capability | What it does | Status |
| --- | --- | --- |
| Voice + text chat | Answers Reagan's questions in kid-safe language; renders markdown replies. | Works |
| Wake-word / click activation only | Opens to listen only on wake-word or tap; never auto-opens; never pops a mic-permission prompt. | Works |
| One-time intro tour | Explains how the whole site works on first visit; dismissed permanently and synced across devices. | Works |
| Open the Notebook | Fires `kiwi:open-notebook` so Reagan can jot or hand-write notes from anywhere. | Works |
| Transcribe audio | Converts spoken input to text via the Whisper helper. | Works |
| Tell jokes / show funny animal videos | Light engagement breaks. | Works |
| End-of-day recap | Summarizes the day and assignments completed. | Works |
| Behavior + mood awareness | Reads the day's listening summaries to reflect mood and focus (kid-safe moods only). | Works |
| Alerts to adults | `checkAlerts` / pending-items flow surfaces things an adult should see. | Works |
| Personality/voice | Driven by `getKiwiPersonality()`; the manual slider panel was intentionally removed, but the voice logic remains. | Works |
| Animations | Occasional flying/popping character motion is retained. | Works |

---

## 6. Analytics list (always-on)

Per your instruction, analytics listening stays **always on** (the wake word is the only optionally-disabled piece), and DNS/technical details are hidden from view. The listening and analytics routers capture and roll up:

| Signal | Where it surfaces |
| --- | --- |
| What Reagan is **working on** (subject hint per audio chunk) | Day sheet, week sheet, time-per-assignment rollups |
| What she is **talking about** | Listening summaries, knowledge/topic tagging |
| **Mood** (kid-safe enum) | Today mood pulse, mood timeline strip, weekly and multi-day mood trends |
| **People talking** (who is present/speaking) | Listening summaries |
| **Time per assignment** | Recorded silently whether or not the visible dock timer is open; feeds block-completion stats and the difficulty-plus-time coin engine |
| **Block completion + coverage** | Analytics wellness/coverage and block-completion stats |
| **Nightly CSV export** | `nightly-analytics-csv` job builds a downloadable daily CSV at ~8:05 PM ET |

The time-on-assignment tracking is decoupled from the visible timer on purpose: even if Reagan never opens the dock timer, her time on each block is still recorded for analytics.

---

## 7. Installable app (PWA) — **Works (on the published URL)**

The site ships a web app manifest, a service worker (network-first for navigation; it never caches API, tRPC, or storage requests), and a full icon set (192, 512, maskable, apple-touch, favicon) using the teal-Kiwi-on-roofline-with-R icon you selected. A dismissible "Add to your home screen" chip appears, with an iOS Safari hint. Installation and full-screen launch work from the **published `.manus.space` URL** (not the dev preview); a native App Store / Play Store build is out of scope for tomorrow.

---

## 8. Bottom line for test-out day

Reagan can open the dashboard tomorrow and use the homepage, schedule, apps, Coins, Notebook, Kiwi, and the AI agenda tools without anything blocking her. The two things worth your attention are optional: (1) decide whether you want the agenda email retuned to exactly 6:30 AM on weekdays, and (2) connect the Google sign-in scopes for the active account if you want live Google Classroom import and Drive auto-mirror rather than the manual/dormant state they are in now. Everything else is verified working and checkpointed.

---

*Prepared by Manus AI. Evidence drawn directly from the project source (`server/routers.ts`, `server/_lib/*`, `client/src/**`), the live scheduler job list, and the project database at checkpoint `0a95fc28`.*
