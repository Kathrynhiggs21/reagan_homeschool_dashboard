"""V2: operates on the v1-rewritten todo.md to apply aggressive near-dupe + staleness."""
import re, shutil
from pathlib import Path

SRC = Path("/home/ubuntu/reagan_homeschool_dashboard/todo.md")
BACKUP = Path("/home/ubuntu/reagan_homeschool_dashboard/todo.md.bak-v1-2026-05-12")
shutil.copy(SRC, BACKUP)

lines = SRC.read_text().splitlines()

def is_item(l):  return re.match(r"^\s*-\s*\[[ x]\]\s", l) is not None
def is_checked(l): return re.match(r"^\s*-\s*\[x\]\s", l) is not None
def is_header(l): return l.startswith("## ") or l.startswith("# ")
def item_text(l):
    m = re.match(r"^\s*-\s*\[[ x]\]\s*(.*)$", l)
    return m.group(1) if m else ""

STOP = set("a the and or of for to in on with by from is are be as it that this an at into via not via i my your her his their our".split())
def tokens(s):
    toks = re.findall(r"[a-z0-9]+", s.lower())
    return [t for t in toks if t not in STOP and len(t) > 2]

def jaccard(a, b):
    A, B = set(a), set(b)
    if not A or not B: return 0
    return len(A & B) / len(A | B)

# -------- pass: collapse near-dupes among UNCHECKED items globally --------
# For each unchecked item, compare to previously-kept unchecked items.
kept = []
unchecked_kept = []  # list of (idx_in_kept, tokens)
dupes_dropped = 0

for l in lines:
    if not is_item(l) or is_checked(l):
        kept.append(l); continue
    t = item_text(l)
    toks = tokens(t)
    if len(toks) < 3:
        kept.append(l); unchecked_kept.append((len(kept)-1, toks)); continue
    is_dup = False
    for (_, prev_toks) in unchecked_kept[-400:]:  # window
        shared = set(toks) & set(prev_toks)
        if len(shared) >= 5 and jaccard(toks, prev_toks) >= 0.55:
            is_dup = True
            break
    if is_dup:
        dupes_dropped += 1
        continue
    kept.append(l)
    unchecked_kept.append((len(kept)-1, toks))

# -------- second pass: move every section whose header lacks a 2026-05-04+ date to Backlog --------
# Find the "## 🗂 Backlog / Parking Lot" header; everything BEFORE it that's a non-recent
# section should be moved AFTER it. We'll only move sections whose title doesn't contain
# any of the RECENT markers AND doesn't sit inside the curated TOP block (between H1 and "## Active").

text2 = "\n".join(kept)

# Split into segments by H2
segments = re.split(r"(?m)^(## .+)$", text2)
# segments = [preamble, header1, body1, header2, body2, ...]

RECENT = ["2026-05-04","2026-05-05","2026-05-07","2026-05-08","2026-05-10","2026-05-11",
          "phase 11","phase 15","recently shipped","house rules","active priorities",
          "slice 4","slice 5","slice 6","slice 3.5","calendar","tutors","ih/powerschool legacy",
          "urgent scrub","active (recent","backlog","parking lot"]
def is_recent(h):
    h = h.lower()
    return any(r in h for r in RECENT)

active = [segments[0]]
backlog = []
i = 1
seen_backlog_anchor = False
while i < len(segments):
    head = segments[i]
    body = segments[i+1] if i+1 < len(segments) else ""
    if "🗂 Backlog" in head or "Backlog / Parking" in head.lower():
        seen_backlog_anchor = True
        active.append(head); active.append(body)
        i += 2; continue
    if is_recent(head) and not seen_backlog_anchor:
        active.append(head); active.append(body)
    else:
        backlog.append(head); backlog.append(body)
    i += 2

# Ensure backlog anchor exists
new_text = "".join(active)
if "🗂 Backlog" not in new_text:
    new_text += "\n---\n\n## 🗂 Backlog / Parking Lot (older asks, kept for reference)\n\n"
new_text += "".join(backlog)

# Stats
def count(t):
    return (sum(1 for x in t.splitlines() if re.match(r"^\s*-\s*\[x\]", x)),
            sum(1 for x in t.splitlines() if re.match(r"^\s*-\s*\[ \]", x)),
            len(t.splitlines()))
ox, oo, on = count(SRC.read_text())
nx, no, nn = count(new_text)
print(f"BEFORE: {on} lines | [x]={ox} [ ]={oo}")
print(f"AFTER : {nn} lines | [x]={nx} [ ]={no}   (near-dupes dropped: {dupes_dropped})")
print(f"DELTA : {nn-on} lines | [x]{nx-ox:+d} [ ]{no-oo:+d}")

SRC.write_text(new_text)
print(f"wrote {SRC}; backup at {BACKUP}")
