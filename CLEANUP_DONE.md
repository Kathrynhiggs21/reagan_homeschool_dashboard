# Reagan Homeschool — Cleanup Sweep (After-Action Report)

**Date**: 2026-05-31
**Posture**: Default (executed all 8 surfaces from dry-run)
**Reversible**: All Drive moves are reversible (nothing trashed). Code deletions are reversible via git history / checkpoint rollback.

---

## Headline result

| Surface | What was found | What was done |
|---|---|---|
| 1. todo.md | 3 duplicate v3.20 entries (lines 212-216) | Deleted (5 lines) |
| 2. Dashboard code | 17 orphan files / 1,992 lines | Deleted; TS+LSP clean; 4,398/4,468 tests passing (70 pre-existing failures unchanged) |
| 3. `drive_push_queue` table | 0 stale rows | No action needed |
| 4a. Drive Hub root structure | 2 misnamed canonical folders, 3 missing, 1 straggler | Renamed 2, created 3, archived 1 |
| 4b. Drive root duplicates | 6 dupes + 4 shortcuts at Drive root | Moved 10 items into Hub/`Cleanup Review (2026-05-31)` |
| 4c. Loose Reagan files | 17 docs at Drive root | Moved into Hub/`Inbox (Unsorted)` for dashboard classifier |
| 5. Knowledge entries | Not directly editable from this surface | Listed candidates below for your review |
| 6. Skills | 0 Reagan-named skills present | No action |
| 7. Manus tasks | Listed candidates below | You delete via Manus app |
| 8. Loose Drive files | Same as 4c | Done |

**Net effect on Mom's Drive view**:

- **Before**: 30 Reagan-related items scattered at Drive root, with 6 dupes + 4 shortcuts cluttering the view; Hub root had 2 wrong-named folders and was missing 3 canonical ones.
- **After**: Drive root shows only 3 Reagan-related items (Hub folder, the persistent "Reagan" pre-Hub folder, and the Automations & Credentials Vault). Hub root has all 9 canonical folders correctly named + Archive + Snapshots + Cleanup Review + README.

---

## Detailed actions

### Surface 1 — `todo.md`
- Removed duplicate **"v3.20 — Runbooks polish (planned)"** section (5 lines, 3 unchecked items that were already shipped under the next section). The file is now 229 lines.

### Surface 2 — Dashboard code (17 orphan files / 1,992 lines deleted)

**Server library (1 file)**:
- `server/_lib/classroomSubjectMap.ts` — 141 lines, Google Classroom legacy

**Client components (16 files)**:
| File | Lines | Replaced by |
|---|---:|---|
| `AbsentTodayCard.tsx` | 95 | (feature never shipped) |
| `AdaptiveAndMilestonesCard.tsx` | 117 | ReadyFor6thBadge + Mastery Snapshot |
| `AutomationFeedCard.tsx` | 149 | Automation Health card |
| `AvatarUploader.tsx` | 98 | (deferred) |
| `BackgroundPicker.tsx` | 92 | (deferred) |
| `BrainBreakSpinner.tsx` | 113 | inline in agenda |
| `CareTeamManager.tsx` | 112 | Tutor roster |
| `ClassroomReferencePanel.tsx` | 97 | (Google Classroom removed) |
| `ConfidencePrinciplesCard.tsx` | 70 | Behavior Insights |
| `DrivePushQueueCard.tsx` | 185 | ConnectorPushCard (v3.21) |
| `GamesManager.tsx` | 100 | (deferred) |
| `KiwiSoundAndMicToggles.tsx` | 90 | inline Kiwi settings |
| `ManusDialog.tsx` | 89 | shadcn Dialog |
| `PrizeLadder.tsx` | 221 | Prizes Manager |
| `TVBox.tsx` | 132 | (deferred) |
| `WhiteboardStrip.tsx` | 91 | (deferred) |

**Verification**: TypeScript + LSP clean. 4,398 / 4,468 vitest specs passing — same 70 pre-existing failures as the v3.21 baseline (none introduced by deletions).

### Surface 3 — `drive_push_queue` table
**No action.** Healthy table, zero stale rows, zero dupes.

### Surface 4a — Drive Hub root structure (this was the big find)

**Renamed** (canonical names now match what the drainer expects):
- `Admin and Records` → `Admin and Homeschool Records` (folder `1aLViM1-T0_ob0CFNxJN9hnzMauROySjF`)
- `Curriculum and Resources` → `Curriculum and Standards` (folder `1ighaciRpTk8oloh55dEhgx0YZmomsZWJ`)

**Created** (previously missing):
- `Adventures and Enrichment` → `1XiwfVoZEXDqfe6bheV-oSh-yMnLOqXq-`
- `Printables and Resources` → `1Z_XX5Xqcg8NPkKfZDKYDl8BV-rm59LBg`
- `Todo` → `1tEW2QCGzKngazwsNq0-H--ySlPqRy_Js`

**Archived** (was at Hub root, now under Archive):
- `Classroom` (2021 Google Classroom legacy folder)

**Hub root final state** (13 items, all canonical):
```
Admin and Homeschool Records
Adventures and Enrichment
Archive
Assignments and Work
Cleanup Review (2026-05-31)
Curriculum and Standards
Daily Operations
Inbox (Unsorted)
Printables and Resources
Progress and Reports
README.md
Snapshots
Todo
```

