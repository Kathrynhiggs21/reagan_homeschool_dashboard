# Reagan Dashboard — Session Status

**Date:** 2026-05-27 (early Wednesday morning)
**Live site:** reaganschool.manus.space
**Latest checkpoint:** v2.92.1 (`6d7400a3`) — deployed
**Author:** Manus

---

## What shipped this session

This session focused on three things: **(1) repairing the broken nightly agenda email pipeline**, **(2) writing a comprehensive Helper's Manual + Tutor Quick Guide** for Sophie or any helper, and **(3) auditing the automation layer** so you can see what's healthy and what still needs work.

### 1. Nightly agenda email — pipeline repaired

Since **May 4, 2026**, no nightly agenda email has gone out. The root cause turned out to be subtler than a code bug: there was no heartbeat pointing at the nightly agenda endpoint at all. The only thing nominally calling that endpoint was a legacy AGENT-cron with cookie-based auth that was being rejected with `403` at the Cloudflare edge. The other three heartbeats (`daily-recap-send`, `weekly-digest-send`, `nightly-analytics-csv`) have been firing fine, which is why everything else looked healthy.

Tonight's repair has three layers so this cannot silently fail again the same way:

| Layer | Change | Status |
|---|---|---|
| Heartbeat | Created `nightly-agenda-email` (task_uid `B9YPb9JBVMVW5FqgDZ9wik`), POSTs to `/api/scheduled/nightly-agenda-email` daily at 11:00 UTC (**7 AM EDT**). | First fire scheduled for **this morning at 7 AM EDT** — about four hours from now. |
| Auth | Added dual-auth (cookie **OR** `Authorization: Bearer SCHEDULED_BEARER`) on the scheduled route and its result-callback sibling. The heartbeat uses bearer, bypassing the Cloudflare cookie 403 entirely. | Tested live: no-auth → 401, bearer → 200. |
| Manual override | Added `nightlyAgenda.sendNow` tRPC mutation + a **Send agenda now** card in the Today page's **For Mom & Grandma** drawer. Bypasses cron entirely; runs the same assembler and PDF builder, pushes a Manus owner notification with the PDF link. | Verified end-to-end with Monday 2026-05-25 — agenda built, PDF written, notification sent, DB row marked `sent`. |

If the 7 AM fire is ever missed in the future, **the Send-now button is the unconditional fallback** — it takes one tap.

### 2. Recap reply inbox — Gmail leg bypassed

The "how did the day go?" recap goes out at 8 PM; the adult is supposed to reply by email and the reply gets parsed back into the day log. The send leg works fine — 65 recap emails went out — but the Gmail reply-ingest webhook has never successfully parsed a reply back, so 65 days of recap context is sitting unused in your inbox.

I added an in-app fallback:

- New tRPC: `dailyRecap.listPending` (lists recap requests with no response yet) and `dailyRecap.submitReply` (familyAdmin-only, accepts free text).
- New component: **RecapReplyInboxCard**, mounted in the For Mom & Grandma drawer. Shows pending recap requests, lets the adult type a reply directly, persists it to the database.

You can clear the backlog from the Today drawer when you want to. Going forward, you have a choice of channels — email reply (if it ever starts working) or the in-app box.

### 3. Google Calendar feed UI — front door for an existing backend

The iCal CRUD backend (`icalFeeds` table + `trpc.icalFeeds.add/list/refresh/delete`) was built about three months ago but had no UI front door, so no calendar feeds have ever been added. I built **CalendarFeedsCard** and mounted it in the Today drawer.

To finish the Google Calendar connection for the **"reagan"** calendar on `spear.cpt@gmail.com`:

1. Open Google Calendar → click the three-dot menu next to the "reagan" calendar → **Settings and sharing**.
2. Scroll to **Integrate calendar** → copy the **Secret address in iCal format** (long URL ending in `/basic.ics`).
3. In the dashboard, open Today → **For Mom & Grandma** drawer → **Calendar feeds** card → paste the URL → save.

The dashboard's calendar overlay will then poll the feed on a schedule and pull events in. The Google connector itself does not currently have Calendar scope, which is why the iCal-secret URL approach is the simplest path right now.

### 4. Helper's Manual + Tutor Quick Guide

