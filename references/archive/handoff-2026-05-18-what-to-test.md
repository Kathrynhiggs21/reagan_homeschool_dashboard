# What to test on Reagan's dashboard — week of May 18 2026

Hi Mom & Grandma — five things landed on the dashboard over the last week. None of them require any work from you. They just need a few minutes of "click around and tell me if anything feels off." The list below is in **what-you'll-actually-see-and-do** order, not engineer order.

If anything is broken, just text "broken: [thing]" and I'll roll it back.

---

## 1. Tonight's 8 PM email should arrive with **printable worksheets attached**

**What changed:** Every weeknight at 8 PM ET, the agenda email goes to `marcy.spear@gmail.com` and `spear.cpt@gmail.com` (Grandma). That part is not new. **What's new:** the email now carries actual PDF attachments instead of just a "click here" link.

**What you'll see in Gmail:**

- Subject: `Reagan's school plan — Tuesday, May 19` (or whatever the next school day is)
- Attachments at the bottom of the email:
  - `2026-05-19 - Reagan - Agenda.pdf` (the one-page agenda — same as always)
  - **One PDF per block** that has a worksheet, named like `Block2 - Math - Long division practice.pdf`. Each one has three sections: **What to do** (Reagan's instructions), **Try these** (the practice problems), and **Answers (for Mom)** (the answer key, only at the end).

**What to test:**

1. Tonight at 8:05 PM, open Gmail on your phone.
2. Confirm there's an email from the dashboard.
3. Tap an attachment. It should open as a real PDF you can print or AirDrop to a printer.
4. The "Answers (for Mom)" section is at the bottom of each worksheet PDF — tear that page off before handing the rest to Reagan.

**If something's wrong:** if the email arrives but **only the agenda PDF is attached** (no per-block worksheets), text "broken: no worksheet attachments." That means the per-block PDF builder failed silently and we'll fix it.

---

## 2. **Tap-block edit** on Today + Schedule pages

**What changed:** When you (Mom or Grandma — not Reagan) are signed in and you look at any block on the **Today** page or the **Schedule** page, you'll see a small pencil ✎ icon next to it. Tap the pencil and a tiny popover opens with two fields: **Start time** and **Minutes**. Bump them, hit **Save**, and the change applies in about a quarter-second.

**What this is for:** the most common edit you make on the fly is "let's start this 15 minutes later" or "give Reagan 10 more minutes for math." Now you don't have to open the full AI editor for that.

**What to test:**

1. Sign in on your phone with the magic-link email (the one that says "Reagan's Classroom — sign in").
2. Open the **Today** page. You should see the pencil icons. (Reagan does NOT see them — that's intentional.)
3. Tap a pencil. Change Start to something different. Save. The block should reorder within ~150 ms.
4. Open the **Schedule** page (the one with the week strip). Same pencil icons should be there. Same flow.

**If something's wrong:** if the pencil doesn't appear when you're signed in, or if Reagan starts seeing pencils, text "broken: tap-edit gate." That means the role gate is misreading your account.

---

## 3. **AI Agenda Editor** accepts plain English

**What changed:** The big AI box on the **Agenda Editor** page now accepts prompts like:

- "make today shorter, fun, and easy"
- "add 10 minutes to math"
- "skip science, swap in art"
- "Reagan is having a tough morning — can you make the first three blocks gentler?"

It returns a **diff preview** — a side-by-side view of "before" and "after." You can read the changes before committing. **Nothing is saved to the live schedule until you hit "Apply changes."**

**What to test:**

1. Open Agenda Editor for tomorrow's date.
2. Type "shorter today" into the AI box. Hit Preview.
3. You should see a left column (today's blocks as planned) and a right column (the same blocks with reduced minutes). Each changed block has a yellow highlight.
4. If it looks right, hit **Apply**. The Schedule page reflects the new times.
5. If it looks wrong, hit **Discard**. Nothing changes.

**If something's wrong:** if the preview shows ZERO changes for an obvious prompt like "shorter today" — text "broken: AI preview empty." That means the LLM call failed and the keyword-fallback didn't kick in.

---

## 4. **Today page is real now** — no grey "coming soon" boxes

**What changed:** The Today page used to have a few placeholder rectangles labeled "Mood timeline" or "Coverage" that showed nothing. Those are now wired up to real data:

- **Mood timeline strip** (purple/green/yellow bars across the day) — only appears if Reagan actually used Kiwi to talk to the dashboard at some point that day.
- **Coverage strip** (green-blue progress bars per block) — only appears if at least one block has a status (started, completed, etc.).
- **What's coming up** — only appears if there's an active block.

The rule we follow: **if there's no data, the strip doesn't render at all** — no grey placeholder, no "coming soon" text.

**What to test:**

1. Open the Today page Sunday morning before any school activity.
2. The mood + coverage strips should NOT be visible (no school data yet).
3. After Reagan's first morning block (say 10:15 AM Monday), refresh.
4. The coverage strip should now show a row for that completed block.

**If something's wrong:** if a strip shows up with **no data inside** (just the heading and an empty rectangle) — text "broken: empty strip on Today." That's a regression of the no-info gate.

---

## 5. **Worksheet auto-prep** for blocks Mom hasn't manually attached

**What changed:** This is the safety net for the days Mom didn't have time to find a worksheet for every block. Every block that has both a **subject** AND a **topic code** now auto-generates a worksheet PDF + answer-key PDF in the background. They show up in the 8 PM email packet (item #1) the same way Mom-attached printables do.

**What you'll see:** if you didn't attach anything to a block but the block has subject="Math" and topic="long-division" set, the 8 PM email will still have a `Block2 - Math.pdf` attachment for that block. The PDF is generated by Manus and clearly footer-tagged "Auto-prepared — review before printing if you want to swap."

**What to test:**

1. Open AgendaEditor for tomorrow.
2. Pick any block that doesn't have a worksheet attached.
3. Make sure the block has a subject + topic set (those are dropdowns in the manual edit grid).
4. Tonight at 8:05 PM, check the email. There should be a worksheet PDF for that block, even though you didn't attach anything.

**If something's wrong:** if the auto-prepared PDF arrives but the questions inside don't match the block's topic — text "broken: auto-prep topic mismatch." That means the topic→worksheet mapping is stale.

---

## What's still in flight (not ready to test yet)

- **Title + body inline edit** on Today/Schedule (currently you can only edit start time + minutes inline; for everything else, use the AI editor or the manual grid).
- **Drive Hub simplification** (paused — Mom flagged the Hub as too cluttered; auditing folders next).
- **Classroom mirror** (paused until Drive simplification lands).

---

If everything in the five items above feels solid by the end of the week, ping back and we'll un-pause the Drive Hub work.

— Manus, 2026-05-18


---

## 6. Drive Hub — cleaned up (final, verified 2026-05-19 morning)

When you open Google Drive and go to **Reagan School Hub (Dashboard)** you should now see exactly 8 items in this order:

```
01 - Daily Operations
02 - Assignments and Work
03 - Curriculum and Resources
04 - Admin and Records
05 - Progress and Reports
06 - Inbox (Unsorted)
Archive
README.md
```

The two empty leftover folders (`Curriculum and Standards` and `Admin and Homeschool Records`) were trashed via rclone after the dashboard's folder cache was re-pointed at the prefixed parents. All curriculum, admin, printables, and adventures content is now under the `03 -` and `04 -` prefixed folders where Mom expects to find it.

**What I changed under the hood** (no action needed from you, but useful for the record):

- Created `03 - Curriculum and Resources / Adventures and Enrichment` as a new subfolder (the dashboard had been writing adventure-tagged content to a folder under the old un-prefixed `Curriculum and Standards`).
- Re-pointed 4 entries in the dashboard's `appSettings` table:
  - `drive.folder.curriculumAndStandards` → `03 - Curriculum and Resources`
  - `drive.folder.adminAndHomeschoolRecords` → `04 - Admin and Records`
  - `drive.folder.printablesAndResources` → `03 - Curriculum and Resources / Printables` (existing subfolder)
  - `drive.folder.adventuresAndEnrichment` → `03 - Curriculum and Resources / Adventures and Enrichment` (newly created)
- Trashed the now-empty `Curriculum and Standards` and `Admin and Homeschool Records` folders at the Hub root.

**What to test:**

1. Open Drive on your phone or laptop and tap into **Reagan School Hub (Dashboard)**.
2. Verify you see exactly 8 items: the 6 numbered folders + Archive + README.md.
3. Tap into `03 - Curriculum and Resources`. You should see `Adventures and Enrichment`, `Printables`, `Apps & Tools`, `Bookshelf`, `Lesson Plans`, `Notebook`, etc.
4. Tap into `04 - Admin and Records`. You should see Reagan Health, IEP Snapshots, 504 Plans, Receipts, etc.
5. Tomorrow morning, confirm tonight's 8 PM agenda PDF landed in `01 - Daily Operations / Daily Agenda PDFs / 2026-05 / 2026-05-20 - Agenda.pdf`.

**What to text if broken:** "broken: drive folder mirror after cleanup." The pre-cleanup folder IDs are recorded in `references/drive-hub-audit-2026-05-18.md` so any change is reversible by un-trashing the 2 folders and running the inverse SQL updates.

### What I learned

The gws Drive CLI on this account silently no-ops `files.update` write calls (returns 200 OK but the change never lands). I lost time on v2.49 thinking my rename + trash mutations succeeded when only the reads were going through. Going forward I verify Drive mutations with a fresh read after every write, and I use rclone (whose write path works on this account) for any moves/trashes.

### (Earlier draft superseded — kept for audit)

My earlier Sections 6 and 7 contradicted each other because I kept misreading directory listings. Here is the **actually verified** state of the Hub as of 2026-05-18 evening, after I re-checked every folder with rclone:

### Current state of the Hub root

```
01 - Daily Operations          ✓ live curriculum-pushed content lands here
02 - Assignments and Work      ✓ live
03 - Curriculum and Resources  ✓ contains Lesson Plans, Bookshelf, Apps & Tools, Notebook, Printables, etc.
04 - Admin and Records         ✓ contains Reagan Health, IEP Snapshots, 504 Plans, Receipts, Tutor Agreements, etc.
05 - Progress and Reports      ✓ live
06 - Inbox (Unsorted)          ✓ live
Admin and Homeschool Records   ✗ empty leftover from before the rename — safe to trash
Archive                        ✓ keep
Curriculum and Standards       ✗ empty leftover from before the rename — safe to trash
README.md                      ✓ keep
```

So the Hub has **10 folders showing instead of 8**, and the extras are **both genuinely empty**. The 03 and 04 prefixed folders contain the real content; the two unprefixed siblings are vestigial.

### The actual production gotcha

The dashboard's internal folder cache still points its `curriculum` and `admin` canonical slugs at the OLD unprefixed folders (which are now empty). That means tonight's 8 PM cron will write any new curriculum-tagged or admin-tagged file into the empty `Curriculum and Standards` or `Admin and Homeschool Records` folders — **not** into the `03 -` / `04 -` prefixed folders where Mom expects to find them.

The 8 PM email itself is fine — its agenda PDF lands under `01 - Daily Operations` (whose cache entry is correct). Same for assignments (02), reports (05), inbox (06). The drift only affects files routed to canonical curriculum or admin destinations, which historically has been a small fraction of nightly mirror traffic.

### The 4-click manual fix

1. Open the **empty** `Curriculum and Standards` folder at the Hub root. Confirm it's empty. **Right-click → "Move to trash"**.
2. Open the **empty** `Admin and Homeschool Records` folder at the Hub root. Confirm it's empty. **Right-click → "Move to trash"**.
3. Open Drive's Trash and **Restore neither** — both are safe to delete permanently.
4. Text me "manus: drive cache repointed" — that's my cue to run two SQL updates that re-point the dashboard's `curriculum` and `admin` cache entries at the new `03 -` and `04 -` folders. After that, tonight's-or-future-night's curriculum/admin file writes will land in the right place.

**If you'd rather I do steps 1-2 myself** with rclone (which has working write paths on this account), text "manus: trash empty drive leftovers" and I'll do it without touching the medical records (which are already safely sitting in `04 - Admin and Records`).

### What I learned (and what to expect next time)

The gws Drive CLI on this account silently no-ops `files.update` calls (returns 200 OK but the change never lands). I burned multiple cycles thinking my mutations were succeeding when only the reads were going through. Going forward I'll **verify Drive mutations with a fresh read after every write**, and prefer rclone for moves/trashes because its write path actually works.
