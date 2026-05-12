"""
V3 semantic purge.

Strategy: line-by-line scan with intent matchers. For each intent cluster we
keep the FIRST canonical occurrence (or the one we explicitly nominate by line
number) and DELETE every later restate. We also rewrite a few standing-rule
contradictions and promote 3 buried intents into the Active Priorities block.
"""
import re, shutil
from pathlib import Path

SRC = Path("/home/ubuntu/reagan_homeschool_dashboard/todo.md")
BACKUP = Path("/home/ubuntu/reagan_homeschool_dashboard/todo.md.bak-v2-2026-05-12")
shutil.copy(SRC, BACKUP)

raw = SRC.read_text()
lines = raw.splitlines()

def is_item(l):  return re.match(r"^\s*-\s*\[[ x]\]\s", l) is not None
def is_checked(l): return re.match(r"^\s*-\s*\[x\]\s", l) is not None
def text_of(l):
    m = re.match(r"^\s*-\s*\[[ x]\]\s*(.*)$", l)
    return m.group(1) if m else ""

# Intent matchers — a line matches if any regex hits (case-insensitive).
# `keep_first_n` : how many matches to keep (others dropped).
# `keep_only_checked` : if True, drop unchecked restates entirely.
# `nominate_lines` : if non-empty, ONLY keep lines whose 1-indexed number is in this set.
INTENTS = [
  {
    "name": "ai-agenda-editor-edits",
    "patterns": [r"agenda editor", r"ai.first.*agenda", r"manus.style.*editor", r"ai.*agenda.*edit"],
    "keep_first_n": 0,
    "nominate_lines": set(),
    "exempt_section_re": r"(Active Priorities|House Rules|Slice [0-9])",
  },
  {
    "name": "daily-agenda-email",
    "patterns": [r"daily agenda.*email", r"nightly.*agenda.*email", r"agenda pdf.*email", r"email.*pdf.*agenda", r"\b8 ?pm.*email", r"agenda packet"],
    "keep_first_n": 0,
    "nominate_lines": set(),
    "exempt_section_re": r"(Active Priorities|House Rules|Phase 11|Recently Shipped)",
  },
  {
    "name": "operable-printable-blocks",
    "patterns": [r"operable.*printable", r"printable.*block", r"fully operable", r"answer key.*pdf", r"video.*description.*qr"],
    "keep_first_n": 0,
    "nominate_lines": set(),
    "exempt_section_re": r"(Active Priorities|House Rules|Slice 4)",
  },
  {
    "name": "subject-color-system",
    "patterns": [r"subject color", r"subject[- ]colored", r"subject.*color.*key"],
    "keep_first_n": 1,           # keep the first one (canonical), drop the other 15
    "nominate_lines": set(),
    "exempt_section_re": None,
  },
  {
    "name": "drive-mirror",
    "patterns": [r"drive.*mirror", r"reagan school hub", r"drive.*auto.*save", r"drive.*auto.*backup", r"drive folder map"],
    "keep_first_n": 1,
    "nominate_lines": set(),
    "exempt_section_re": None,
  },
  {
    "name": "kiwi-no-auto-open",
    "patterns": [r"wake[- ]word", r"auto[- ]open.*kiwi", r"mic.*permission", r"microphone.*notif"],
    "keep_first_n": 1,
    "nominate_lines": set(),
    "exempt_section_re": r"(House Rules)",
  },
  {
    "name": "fake-analytics-scrub",
    "patterns": [r"fake.*seed", r"demo.*seed", r"placeholder.*row", r"scrub.*analytic", r"\btest book\b", r"brutus", r"\blorem\b"],
    "keep_first_n": 0,           # keep only Active-Priorities URGENT scrub copies
    "nominate_lines": set(),
    "exempt_section_re": r"(Active Priorities|URGENT scrub)",
  },
  {
    "name": "intro-tour",
    "patterns": [r"intro tour", r"introtour", r"first.day setup", r"kiwi.*intro.*tour"],
    "keep_first_n": 1,
    "nominate_lines": set(),
    "exempt_section_re": None,
  },
  {
    "name": "kiwi-page-consolidation",
    "patterns": [r"kiwi page", r"coins.*practice.*one page", r"/kiwi"],
    "keep_first_n": 1,
    "nominate_lines": set(),
    "exempt_section_re": None,
  },
  {
    "name": "tutor-roster",
    "patterns": [r"tutor.*roster", r"\bmadison\b.*tutor", r"\bsophie\b.*tutor", r"\bkeith\b.*tutor", r"tutor.*editor.*tier"],
    "keep_first_n": 0,
    "nominate_lines": set(),
    "exempt_section_re": r"(Active Priorities|Tutors)",
  },
  {
    "name": "google-calendar-sync",
    "patterns": [r"google calendar", r"o81tqeb4", r"calendar.*sync", r"\.ics", r"calendar id"],
    "keep_first_n": 0,
    "nominate_lines": set(),
    "exempt_section_re": r"(Active Priorities|Calendar)",
  },
  {
    "name": "iep-data-preserve",
    "patterns": [r"iep goals?\b", r"iep accommodation", r"iepgoals", r"iepaccommodations", r"district label.*madeira"],
    "keep_first_n": 1,
    "nominate_lines": set(),
    "exempt_section_re": r"(Active Priorities|IH/PowerSchool legacy|Recently Shipped)",
  },
]

