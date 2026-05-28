"""
Rewrite todo.md per agreed buckets.

Preservation rule: KEEP every item that references HISTORICAL data already in DB
(IEP rows, PowerSchool grade snapshot, IH curriculum codes seeded, Madeira IEP origin).
DELETE only forward-looking *new actions* that require login to defunct orgs.
"""
import re, sys, shutil, os
from pathlib import Path

SRC = Path("/home/ubuntu/reagan_homeschool_dashboard/todo.md")
DST = Path("/home/ubuntu/reagan_homeschool_dashboard/todo.md")
BACKUP = Path("/home/ubuntu/reagan_homeschool_dashboard/todo.md.bak-2026-05-12")

lines = SRC.read_text().splitlines()
shutil.copy(SRC, BACKUP)

def is_item(l):
    return re.match(r"^\s*-\s*\[[ x]\]\s", l) is not None
def is_checked(l):
    return re.match(r"^\s*-\s*\[x\]\s", l) is not None
def is_header(l):
    return l.startswith("## ") or l.startswith("# ")
def item_text(l):
    m = re.match(r"^\s*-\s*\[[ x]\]\s*(.*)$", l)
    return m.group(1) if m else ""
def norm(t):
    t = re.sub(r"[^\w]+"," ", t.lower()).strip()
    t = re.sub(r"\s+"," ", t)
    return t

# -------- BUCKET 1: forward-looking IH/PowerSchool/Madeira/FinalForms ACTIONS to delete --------
# Only delete UNCHECKED items that are new actions requiring login to dead orgs.
# Keep [x] items (history) and keep items that reference DATA already imported.
B1_KILL_UNCHECKED = [
    r"reagan\.higgs33@ihsd\.us",
    r"@ihsd\.us",
    r"\bihsd\.us\b",
    r"powerschool",
    r"finalforms",
    r"\bwells\b.*(pdf|curriculum|4th[- ]quarter)",
    r"froehlich",
    r"indian hill curriculum slide",
    r"daily 6 ?am IH sweep",
    r"madeira.*ingest",
    r"madeira.*sweep",
    r"indianhill\.k12\.oh\.us",
    r"madeiracityschools\.org",
    r"google classroom.*ihsd",
    r"classroom.*pull.*ihsd",
    r"ih classroom",
    r"app[- ]tile auto[- ]launch.*authuser",
    r"google oauth for reagan\.higgs33",
    r"gmail forwarding.*ihsd",
    r"pull ih curriculum context",
    r"sync from gmail.*froehlich",
    r"sync from google drive.*ih curriculum folder",
    r"ih powerschool portal",
    r"powerschool.*indian hill",
    r"madeira.*ihes",
    r"\bihes\b.*classroom",
    r"finalforms ih",
    r"@ihsd",
    r"ih q[1-4]",
    r"do what you can.*gmail.*classroom.*powerschool",
    r"google sign[- ]in prompt on phone.*ih",
    r"daily 7am pull.*ih",
    r"round 4c",
    r"ih school calendar",
]

# Bucket 6: an entire header section is dead (Round 4c — do what you can — blocked-by-login)
DEAD_SECTIONS = [
    "## Round 4c — \"do what you can\" (Gmail/Classroom/PowerSchool/FinalForms blocked by scope/login)",
    "## Round 4c",
    "## IH School Calendar Awareness",
]

# -------- BUCKET 2: gating language that contradicts Mom+Grandma always-edit --------
# Replace with corrected wording, or strike if obsolete.
B2_REPLACEMENTS = {
    r"^- \[ \] Mastery gate, not minute gate.*$":
        "- [ ] Mastery NUDGE (not a gate): Kiwi suggests Reagan keep going when she shows she gets it; Mom + Grandma always override",
    r"^- \[ \] Server-side role guard on EVERY schedule mutation.*$":
        "- [x] Server-side gate replaced by `familyAdminProcedure` (Mom + Grandma always pass; tutors gated by tutor role; Reagan never edits live) — May 11 2026",
    r"^- \*\*Grandma\*\* = Marcy — `marcy\.spear@gmail\.com` — read-only viewer$":
        "- **Grandma** = Marcy — `marcy.spear@gmail.com` — full editor (always edit, no exceptions)",
    r"^- \[ \] Grandma Marcy role = `editor` \(not viewer\).*$":
        "- [x] Grandma Marcy role = full editor via `familyAdminProcedure` (May 11 2026)",
    r"^- \[ \] Settings: keep gated \(admin/tutor\) — destructive whole-day clears.*$":
        "- [ ] Settings: gated for tutor/student/viewer; Mom + Grandma always pass; destructive whole-day clears, large coin redemptions (>20), tutor/credential add, year-plan editing, student email, mastery true/false",
}

