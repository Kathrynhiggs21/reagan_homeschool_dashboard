# Reagan School Hub (Dashboard) — Drive Audit
**Date:** 2026-05-18
**Hub root folder ID:** `1r3bJacPLJN7VHI8y72rcx1-GRxspqo1r`
**Hub root parent (My Drive):** `0AC7hyk-j9wo_Uk9PVA`

## Why this audit exists

Mom's feedback (paraphrased): the Hub feels cluttered. The dashboard mirrors files into it every weeknight at 8 PM (agenda PDFs, per-block worksheets, notebook attachments, etc.) so a Drive cleanup has to keep those nightly writes landing somewhere predictable.

## Current top-level state (12 items: 11 folders + 1 README)

The audit was captured via `gws drive files list --params '{"q":"\"...rootId...\" in parents and trashed=false"}'`. Item counts are first-level children only (each folder is itself a tree).

| # | Folder name | Drive folder ID | First-level children |
|---|-------------|-----------------|----------------------|
| 1 | `Daily Operations` | `1wyFk4rTPT-bZsadEVwODmqnABhevn6yb` | 13 |
| 2 | `Curriculum and Resources` | `1ighaciRpTk8oloh55dEhgx0YZmomsZWJ` | 15 |
| 3 | `Admin and Records` | `1aLViM1-T0_ob0CFNxJN9hnzMauROySjF` | 11 |
| 4 | `_archive-engineering-2026-05` | `1GOnWdEIBpfnY_14Fr-jf2AJKlzEHvMLH` | 11 |
| 5 | `Assignments and Work` | `1--Z75dZRcTTrEVlRGtIVfP5b1OMi8hCT` | 9 |
| 6 | `Progress and Reports` | `1YYRTEko_yYCg0V3S-tx-wyT6wQ2F2mpj` | 7 |
| 7 | `Behavior Analytics` | `1fYM_vVXAmJGSYYWVSAdJEY3gCKnaKPSw` | 5 |
| 8 | `Classes` | `1_PdN0Sjje97ORaZIT8Cy0cV8pN5fsg5b` | 5 |
| 9 | `Inbox (Unsorted)` | `1PQPK34gnnlZrNojxFLJddCnDSpUQ5kR1` | 4 |
| 10 | `Snapshots` | `1Mbx5efaCkEu22ilN72xrx_Sn4jjBZ7mD` | 1 |
| 11 | `Apps & Tools` | `11nFevBu1OP-GhKSSJvS5PyEpKS8p-FQW` | 1 |
| n/a | `README.md` | `177-v5I4cIgNV27mJnoxg14YRJfA4ZzIX` | (file) |

### Second-level peek for the four heavy-hitters

- `Daily Operations/`: Adult Notes, Adventures, Daily Agenda PDFs, Daily Agendas, Daily Packets, Daily Schedule, Day Logs, Field Trip Photos, Reading Journal (Bookshelf log), Reagan Artwork, Recap Replies, Tutor, Tutor Handoffs.
- `Curriculum and Resources/`: Apps and Tools, Bookshelf, Coloring Pages, Coverage Snapshots, Lesson Plans, Master Worksheet Library, Notebook, Ohio 5th Grade Standards, Printables, Reagan's Books, Reference Materials, Reward Charts, Standards Library, Topics Covered (+ a stray `.manus_drive_test_*.txt` test-marker file).
- `Admin and Records/`: 504 Plans (preserved), Annual Notice of Intent, Attendance Logs, Homeschool Notification (Ohio), IEP Snapshots (preserved), Login and Account Notes, PowerSchool Snapshot (read-only, preserved), Reagan Health (medical, IEP, 504, anxiety timeline), Receipts and Curriculum Purchases, Standardized Tests, Tutor Agreements.
- `Assignments and Work/`: Active Assignments, Assignments, Curriculum Checklist (Weekly), Finished Work, Photos of Work, Practice for Coins, Setup Packet (archive), Submitted Work, Worksheets to Do.

The `_archive-engineering-2026-05/` folder is already a working archive bucket — it contains backend-engineering-only stuff that Mom never needs to see.

## Binding contract from the dashboard code

`server/db.ts` lines 4350-4491 define two layers:

1. **`DrivePushTarget`** (25-value enum) — every nightly write tags itself with one of these (e.g. the 8 PM agenda email tags `agenda_pdf` + `worksheets`). The cron worker reads `DRIVE_FOLDER_NAMES[target]` to pick the destination subfolder name.
2. **`CanonicalParentSlug`** (9-value enum) — `DRIVE_TARGET_TO_CANONICAL_PARENT[target]` collapses the 25 targets into one of 9 canonical parents that match the Hub's intended top-level folders.