# Standing-rule rewrites (apply once, regardless of section)
REWRITES = {
  r"^- \[ \] Reagan can drag-reorder her own day \(start \+ end times locked\)$":
      "- [ ] Reagan can drag-reorder her own day; she cannot change start/end times — Mom + Grandma can change ANY field, including start/end (no exceptions)",
  r"^- \[ \] Per-block edit affordance: tap block → tweak start time \+ duration inline.*$":
      "- [ ] PROMOTED to Active Priorities: tap-block inline edit (start time + duration) for Mom + Grandma — no need to open AI Agenda Editor",
  r"^- \[ \] Hide ihAssignments UI surfaces \(table can stay for now — read-only legacy\)$":
      "- [ ] (DUPE — see IH/PowerSchool legacy cleanup) Hide ihAssignments UI",
  r"^- \[ \] Hide ihAssignments UI \(table stays read-only legacy\)$":
      "- [ ] (DUPE — see IH/PowerSchool legacy cleanup) Hide ihAssignments UI",
}

# Track current section header so exempt_section_re can apply
def current_section(idx):
    for j in range(idx, -1, -1):
        if lines[j].startswith("##") or lines[j].startswith("# "):
            return lines[j]
    return ""

# Apply intent collapses
keep_counts = {it["name"]: 0 for it in INTENTS}
out = []
deleted = {it["name"]: 0 for it in INTENTS}

for i, l in enumerate(lines):
    if not is_item(l):
        out.append(l)
        continue

    # Apply rewrites first
    for pat, rep in REWRITES.items():
        if re.match(pat, l, flags=re.IGNORECASE):
            l = rep
            break

    sec = current_section(i)
    txt = l.lower()

    dropped = False
    for it in INTENTS:
        if any(re.search(p, txt, flags=re.IGNORECASE) for p in it["patterns"]):
            # Check exempt section (always keep lines in exempt sections)
            if it["exempt_section_re"] and re.search(it["exempt_section_re"], sec, flags=re.IGNORECASE):
                break
            # Otherwise apply keep_first_n logic
            if keep_counts[it["name"]] < it["keep_first_n"]:
                keep_counts[it["name"]] += 1
                break
            # Drop this restate
            dropped = True
            deleted[it["name"]] += 1
            break

    if not dropped:
        out.append(l)

# Promote 3 buried intents into the Active Priorities block (just below "## ⭐ Active Priorities")
PROMOTION_BLOCK = """
### AI Agenda Editor — fully Mom + Grandma editable (CANONICAL)
- [ ] Mom + Grandma can edit EVERY field, EVERY block, EVERY day in the AI Agenda Editor — title, subject, start time, duration, body, materials, links, printables — with NO approval gate
- [ ] AI Agenda Editor accepts free-form prompts ("short fun and easy", "more focused on math", "skip science today, double up tomorrow") and proposes a diff Mom can accept/reject per block
- [ ] Tap-block inline edit (start time + duration only) on Today + Schedule — no need to open AI Agenda Editor for quick tweaks (Mom + Grandma + tutors)
- [ ] Vitest: free-form prompt → diff → commit; per-field edit; per-block start/duration tap-edit; Mom and Grandma both authorized

### Daily Agenda Email Packet (CANONICAL — supersedes all earlier daily-email items)
- [x] Phase 11 — Nightly 8 PM agenda PDF + worksheets + lesson plans + schedule + estimated times + answer keys → emailed to Mom + auto-saved to Drive (DONE 2026-05-04)
- [ ] Add Grandma to the recipient list (CC marcy.spear@gmail.com)
- [ ] Vitest: cron emits exactly ONE packet per day; packet includes worksheet PDFs + answer key PDFs

"""

# Insert PROMOTION_BLOCK right after the "## ⭐ Active Priorities" header
final_text = "\n".join(out)
final_text = re.sub(
    r"(## ⭐ Active Priorities[^\n]*\n)",
    r"\1" + PROMOTION_BLOCK,
    final_text,
    count=1,
)

def stats(t):
    return (sum(1 for x in t.splitlines() if re.match(r"^\s*-\s*\[x\]", x)),
            sum(1 for x in t.splitlines() if re.match(r"^\s*-\s*\[ \]", x)),
            len(t.splitlines()))

ox, oo, on = stats(raw)
nx, no, nn = stats(final_text)
print(f"BEFORE: {on} lines | [x]={ox} [ ]={oo}")
print(f"AFTER : {nn} lines | [x]={nx} [ ]={no}")
print(f"DELTA : {nn-on} lines | [x]{nx-ox:+d} [ ]{no-oo:+d}")
print("Per-intent deletes:")
for it in INTENTS:
    print(f"  {it['name']:32s} dropped={deleted[it['name']]:3d}  kept_in_clusters={keep_counts[it['name']]}")

SRC.write_text(final_text)
print(f"wrote {SRC}; backup at {BACKUP}")