# -------- BUCKET 3: things you don't want, keep ONE canonical line each --------
KIWI_RULE = "- [x] Kiwi: wake-word OR click ONLY; never auto-open; never request mic permission; animations + perch + fly-around preserved (consolidated May 11 2026)"

# -------- BUCKET 7: deferred items (3+ weeks old, not on a slice) → Backlog --------
# We'll classify after main pass: an UNCHECKED item that lives in a pre-2026-05-03 section moves to Backlog.

# -------- BUCKET 8: TOP PROMOTION block (House Rules + emphasized latter-day items) --------
TOP = """# Reagan's Homeschool Dashboard — TODO

> Last consolidated: 2026-05-12. See `todo.md.bak-2026-05-12` for full pre-purge history.

## 🏠 House Rules (standing — apply to every slice)
- Mom (`spear.cpt@gmail.com`) and Grandma Marcy (`marcy.spear@gmail.com`) can edit ANY day's agenda — past, today, future, any year — NO EXCEPTIONS, NO approval gating.
- Kiwi: wake-word OR click ONLY; never auto-open; never request mic permission. Animations (perch, fly-around, occasional pop-in) stay.
- NO TIMERS visible to Reagan (trauma-safe).
- NO GREY BOXES anywhere.
- "Don't show if no info" — empty rails hide, they don't display placeholder text.
- Adult analytics must be 100% real — no seeded/demo/fake events, uploads, moods, grades.
- All assignments fully operable + printable. Videos = link + description + QR. Reading = page numbers in books Reagan owns.
- Reagan REQUESTS, never edits live. Adults approve/edit.
- nothing reads/writes `reagan.higgs33@ihsd.us` (in `blockedEmails`).
- All future creations auto-add to Reagan's Google Drive.

## ⭐ Active Priorities (latter-day emphasized)
### Mom + Grandma always-edit power (DONE 2026-05-11)
- [x] `familyAdminProcedure` added — Mom + Grandma always pass any agenda-edit gate (past, today, future, any year)
- [x] No approval workflow can block them on agenda edits
- [x] Swapped onto familyAdmin: blocks.{create, createForDate, clearDay, update, complete, move, reorder, delete, shiftDay} + plans.{create, update, aiGenerate, aiCommit} + agendaEditor.{preview, commit}
- [x] Vitests: 11 new family-admin gate tests + 5 existing routers tests updated to Mom-ctx — all 523 / 1 skipped pass

### Slice 4 — Fully operable + printable B-β-blocks (IN PROGRESS)
- [ ] Worksheet body + answer key (PDF with both)
- [ ] Video link + description + QR (printable + tap-to-play)
- [ ] Reading: page numbers in Reagan's owned books (Tuck Everlasting, Michael's World, Spectrum Science Grade 5, 180 Days of Language Grade 5) + per-page comprehension prompts
- [ ] Adventure: numbered steps + materials list + outdoor option
- [ ] Practice: primary problems + backup pool (for re-roll without burning the day)
- [ ] Per-type generator wired into PDF builder + Reagan-side block view
- [ ] Vitest coverage per generator

### Slice 5 — Summer mode + catch-up + weekly digest
- [ ] Auto-flip Jun 6 → Aug 15 (toggleable in Settings)
- [ ] Catch-up engine: per-subject mastery % + traffic-light + next-3 topics
- [ ] Weekly summer digest email (Sunday evenings)
- [ ] Vacation-aware date-range "off" toggle
- [ ] Summer-friendly variant of each block type (outdoor/library/game/hands-on)

### Slice 6 — Reagan-side surfaces
- [ ] Reagan marks her own block complete (no adult sign-off for completion; adults still grade)
- [ ] Reagan can drag-reorder her own day (start + end times locked)
- [ ] Reagan-side 3-option chooser for tomorrow's "summer choice" block
- [ ] Streak boost + bigger surprise rewards for summer streaks

### Slice 3.5 — SMS approvals + tutor roster (in progress; Mom+Grandma never queued)
- [x] approvalDecider lib + per-rule decision matrix + 9-branch vitest
- [x] approvalsRouter (publicProcedure for incoming SMS callback, familyAdmin for review)
- [ ] phoneRecipients table (encrypted), seed Mom 513-926-5808 + Grandma 513-646-9281
- [ ] pendingApprovals table (id, kind, payload, requestedBy, requestedAt, smsTo[], status, approvedBy, approvedAt, expiresAt)
- [ ] SMS escalation via notifications connector (signed-token approval link, 30-min expiry, first-approve-wins)
- [ ] Pending tab in adult area (2 sub-tabs: AI auto-approved last 24h, Needs your review)
- [ ] tutorRosterOverride table — seed override for week of 2026-05-11 → 2026-05-17: tutors=[Keith], helpers=[Mom, Grandma]
- [ ] Day-builder + calendar sync + SMS approval all consult tutorRosterOverride
- [ ] Hard rule: Mom + Grandma actions NEVER enter the approval queue. Tutors / AI / Reagan still queue.

### Calendar — Reagan's Homeschool (May 10)
- [x] Calendar ID `o81tqeb4425ej2k9il7lhmooh4@group.calendar.google.com` (owned by `spear.cpt@gmail.com`) identified as canonical
- [ ] Settings → Accounts & Emails panel surfaces calendar ID + owner email
- [ ] One-way sync: each auto-built daily block written as a timed event
- [ ] Today + Schedule pages embed a read-only Google Calendar widget
- [ ] When a tutor is on the day, their email is added as a guest on that day's events
- [ ] Vitest: setting persists, sync produces N events per day = block count, ihsd.us guard rejects

### Tutors + per-app identity
- [ ] Tutors table rows for Madison, Sophie, Keith with weekly slot pattern
- [ ] Tutor permissions = Editor tier (edit schedule, add/remove assignments, mark done, upload photos, leave notes — no billing/secrets/users)
- [ ] Per-app card supports BOTH Student (reaganhiggs910@gmail.com) and Parent (spear.cpt@gmail.com) Google sign-in buttons; default = Student
- [ ] Assigned-day automatic block ownership (Tuesday's blocks = Sophie's tutor handoff)
- [ ] Tutor email addresses for Madison / Sophie / Keith

### IH/PowerSchool legacy code cleanup (one consolidated pass)
- [ ] Replace `student.googleEmail` default `reagan.higgs33@ihsd.us` → `reaganhiggs910@gmail.com` (server/db.ts)
- [ ] Replace `classroom.studentDomain` `ihsd.us` → `gmail.com` (server/db.ts)
- [ ] Remove `/@ihsd\\.us$/i` allowlist regex (server/db.ts)
- [ ] Strip @ihsd.us copy from Schedule.tsx, Settings.tsx, UploadOrSync.tsx, googleAuthLink.ts, DrivePushQueueCard.tsx
- [ ] Strip "PowerSchool — Indian Hill" from seed.mjs (preserve already-imported PowerSchool grade rows + ihAssignments display path as read-only history)
- [ ] DB: `UPDATE app_settings SET value='reaganhiggs910@gmail.com' WHERE key='student.googleEmail'`
- [ ] DB: `UPDATE app_settings SET value='spear.cpt@gmail.com' WHERE key='parent.googleEmail'`
- [ ] DB: `UPDATE app_settings SET value='marcy.spear@gmail.com' WHERE key='grandma.googleEmail'`
- [ ] Preserved: IEP goals + accommodations (Madeira origin label retained), PowerSchool grade snapshot, IH Q1–Q4 curriculum codes already seeded — all stay queryable + visible on analytics

### URGENT scrub (Apr 28) — still pending
- [ ] Identify every seed script that wrote demo/sample/placeholder rows into moods, events, uploads, submissions, grades, summaries, parentFlags, struggles, gradesByDay
- [ ] One-shot SQL cleanup that deletes ONLY seeded/demo rows (preserve any rows actually entered by parent / Reagan / tutor)
- [ ] Disable any future runs of those demo seeders
- [ ] Hard-dedupe bookshelf (drop "Test Book 1777379912525")

---

"""