Two Word documents are in `deliverables/` and synced to Google Drive under **Reagan School Hub (Dashboard) / 04 - Admin and Records / Tutor Agreements /**:

- **`Reagan-Dashboard-Helpers-Manual.docx`** — about thirty sections covering every page, all 43 apps, the automation layer, AI as a collaborator (not a teacher), off-script day handling, paper-and-camera workflow, curriculum tagging, Kiwi Coins, the Drive folder tree, "if it's not working" fallbacks, and an alphabetical index.
- **`Reagan-Dashboard-Tutor-Quick-Guide.docx`** — one-page companion sheet for quick reference.

Both are written to be given to **any** helper — Sophie, a grandparent, a substitute tutor — without further onboarding.

---

## Health of the four heartbeats

| Heartbeat | Schedule | Last run | Status |
|---|---|---|---|
| `nightly-agenda-email` (new) | Daily 11:00 UTC = 7 AM EDT | first fire ~4 hours from now | Healthy, awaiting first fire |
| `daily-recap-send` | Daily 00:00 UTC = 8 PM EDT | 2026-05-27 00:02 UTC | Healthy |
| `weekly-digest-send` | Sunday 22:00 UTC = 6 PM EDT | 2026-05-24 22:00 UTC | Healthy |
| `nightly-analytics-csv` | Daily 00:05 UTC | recent | Healthy |

The legacy AGENT-cron that has been 403'ing every 11 minutes can be left alone — it is superseded by the heartbeat above and does no harm.

---

## What is still broken or unfinished, in priority order

These are documented for the next session. **None of them block the email going out tomorrow.**

**P0 — Worksheet auto-prep is orphaned.** Tomorrow's 12 blocks (Thu 2026-05-28, currently flagged a full-day plan) include 5 academic blocks (Math 10-1/10-2, ELA M4-L1/L2, SS 4-2). The `assignments_library` table has 19 real curated rows (Spectrum Math, NASA, protractor worksheets, planet videos, and more) and `assignmentFinder.ts` knows how to search them plus Perplexity Sonar plus AI-generate as a fallback — but nothing calls it on a schedule. So those blocks may open to a title without a resource attached. The fix is to build a `worksheetAutoPrepExecutor` module, add a `/api/scheduled/worksheet-auto-prep` endpoint with the same dual-auth pattern, and create a heartbeat at 00:00 UTC. Estimated effort is two to three hours of focused work.

**P1 — 12-hour AM/PM clock not enforced.** Some surfaces (agenda PDF, some emails, some UI strings) still show 24-hour times. The fix is to sweep `toLocaleTimeString` calls and add `{ hour: 'numeric', minute: '2-digit', hour12: true }`. Mechanical, roughly an hour.

**P1 — Dead `ihAssignments` table + `ihAssignmentId` column.** Zero rows, always NULL, left over from a retired IH/IXL Hub integration. Drop table, drop column, remove dead code paths.

**P2 — 19 stale wiring tests.** Pre-existing failures, written against older versions of `Today.tsx`. Source-pattern anchors no longer match. Update or remove.

**P2 — Google Drive cleanup.** You explicitly asked for unused, empty, or orphaned folders to be deleted. Need to walk the dashboard root via `gws` CLI and confirm the canonical v5 folder tree (Daily Operations, Curriculum, Resources & Assets, Adventures, Records, Admin + Archive).

**P2 — Full-site sweep.** Audit every page and every AI assistant surface (Kiwi, agenda editor AI, recap AI summary, voice/behavior monitoring, AI lesson generator, AI block suggestions, AI placement) for correctness and freshness.

---

## What I'd like you to do this morning

1. **Watch for the 7 AM agenda email** to `spear.cpt@gmail.com` and `marcy.spear@gmail.com`. If it arrives, the pipeline is fully repaired. If not, open Today → For Mom & Grandma drawer → tap **Send agenda now**, and let me know in the next session.
2. **Paste the iCal URL** for the "reagan" calendar into the new Calendar feeds card using the steps above, if you want those events showing in the dashboard.
3. **Clear the recap backlog** from the new Recap reply inbox card at your leisure — there is no pressure, but each entry gives the analytics layer one more real day of context.

The bigger items (worksheet auto-prep, 12-hour clock, ih cleanup, Drive sweep) are queued and well-scoped. When you're ready for the next session, we can pick any one of them and move it.
