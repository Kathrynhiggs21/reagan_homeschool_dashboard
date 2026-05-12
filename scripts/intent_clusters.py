"""
Scan todo.md for recurring INTENTS (semantic clusters), not just textual dupes.
Each intent is a hand-curated keyword pattern. For every match we print line + checkbox state.
"""
import re
from pathlib import Path

SRC = Path("/home/ubuntu/reagan_homeschool_dashboard/todo.md")
lines = SRC.read_text().splitlines()

INTENTS = {
    "grey-boxes": [r"grey box", r"gray box", r"no.*grey"],
    "ai-agenda-editor-edits": [r"agenda editor", r"ai agenda", r"manus.style", r"ai.*agenda.*edit", r"agenda.*editor.*save", r"agenda.*editor.*ai.first", r"editor.*editable"],
    "daily-agenda-email": [r"daily agenda.*email", r"nightly.*agenda.*email", r"agenda pdf.*email", r"email.*pdf.*agenda", r"8 ?pm.*email", r"email pipeline", r"daily packet", r"agenda packet"],
    "operable-printable-blocks": [r"operable.*printable", r"printable.*block", r"fully operable", r"video.*link.*description", r"qr.*video", r"page.*number.*reading", r"answer key"],
    "mom-grandma-edit": [r"mom.*grandma.*edit", r"grandma.*always", r"family.*admin", r"familyadmin"],
    "mastery-gate": [r"mastery gate", r"mastery.*not.*minute", r"gate.*mastery"],
    "read-only-or-blocked": [r"read.only", r"read[- ]only", r"cannot edit", r"prevent.*edit", r"lock edit", r"locked", r"hard.block"],
    "reagan-self-complete": [r"reagan.*mark.*complete", r"reagan.side.*complete", r"reagan.*own day", r"reagan.*drag.reorder", r"self.report"],
    "no-timers": [r"no timers", r"hide.*timer", r"timer.*hidden"],
    "kiwi-no-auto-open": [r"wake.word", r"auto[- ]open", r"mic.*permission", r"microphone.*notif"],
    "fake-analytics-scrub": [r"fake.*seed", r"demo.*seed", r"scrub.*analytic", r"placeholder.*row", r"test book", r"brutus", r"lorem"],
    "google-calendar-sync": [r"google calendar", r"calendar id", r"o81tqeb4", r"calendar.*sync", r"\.ics"],
    "summer-mode": [r"summer mode", r"summer.*friendly", r"summer streak", r"vacation.aware"],
    "tutor-roster": [r"tutor.*roster", r"madison|sophie|keith", r"tutor.*permissions", r"tutor.*editor"],
    "subject-color-system": [r"subject color", r"color system", r"subject.colored"],
    "approval-sms": [r"sms approval", r"approval.*phone", r"phonerecipient", r"pendingapproval", r"926.5808", r"646.9281"],
    "iep-data-preserve": [r"iep goal", r"iep accommodation", r"iepgoals", r"iepaccommodations", r"district label"],
    "drive-mirror": [r"drive.*mirror", r"drive.*hub", r"live drive", r"drive folder map", r"drive push"],
    "kiwi-page-consolidation": [r"kiwi page", r"coins.*practice.*one", r"/kiwi"],
    "delete-x-page-or-route": [r"^delete .*\.tsx", r"delete /\w+ route", r"delete .* nav", r"strip .* nav"],
    "intro-tour": [r"intro tour", r"introtour", r"kiwi.*intro", r"first.day setup"],
}

def is_item(l): return re.match(r"^\s*-\s*\[[ x]\]\s", l) is not None
def is_checked(l): return re.match(r"^\s*-\s*\[x\]\s", l) is not None
def is_header(l): return l.startswith("## ") or l.startswith("# ")

# track current section header
section = ""
hits = {k: [] for k in INTENTS}

for i, l in enumerate(lines, 1):
    if is_header(l):
        section = l.strip(); continue
    if not is_item(l): continue
    text = l.lower()
    for intent, pats in INTENTS.items():
        for p in pats:
            if re.search(p, text):
                hits[intent].append((i, "[x]" if is_checked(l) else "[ ]", section, l.strip()))
                break

for intent, rows in hits.items():
    print(f"\n=== {intent} ({len(rows)} hits) ===")
    for (i, mark, sec, l) in rows[:25]:
        secshort = (sec[:60] + "…") if len(sec) > 60 else sec
        print(f"  L{i:>4} {mark} {l[:140]}")
    if len(rows) > 25:
        print(f"  ... +{len(rows)-25} more")