# -------- Pass 1: read every line, decide keep/transform/move/drop --------

# First, locate every header so we can decide section-level deletion or move.
section_ranges = []
cur_start = 0
cur_title = None
for i, l in enumerate(lines):
    if is_header(l):
        if cur_title is not None:
            section_ranges.append((cur_start, i, cur_title))
        cur_start = i
        cur_title = l.strip()
section_ranges.append((cur_start, len(lines), cur_title or ""))

# Sections to fully drop:
def is_dead_section(title):
    t = title.lower()
    for d in [
        "round 4c",
        "ih school calendar awareness",
    ]:
        if d in t:
            return True
    return False

# Sections to defer to Backlog (older than May 1, not in recently-promoted set):
PROMOTED_TITLES = set()  # already in TOP, will be skipped if encountered
RECENT_KEEP = [
    "2026-05-04", "2026-05-05", "2026-05-07", "2026-05-08", "2026-05-10", "2026-05-11",
    "phase 11", "phase 15", "recently shipped",
]
def is_recent(title):
    t = title.lower()
    return any(r in t for r in RECENT_KEEP)

# Already-promoted (we replace these wholesale with the TOP block):
PROMOTED_DROP_HEADERS = [
    "mom + grandma always-edit power",
    "2026-05-10 — summer mode",
    "2026-05-10 — approval/sms",
    "2026-05-10 — rollback + google calendar sync",
]
def is_promoted(title):
    t = title.lower()
    return any(p in t for p in PROMOTED_DROP_HEADERS)