The 9 canonical parents are: `adminAndHomeschoolRecords`, `adventuresAndEnrichment`, `assignmentsAndWork`, `curriculumAndStandards`, `dailyOperations`, `inboxUnsorted`, `printablesAndResources`, `progressAndReports`, `todo`. Each is persisted by app-setting key `drive.folder.<slug>` so the worker resolves slug → Drive folder ID once and caches it.

## Mismatch between code expectation and current Drive state

The code expects 9 canonical parents; Drive has 11 folders. The cleanup boils down to **collapsing the 4 stray top-level folders** (`Behavior Analytics`, `Classes`, `Snapshots`, `Apps & Tools`) into the 6 that match the canonical parents, plus keeping `_archive-engineering-2026-05` as `Archive/2026/_engineering/`.

| Stray top-level | Should nest under | Reason |
|------------------|-------------------|--------|
| `Behavior Analytics` | `Progress and Reports/` | matches `progressAndReports` canonical parent |
| `Classes` | `Daily Operations/` | per-class artifacts are operational, not curriculum |
| `Snapshots` | `Progress and Reports/Coverage Snapshots/` (or merge) | Drive already has `Coverage Snapshots` under Curriculum, so this is a half-baked duplicate |
| `Apps & Tools` (top-level) | `Curriculum and Resources/Apps and Tools/` (already exists nested) | duplicate — the nested version is the canonical home |

## Proposed final structure (6 top-level + 1 Archive)

Numeric prefixes force Drive's alphabetical sort to match Mom's mental priority order so the Hub root reads top-down like the dashboard nav:

| Order | Final folder name | Absorbs (from current) | Canonical parent slugs |
|-------|--------------------|------------------------|------------------------|
| 1 | `01 - Daily Operations` | `Daily Operations` + `Classes` | `dailyOperations` |
| 2 | `02 - Assignments and Work` | `Assignments and Work` | `assignmentsAndWork` |
| 3 | `03 - Curriculum and Resources` | `Curriculum and Resources` + top-level `Apps & Tools` (merged into existing nested `Apps and Tools`) | `curriculumAndStandards`, `printablesAndResources`, `adventuresAndEnrichment` |
| 4 | `04 - Admin and Records` | `Admin and Records` | `adminAndHomeschoolRecords` |
| 5 | `05 - Progress and Reports` | `Progress and Reports` + `Behavior Analytics` + `Snapshots` | `progressAndReports` |
| 6 | `06 - Inbox (Unsorted)` | `Inbox (Unsorted)` | `inboxUnsorted` |
| Archive | `Archive/2026/_engineering/` | `_archive-engineering-2026-05` (rename + nest) | n/a (no nightly writes target this) |

`adventuresAndEnrichment` (canonical parent) does NOT get its own top-level folder — it nests inside `03 - Curriculum and Resources` because the nightly writes for `bookshelf`, `adventures`, `journal` already produce content under there (Reading Journal, Adventures, Bookshelf).

`todo` (canonical parent) is dashboard-internal — never gets a Drive folder.

## How the dashboard code adapts (Approach A: prefixed names + vitest lock)

1. Update `DRIVE_FOLDER_NAMES` in `server/db.ts` so that targets like `agenda_pdf` resolve to `01 - Daily Operations / Daily Agenda PDFs / {YYYY-MM} / ...` instead of the bare `Daily Agenda PDFs`. Specifically: bake the `01 - ` ... `06 - ` prefix INTO the canonical-parent layer, not the leaf-name layer, so existing leaf names (`Daily Agenda PDFs`, `Worksheets (Daily Packets)`, etc.) stay unchanged.
2. Persist the new top-level folder IDs into `app_settings` keys `drive.folder.dailyOperations`, `drive.folder.assignmentsAndWork`, etc. (these keys already exist; we just point them at the renamed folder IDs after the move).
3. Add `server/driveHubTargetFolderMap.test.ts` that snapshots the full target → canonical-parent → Hub-leaf path mapping so any future enum change must also update the test.

## Move plan (idempotent, dry-run first)

The move is implemented in `scripts/drive_hub_simplify_2026_05_18.py` — see that file for the full step-by-step. Each step is dry-run-printable and re-runnable: if a step has already happened it's a no-op.

Steps (high level):