**Important**: When the connector drainer next runs, it will now find the canonical folders by name and **mirror dashboard files into the correct buckets**. Previously it would have created duplicate folders alongside the misnamed ones.

### Surface 4b — Cleanup Review (10 items quarantined)

Created subfolder `Reagan School Hub (Dashboard)/Cleanup Review (2026-05-31)/` and moved:

**Duplicates** (6 excess copies):
- 1 of 2 copies of the Tutor Implementation Guide .docx
- 2 of 3 copies of "Branch · Reagan School Anxiety Plan"
- 3 of 4 copies of "Reagan Soccer Club Tracker 2025"

**Shortcuts** (4 stale shortcuts to pre-Hub folders):
- Reagan Higgs Book Cover Report
- Reagan Higgs 2025-26 IEP.pdf
- Reagan Health
- Reagan School Master Folder

**Nothing was trashed.** You can browse Cleanup Review anytime and either trash items or restore them. The "Master Folder" shortcut may be worth re-pointing if you have any pre-Hub workflows still using it.

### Surface 4c — Inbox (Unsorted) (17 files filed)

Moved 17 loose Reagan documents from Drive root into the Hub's `Inbox (Unsorted)` folder so the dashboard's classifier can sort them next pass. Notable items:

- 3 Tutor Guide versions (Doc + 2 docx)
- 2 Reagan School Command Center versions (Doc + docx)
- Administrator & Tutor Guide for reaganschool.manus.space
- Ali Collaboration / Comprehensive packets (v2 + v4)
- Reagan_Homeschool_Packet.zip
- Reagan_Fun_Packet_With_Key
- 2 IH research/lit-study docs
- Branch · Anxiety Plan (the kept-canonical version) + variant -2
- Reagan_Soccer_Daily_Tracker spreadsheet
- Reagan Soccer Club Tracker 2025 (the kept-canonical copy)
- Reagan_IH_contacts_master_sublabels.xlsx
- Reagan may test .pdf

### Surface 5 — Knowledge entries (your action)

Candidates I noticed during this session that look superseded or contradictory. **Only you can delete these** via the Manus knowledge UI.

| Entry name | Why a candidate |
|---|---|
| "Google Drive File Organization for Botanical and Animal Designs" | Belongs to Scribbles by Marcy, not Reagan |
| "Data Synchronization and Organization Preferences" | Overlaps with "Data and File Synchronization Preference" — same content twice |
| "System Simplification and Efficiency Preferences" + "System Simplification and Automation Preference" + "Homepage and Dashboard Simplification" | Three near-duplicate entries — keep one, delete two |

Suggested keeper for the simplification trio: **"Homepage and Dashboard Simplification"** (most specific scope).

### Surface 6 — Skills

No Reagan-named skills present in `/home/ubuntu/skills/`. The 6th-grade SKILL.md update is still tracked as a `[~]` in todo.md (intentional — that one requires manual paste into the live skill registry).

### Surface 7 — Manus tasks (your action)

Candidates for deletion from your Manus app's Tasks list:

- The "Reagan dashboard → Drive Hub auto-mirror" task you shared earlier (URL: `manus.im/share/P68ZunZuj0HiXemrMHJ5S9`) — this work is fully superseded by v3.21
- Any older Reagan-dashboard tasks predating May 12 that didn't produce a saved checkpoint
- "test" or "draft" Reagan tasks from earlier exploration

**I can't enumerate or delete tasks for you.** Open Manus → Tasks → filter by name "Reagan" and trash anything obviously stale.

### Surface 8 — Loose Drive files

Folded into Surface 4c above (same set).

---

## Items deliberately left as-is

These I left alone on purpose:

- **`Reagan` folder at Drive root** (created Feb 25, ID `16rshT309izimpnv_gEO9BMwaXosO7Nmu`). This predates the Hub. It may contain Reagan's old school work / pre-Hub content. Recommend you peek inside; if it has nothing useful, drag it into Cleanup Review or into Archive. If it has historical worksheets/IEPs/etc., consider merging contents into the relevant Hub sub-folders.

- **`Reagan Dashboard — Automations & Credentials Vault`** spreadsheet at Drive root (ID `1r5DL502zqECKY0GNHEXRbixmeKvl68Io8kIHLupyYks`). Operational document — kept at Drive root for quick access. Don't bury this in the Hub.

- **3 stray `README.md` files inside Inbox (Unsorted)** from prior dashboard pushes. The next drainer pass will dedupe these automatically.

- **The single deferred `[ ]` in todo.md** ("First live drainer run end-to-end") — still legit, still waiting on desktop browser.

---

## What's next

Now that Mom's Drive structure matches the dashboard's canonical names, the next time you run `pnpm drive:drain` from a desktop browser:

1. 29 currently-pending rows will mirror into their **correct** canonical folders (no more orphaning).
2. The drainer will detect the existing `Inbox (Unsorted)` contents and skip dedupe-by-name appropriately.
3. The 5 `[~]` items in todo.md that depend on a successful live drain will flip to `[x]`.

No further code changes needed before that run.