# -------- Pass 2: rewrite per section --------
kept_sections = []   # (title, [lines]) for sections kept in active area
backlog_sections = []  # same shape for backlog area
seen_norms = set()   # for dedupe (only across unchecked items)

for (start, end, title) in section_ranges:
    if title is None:
        continue
    if is_dead_section(title):
        continue
    if is_promoted(title):
        continue
    block = lines[start:end]
    # Filter block lines
    out = []
    for l in block:
        if not is_item(l):
            out.append(l)
            continue
        text = item_text(l)
        ltext = text.lower()

        # Bucket 1 kill (only kill UNCHECKED forward-looking actions on dead orgs;
        # preserve [x] history references).
        if not is_checked(l):
            killed = False
            for pat in B1_KILL_UNCHECKED:
                if re.search(pat, ltext, flags=re.IGNORECASE):
                    killed = True
                    break
            # Extra guard: keep the line if it references HISTORICAL data preservation
            if killed and re.search(r"preserve|historical|already imported|snapshot|origin label|read[- ]only history", ltext):
                killed = False
            if killed:
                continue

        # Bucket 2 replacements
        for pat, rep in B2_REPLACEMENTS.items():
            if re.match(pat, l, flags=re.IGNORECASE):
                l = rep
                text = item_text(l)
                ltext = text.lower()
                break

        # Bucket 3: kiwi auto-open + mic — drop duplicates of the consolidated rule
        if re.search(r"kiwi.*(wake[- ]word|auto[- ]open|mic|fly[- ]around|perch).*", ltext) and not is_checked(l):
            # we'll add KIWI_RULE once at top; drop these to avoid restating
            continue
        if re.search(r"microphone.*notification", ltext) and is_checked(l):
            # keep the L1371 historical bug-fix line as is
            pass

        # Dedupe (collapse exact and near-exact dupes among UNCHECKED items only)
        if not is_checked(l):
            n = norm(text)
            if n and n in seen_norms:
                continue
            seen_norms.add(n)

        out.append(l)

    # If section now has no items, but it had items before, drop it
    had_items = any(is_item(x) for x in block)
    has_items_now = any(is_item(x) for x in out)
    if had_items and not has_items_now:
        continue

    # Send to backlog vs active
    if is_recent(title):
        kept_sections.append((title, out))
    else:
        backlog_sections.append((title, out))

# -------- Compose output --------
parts = [TOP.rstrip() + "\n\n"]

parts.append("## Active (recent / on a slice)\n\n")
for (title, blk) in kept_sections:
    # Skip the first header in TOP collision: don't re-emit the original H1
    if blk and blk[0].startswith("# Reagan's Homeschool Dashboard"):
        blk = blk[1:]
    parts.append("\n".join(blk).rstrip() + "\n\n")

parts.append("---\n\n## 🗂 Backlog / Parking Lot (older asks, kept for reference)\n\n")
for (title, blk) in backlog_sections:
    if blk and blk[0].startswith("# Reagan's Homeschool Dashboard"):
        blk = blk[1:]
    parts.append("\n".join(blk).rstrip() + "\n\n")

new_text = "".join(parts)

# Stats
def count(t):
    return (
        sum(1 for x in t.splitlines() if re.match(r"^\s*-\s*\[x\]", x)),
        sum(1 for x in t.splitlines() if re.match(r"^\s*-\s*\[ \]", x)),
        len(t.splitlines()),
    )
old_x, old_o, old_n = count(SRC.read_text())
new_x, new_o, new_n = count(new_text)
print(f"BEFORE: {old_n} lines | [x]={old_x} [ ]={old_o}")
print(f"AFTER : {new_n} lines | [x]={new_x} [ ]={new_o}")
print(f"DELTA : {new_n-old_n} lines | [x]{new_x-old_x:+d} [ ]{new_o-old_o:+d}")

DST.write_text(new_text)
print(f"wrote {DST}; backup at {BACKUP}")