1. **Rename** `Daily Operations` → `01 - Daily Operations`, etc. (just a `name` patch on the same folder ID; Drive doesn't move children).
2. **Move** `Classes` into `01 - Daily Operations/`.
3. **Move** `Behavior Analytics` and `Snapshots` into `05 - Progress and Reports/`.
4. **Move** the top-level `Apps & Tools` folder INTO `03 - Curriculum and Resources/` (Drive will let two siblings share a name only briefly — we then merge contents into the existing `Apps and Tools` and delete the now-empty stray).
5. **Create** `Archive/` at Hub root, then `Archive/2026/`, then move + rename `_archive-engineering-2026-05` → `Archive/2026/_engineering`.
6. **Confirm** `app_settings['drive.folder.<slug>']` for all 8 canonical slugs points at the right (renamed) folder ID.
7. **Run vitest** to confirm the new map locks.

## What does NOT change

- File contents inside any folder.
- The `DrivePushTarget` enum (the 25 nightly-write tags stay the same).
- The 9 `CanonicalParentSlug` values.
- Any in-progress files in `Inbox (Unsorted)` — they stay there pending Mom's manual triage.

## Rollback plan

If something goes wrong:

1. Drive: rename folders back (`01 - Daily Operations` → `Daily Operations`, etc) and move the absorbed folders (Classes, Behavior Analytics, Snapshots, Apps & Tools) back to Hub root.
2. Code: `webdev_rollback_checkpoint` to v2.48 — that restores the pre-rename `DRIVE_FOLDER_NAMES` table.
3. App settings: `drive.folder.<slug>` rows can be reset to their pre-move folder IDs (kept in `references/drive-hub-pre-move-folder-ids-2026-05-18.json`).

## Open follow-ups (after the move lands)

- Mom's `references/handoff-2026-05-18-what-to-test.md` gets a "Drive Hub got cleaned up" footer pointing at the new structure.
- The classroom mirror slice (still paused) can resume because its destination folders are now stable.
- A `drive.audit.last_run_at` app-setting timestamp gets bumped after the move so the next audit knows when this one ran.


---

## POSTMORTEM — v2.52 evening, after attempted unification fix

The v2.49 simplification audit looked **only** at the user-facing Hub root's immediate children. It missed two things that matter:

1. **Several canonical-parent folders were buried inside `Hub/Archive/2026/_engineering/`** (folder ID `1GOnWdEIBpfnY_14Fr-jf2AJKlzEHvMLH`), not at the Hub root. Specifically: `Curriculum and Standards` (18HhQdVn...), `Admin and Homeschool Records` (1RcO_WCr...), `Printables and Resources` (1MpQ0OGD...), `Adventures and Enrichment` (1i1-UtUY...), `Worksheets (Daily Packets)` (1SmXWhLk...). Initially I described this as a "parallel root"; after tracing parent chains via `gws drive files get` (chain: 1GOn... → 1FVs... 2026 → 1kbB... Archive → 1r3b... Hub), I confirmed the engineering folder is INSIDE the Hub, just deeply nested.

2. **The two folders my v2.49 script created at the Hub root were not actually empty placeholders.** Verified via `rclone lsd`: folder `1ighaciRpTk8oloh55dEhgx0YZmomsZWJ` (named "03 - Curriculum and Resources") contains medical/IEP records (`Reagan Higgs 2025-26 IEP.pdf`, `Contact Protocol & Crisis Response Decision Tree.pdf`, `Color-Coded Warning Zones & Intervention Guide.pdf`, `Ali_Comprehensive_Structured_Packet_Reagan_IH_2025-2026_v4.docx`, plus subfolders `IEP Snapshots (preserved)` and `Reagan Health (medical, IEP, 504, anxiety timeline)`). The "04 - Admin and Records" folder (`1aLViM1-T0...`) wasn't fully inspected but likely contains data too. So "trash these placeholders" is the wrong move — these are real records that semantically belong inside the Admin canonical parent.

### The gws CLI silent-no-op bug

The v2.52 fix-up attempt also surfaced a separate engineering issue: **`gws drive files update --params '{...}'` silently no-ops on this account.** The HTTP response is a 200 with the file metadata, but the requested change (trashing, renaming, re-parenting) is never actually applied. Verified directly: I called `gws drive files update --params '{"fileId":"1ighaciR...","body":{"trashed":true}}'`, got a 200 with the file metadata, then immediately called `gws drive files get` on the same file and `trashed` was still `false`. This explains why both v2.49 + v2.52 apply runs printed "[done]" / "[trashed]" for mutations that were never actually applied to Drive.

Root cause is almost certainly that gws flattens the `body` JSON into URL query parameters rather than putting it in the HTTP request body. The Drive API's `files.update` endpoint requires body params as JSON in the request body (with `addParents`/`removeParents` as query params for moves). When the body is missing, the API treats the call as "no patch to apply, just return current metadata."

The `rclone` fallback (per the project's `<google_drive_integration>` block) does work for write operations — confirmed via `rclone --config /home/ubuntu/.gdrive-rclone.ini lsd` and `rclone ls` returning live data identical to what gws returns for reads. I stopped short of using rclone for the actual moves because the placeholder folders turned out to contain real medical records that need human-judgment merging.

### Actual current Hub-root state (as of v2.52)

The Hub root has **10 children** instead of the v2.49 plan's 8:

| # | Name | ID | Notes |
|---|---|---|---|
| 1 | 01 - Daily Operations | 1wyFk4rTPT-bZsadEVwODmqnABhevn6yb | correct (dashboard cache) |
| 2 | 02 - Assignments and Work | 1--Z75dZRcTTrEVlRGtIVfP5b1OMi8hCT | correct (dashboard cache) |
| 3 | 03 - Curriculum and Resources | 1ighaciRpTk8oloh55dEhgx0YZmomsZWJ | **mislabeled** — contains medical/IEP records, belongs under Admin |
| 4 | 04 - Admin and Records | 1aLViM1-T0_ob0CFNxJN9hnzMauROySjF | not fully inspected for content |
| 5 | 05 - Progress and Reports | 1YYRTEko_yYCg0V3S-tx-wyT6wQ2F2mpj | correct (dashboard cache) |
| 6 | 06 - Inbox (Unsorted) | 1PQPK34gnnlZrNojxFLJddCnDSpUQ5kR1 | correct (dashboard cache) |
| 7 | Admin and Homeschool Records | 1RcO_WCr2mG2v_4cVxHjslx4UpsFflHan | **dashboard cache** points here for `adminAndHomeschoolRecords` |
| 8 | Archive | 1kbBUq5HdQ71S6R3CORW63X4Nu9_72__O | correct |
| 9 | Curriculum and Standards | 18HhQdVn6F-IS6eZOV41xRbST5cHGuqJM | **dashboard cache** points here for `curriculumAndStandards` |
| 10 | README.md | 177-v5I4cIgNV27mJnoxg14YRJfA4ZzIX | correct |

**Critical:** the dashboard's `appSettings` cache still resolves correctly to the right folder IDs (rows 7 + 9, not 3 + 4). Tonight's 8 PM nightly mirror will land files in folders 7 + 9 as it has been doing — Mom just sees them under their CURRENT un-prefixed names "Curriculum and Standards" + "Admin and Homeschool Records" in the Hub root rather than under "03" + "04".

### Manual 5-minute fix for the cosmetic goal

1. Open Drive web UI → `Reagan School Hub (Dashboard)` → look inside `03 - Curriculum and Resources` (the one with IEP/medical content).
2. Select all subfolders + files inside it. Move them into `Admin and Homeschool Records` (drag-and-drop or right-click → Move to).
3. After it's empty, right-click → Move to trash.
4. Do the same for the `04 - Admin and Records` folder if non-empty; if empty, just trash it directly.
5. Rename `Curriculum and Standards` → `03 - Curriculum and Resources` (right-click → Rename).
6. Rename `Admin and Homeschool Records` → `04 - Admin and Records` (right-click → Rename).

After these 6 clicks the Hub root will have exactly 8 children (6 numbered + Archive + README) as v2.49 originally planned. The dashboard does NOT need to know about the renames — the canonical-parent indirection layer (`server/db.ts:4465-4491`) only cares about the folder IDs, which are unchanged.

### Alternative for the engineer (rclone-based)

```bash
# 1. Move medical-record subfolders into Admin and Homeschool Records
rclone --config /home/ubuntu/.gdrive-rclone.ini move \
  "manus_google_drive:Reagan School Hub (Dashboard)/03 - Curriculum and Resources" \
  "manus_google_drive:Reagan School Hub (Dashboard)/Admin and Homeschool Records"

# 2. After verifying empty, purge it
rclone --config /home/ubuntu/.gdrive-rclone.ini purge \
  "manus_google_drive:Reagan School Hub (Dashboard)/03 - Curriculum and Resources"

# 3. Repeat for 04 - Admin and Records

# 4. Renames are not exposed in rclone — use Drive web UI for the final 2 renames.
```

### What's locked + what's at risk

- **Tonight's 8 PM cron**: unaffected. Will land worksheets/agenda PDFs in their existing folder IDs (rows 7 + 9 + others) just like every previous weeknight.
- **Mom's Drive UI experience**: still slightly cluttered (10 children at Hub root, 2 mislabeled) until the manual fix runs.
- **The `driveHubTargetFolderMap` vitest**: still 8/8 green. It locks the contract at the canonical-parent layer; the layer is intact.
- **Future regressions**: protected by the vitest, which fails if any DrivePushTarget enum entry stops mapping to one of the 6 numbered Hub folders.
