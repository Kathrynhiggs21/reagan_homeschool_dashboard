#!/usr/bin/env python3
"""Build a print-ready Idea Book markdown from the exported library JSON."""
import json
import sys
from datetime import datetime

src = sys.argv[1] if len(sys.argv) > 1 else "/tmp/idea_library.json"
out = sys.argv[2] if len(sys.argv) > 2 else "/tmp/idea_book.md"

with open(src) as f:
    rows = json.load(f)

KIND_META = {
    "module": ("Modules", "\U0001F4E6"),
    "day_trip": ("Day Trips", "\U0001F697"),
    "reward": ("Rewards", "\U0001F381"),
    "craft": ("Crafts", "\U0001F3A8"),
    "brain_break": ("Brain Breaks", "\U0001F938"),
    "infrastructure": ("Workspace & Infrastructure", "\U0001F9F0"),
    "general": ("General Adventures", "\u2728"),
}
ORDER = ["module", "day_trip", "reward", "craft", "brain_break", "infrastructure", "general"]

def truthy(v):
    return v in (1, True, "1")

groups = {k: [] for k in ORDER}
for r in rows:
    k = r.get("kind") or "general"
    groups.setdefault(k, []).append(r)

today = datetime.now().strftime("%B %d, %Y")
lines = []
lines.append("# Reagan's Idea Book")
lines.append("")
lines.append(f"_A printable bank of adventures, modules, day trips, rewards, crafts, brain breaks, "
             f"and workspace ideas. {len(rows)} ideas in all. Generated {today}._")
lines.append("")
lines.append("Tick the box next to any idea to try, then add it to a day from the Idea Library screen.")
lines.append("")

for k in ORDER:
    items = groups.get(k, [])
    if not items:
        continue
    label, emoji = KIND_META.get(k, (k.title(), ""))
    lines.append("")
    lines.append(f"## {emoji} {label} ({len(items)})")
    lines.append("")
    for a in items:
        star = " \u2605" if truthy(a.get("isFavorite")) else ""
        title_emoji = (a.get("emoji") or "").strip()
        prefix = f"{title_emoji} " if title_emoji else ""
        lines.append(f"- [ ] **{prefix}{a.get('title','')}{star}**")
        desc = (a.get("description") or a.get("instructions") or "").strip()
        if desc:
            lines.append(f"  {desc}")
        meta = []
        if a.get("setting"):
            meta.append(str(a["setting"]))
        if a.get("energyLevel"):
            meta.append(f"{a['energyLevel']} energy")
        mn, mx = a.get("minDurationMin"), a.get("maxDurationMin")
        if mn is not None:
            dur = f"{mn}" + (f"\u2013{mx}" if mx and mx != mn else "") + " min"
            meta.append(dur)
        if a.get("category"):
            meta.append(str(a["category"]))
        if meta:
            sep = " \u00b7 "
            lines.append("  _" + sep.join(meta) + "_")
        lines.append("")

with open(out, "w") as f:
    f.write("\n".join(lines) + "\n")
print(f"wrote {out} ({len(rows)} ideas)")
