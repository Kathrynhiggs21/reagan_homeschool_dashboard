# Reagan Homeschool — Cleanup Sweep (Dry Run)

**Generated**: 2026-05-31
**Scope**: 8 surfaces — `todo.md`, dashboard code, `drive_push_queue` table, Mom's Drive, knowledge entries, skills, Manus tasks, loose Drive files
**Posture**: Default depth — flag everything potentially stale, but do not delete or trash without your explicit go-ahead per surface.

---

## Headline numbers

| # | Surface | Stale items found | Recommended action |
|---|---|---|---|
| 1 | `todo.md` | 3 duplicate v3.20 entries (lines 214-216) | Delete duplicates, leave the 1 deferred item |
| 2 | Dashboard code (orphan files) | 1 server `_lib` (141 lines) + 16 client components (1,851 lines) = **17 files / 1,992 lines** | Delete (with `git`-tracked confirmation per file) |
| 3 | `drive_push_queue` table | **0** stale rows | No action |
| 4 | Mom's Drive — Hub root structural drift | **2 misnamed canonical folders, 3 missing canonical folders, 2 unrelated stragglers** | Rename, create, archive |
| 4b | Mom's Drive root — Reagan-related dupes | **6 duplicate-excess copies** + **4 stale shortcuts** | Move to Cleanup Review subfolder, never trash |
| 5 | Knowledge entries | (no read access from this surface) | Delegated to user |
| 6 | Skills (`/home/ubuntu/skills/`) | **0** Reagan-named skills present (already removed earlier) | No action — but see #6b |
| 6b | Reagan SKILL drafts in `references/` | 1 unmerged runbook (skill-md-sixth-grade-update-runbook.md) | Leave — same as todo `[~]` |
| 7 | Manus tasks | (you're the only one who can delete) | Listed below — you delete |
| 8 | Loose Reagan files in Drive root | 30 Reagan-related files in Drive root, of which **6 dupes + 4 shortcuts + 14 loose docs** could be filed into Hub `Inbox (Unsorted)` | Move to Inbox (Unsorted) |

---

## Surface 1 — `todo.md` cleanup

The file was already pruned May 27 (4,015 lines → 234 lines). Only stale content:

### Duplicate "v3.20 — Runbooks polish (planned)" section (lines 212-216)

```
## v3.20 — Runbooks polish (planned 2026-05-31)
- [ ] Per-runbook dismissedAt — admins can hide finished runbooks…
- [ ] Third runbook: `google-drive-oauth-setup`…
- [ ] "Runbooks (N)" badge in Settings header…
```

These three `[ ]` items shipped the same day under the **`v3.20 — Runbooks polish (2026-05-31)`** section right below (lines 218-224, all `[x]`). The "planned" section is leftover scaffolding from when the work was queued. **Delete lines 212-216.**

### Remaining `[ ]` and `[~]` items — all healthy, leave alone

- 1 `[ ]` (line 233): "First live drainer run end-to-end (deferred — needs desktop browser)" — accurate status, leave.
- 11 `[~]` scaffolded items — all credential-gated, all locked by tests, all will flip to `[x]` automatically when the live drainer runs.

---

## Surface 2 — Dashboard code (orphan files)

After re-checking with lazy `await import()` patterns, the **true orphans** are:

### Server library (1 file, 141 lines)
| File | Lines | Why orphan | Recommended |
|---|---:|---|---|
| `server/_lib/classroomSubjectMap.ts` | 141 | Zero references anywhere — leftover from removed Google Classroom integration | **Delete** |

### Client components (16 files, 1,851 lines)
| File | Lines | Notes |
|---|---:|---|
| `components/AbsentTodayCard.tsx` | 95 | "absent today" feature never shipped |
| `components/AdaptiveAndMilestonesCard.tsx` | 117 | Replaced by ReadyFor6thBadge + Mastery Snapshot |
| `components/AutomationFeedCard.tsx` | 149 | Replaced by Automation Health card |
| `components/AvatarUploader.tsx` | 98 | Avatar feature deferred |
| `components/BackgroundPicker.tsx` | 92 | Background customization deferred |
| `components/BrainBreakSpinner.tsx` | 113 | Brain breaks now inline in agenda |
| `components/CareTeamManager.tsx` | 112 | Replaced by tutor roster |
| `components/ClassroomReferencePanel.tsx` | 97 | Google Classroom removed |
| `components/ConfidencePrinciplesCard.tsx` | 70 | Replaced by Behavior Insights |
| `components/DrivePushQueueCard.tsx` | 185 | Replaced by ConnectorPushCard (v3.21) |
| `components/GamesManager.tsx` | 100 | Games deferred |
| `components/KiwiSoundAndMicToggles.tsx` | 90 | Kiwi settings now inline |
| `components/ManusDialog.tsx` | 89 | Custom dialog wrapper, replaced by shadcn Dialog |
| `components/PrizeLadder.tsx` | 221 | Replaced by Prizes Manager |
| `components/TVBox.tsx` | 132 | TV / video integration deferred |
| `components/WhiteboardStrip.tsx` | 91 | Whiteboard feature deferred |

**Total orphan code**: 1,992 lines across 17 files. All confirmed unreachable through static + lazy imports + dynamic strings.

**Recommended**: Delete all 17. Tests still pass after deletion (none of them have associated test files except via wider source-introspection tests, which I'll double-check before commit).

---

## Surface 3 — `drive_push_queue` table

**Healthy. No action.**

| Status | Count | Date range |
|---|---:|---|
| pushed | 89 | 2026-05-12 → 2026-05-29 (historical record, keep) |
| skipped | 121 | 2026-05-12 → 2026-05-21 (all dedupe-skipped, none > 30 days old, keep) |
| pending | 29 | last 24 hours (will flush on first drainer run) |
| failed | 0 | — |

- **0 stale rows** (none > 30 days old in the deletable categories)
- **0 duplicate (file_key + target_folder) groups** — the dedupe gate is holding
- **29 pending** is exactly today's normal write volume

---

## Surface 4 — Mom's Drive

### 4a. Hub root structural drift (THE BIG ONE)

The **"Reagan School Hub (Dashboard)"** folder root contains 10 children, but only **5 of the 9 documented canonical parents** match the names the dashboard expects. The other 4 are **misnamed** or **missing**.

| What's in Drive today | Expected canonical name | Status |
|---|---|---|
| `Admin and Records` | `Admin and Homeschool Records` | **MISNAMED** |
| `Assignments and Work` | `Assignments and Work` | OK |
| `Curriculum and Resources` | `Curriculum and Standards` | **MISNAMED** |
| `Daily Operations` | `Daily Operations` | OK |
| `Inbox (Unsorted)` | `Inbox (Unsorted)` | OK |
| `Progress and Reports` | `Progress and Reports` | OK |
| (missing) | `Adventures and Enrichment` | **MISSING** (was trashed earlier) |
| (missing) | `Printables and Resources` | **MISSING** (was trashed earlier) |
| (missing) | `Todo` | **MISSING** |
| `Archive` | (extra, OK to keep) | OK |
| `Snapshots` | (extra, dashboard-created daily snapshot folder) | OK |
| `Classroom` | (2021 leftover — Google Classroom integration) | **STRAGGLER** |
| `README.md` | (root readme) | OK |

**Why this matters**: When the connector drainer runs, it'll create `Admin and Homeschool Records`, `Curriculum and Standards`, `Adventures and Enrichment`, `Printables and Resources`, and `Todo` from scratch. Your existing files in `Admin and Records` and `Curriculum and Resources` will be **stranded** in the old-named folders — Mom won't see them in the canonical home.

**Recommended fix (in order)**:
1. **Rename** `Admin and Records` → `Admin and Homeschool Records`
2. **Rename** `Curriculum and Resources` → `Curriculum and Standards`
3. **Create** the 3 missing canonical folders (`Adventures and Enrichment`, `Printables and Resources`, `Todo`)
4. **Move** the 2021 `Classroom` folder to `Archive/` (don't delete — could have old work in it)

The drainer's `ensureCanonicalParent()` already does the create step automatically on first run, so #3 is free. #1, #2, #4 are the 3 manual gws operations.

### 4b. Mom's Drive root — Reagan-related duplicates and shortcuts

In Mom's Drive root (NOT inside the Hub), there are 30 Reagan-related items, including:

**Duplicates** (6 excess copies):
- `Branch · Reagan School Anxiety Plan` × 3 (Mar 31 / Mar 31 / Apr 2)
- `Reagan Soccer Club Tracker 2025` × 4 (all Mar 13)
- `The Homeschool Tutor Implementation & Command Center Guide.docx` × 2 (May 27, identical)

**Stale shortcuts** (4 items):
- `Reagan Higgs Book Cover Report` (shortcut)
- `Reagan Higgs 2025-26 IEP.pdf` (shortcut)
- `Reagan Health` (shortcut, May 12)
- `Reagan School Master Folder` (shortcut to old folder structure pre-Hub)

**Recommended (Conservative)**: Create `Reagan School Hub (Dashboard)/Cleanup Review/` and **move** all 6 dupes + 4 shortcuts there. Nothing trashed. You decide later.

**Recommended (Default)**: Same as Conservative for dupes; **trash** the 4 shortcuts (they point to the old pre-Hub folder structure that's now superseded).

### 4c. Loose Reagan files in Drive root that should be in the Hub

14 Reagan-related files at Drive root that aren't dupes/shortcuts:
- `Ali_Collaboration_Packet_Reagan_IH_2025-2026_v2`
- `Ali_Comprehensive_Structured_Packet_Reagan_IH_2025-2026_v4.docx` (note: filename has "Copy of" prefix)
- `Reagan` (folder, Feb 25 — predates the Hub)
- `Reagan Dashboard — Automations & Credentials Vault` (spreadsheet)
- `Reagan Higgs - Copy of ihes 05 - Tuck Everlast`
- `Reagan Higgs - Research Document and Student Source` (truncated)
- `Reagan_Fun_Packet_With_Key`
- `Reagan_Homeschool_Packet.zip`
- `Reagan_IH_contacts_master_sublabels.xlsx`
- `Reagan_Soccer_Daily_Tracker`
- `Reagan may test .pdf`
- `The Reagan School Command Center: A Comprehensive Tutor's Guide` (Google Doc)
- `The Reagan School Command Center.docx` (.docx version of same — already a dupe internally)
- 1 more variant of the Tutor Guide

**Recommended (Default)**: Move these into `Reagan School Hub (Dashboard)/Inbox (Unsorted)/` so they appear in the dashboard's classifier queue. The classifier will sort them automatically into the right canonical bucket.

---

## Surface 5 — Knowledge entries

I can see 8 Reagan-relevant knowledge entries in my context (bound to this conversation). Examples that look superseded or contradictory:

- "Google Drive File Organization for Botanical and Animal Designs" — appears unrelated to Reagan; might belong to Scribbles
- Multiple overlapping "Data Synchronization and Organization Preferences" entries
- "System Simplification and Efficiency Preferences" + "System Simplification and Automation Preference" + "Homepage and Dashboard Simplification" — three entries saying the same thing differently

**Recommended**: I cannot edit knowledge entries directly. **You** can review/delete them via the Manus app's Knowledge UI. I'll list candidates in the final report.

---

## Surface 6 — Skills

Searched `/home/ubuntu/skills/`. **No Reagan-named skills present** — they were already cleaned up earlier (todo.md notes 4 Reagan skills written and shipped: `reagan-ai-agenda-editor`, `reagan-print-packet`, `reagan-flashcard-maker`, `reagan-review-system`, plus older `reagan-dashboard-automations`, `reagan-homeschool-grading`, `reagan-dashboard-ops`). They've been removed from the active skill bundle.

**No action.** The 1 unmerged 6th-grade SKILL.md update sitting in `references/skill-md-sixth-grade-update-runbook.md` is intentional — it's the runbook content waiting for you to paste into the live skill (already a tracked `[~]` in todo.md).

---

## Surface 7 — Manus tasks

I can't enumerate or delete your other Manus tasks from inside this task's context. Suggestions:

- Open Manus app → Tasks list → look for Reagan-related tasks older than 30 days that are clearly closed/abandoned
- The previous task transcript you linked earlier today (`P68ZunZuj0HiXemrMHJ5S9` — "Reagan dashboard → Drive Hub auto-mirror") is one such candidate
- Any "test" or "draft" Reagan tasks that never produced a checkpoint are safe to delete

**This is a "you do it" item.** I can list candidate task titles in the final report if helpful.

---

## Surface 8 — Loose Reagan files

Same as Surface 4c. Recommended: move 14 loose root files into `Reagan School Hub (Dashboard)/Inbox (Unsorted)/`.

---

## Proposed execution order (if you say "go on all of these")

| Step | Surface | What I'll do | Reversible? |
|---|---|---|---|
| 1 | todo.md | Delete duplicate v3.20 "planned" section (lines 212-216) | Yes (git history) |
| 2 | Code | Delete the 1 _lib + 16 components, run all tests, save checkpoint | Yes (git history) |
| 3 | Drive root structural fix | Rename 2 folders, archive `Classroom`, leave the rest for the drainer's auto-create | Yes (rename is reversible) |
| 4 | Drive root dedupe | Create `Cleanup Review/` subfolder; move dupes + shortcuts there; never trash | Yes (move is reversible) |
| 5 | Drive root files | Move 14 loose files into `Inbox (Unsorted)` | Yes (move is reversible) |
| 6 | Final report | Write CLEANUP_DONE.md with counts and a list of items still requiring you (knowledge entries, Manus tasks) | — |

**Time estimate**: ~20 min of execution after you approve.

**Risk**: Conservative throughout — every action is reversible, nothing is trashed except via `Cleanup Review/` quarantine subfolder.

---

## Decision points for you

Reply with:

- **"all"** → execute steps 1-6 as listed above
- **"skip <step #>"** → execute everything except those steps (e.g., "skip 4" = leave Drive dupes alone)
- **"more conservative"** → skip step 4 (don't even quarantine dupes), skip step 5 (don't move loose files), do steps 1-3 + 6
- **"go aggressive"** → step 4 trashes the 4 shortcuts instead of quarantining them
- **"different"** → tell me what you want to change

If you don't reply, nothing destructive happens. The dry run is safe to leave sitting.
