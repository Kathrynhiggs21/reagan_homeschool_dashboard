#!/usr/bin/env python3
"""
Find near-duplicate / similar items in todo.md.

Heuristics:
  1. Exact duplicate (same lowercased text, ignoring leading "- [ ] " / "- [x] ").
  2. Token-overlap >= 70% on 4+ shared significant tokens (stopwords + numbers/punct stripped).

For every cluster, prints:
  - the canonical line (longest, latest line-number)
  - line numbers + checkbox state of each duplicate

Designed for a HUMAN to scan, not auto-delete.
"""
import re
from collections import defaultdict
from pathlib import Path

STOP = set("""
a an the and or for to of in on at by with from into out is are was were be been being
i ii iii iv v vi vii viii ix x xi xii
do does done make build add update fix wire ensure show track all every each per
new old can not no yes only also via through as if when then so etc this that these those
it its their them they reagan kiwi mom grandma adult tutor
""".split())

NUM_RE = re.compile(r"\b\d+\b")
PUNCT_RE = re.compile(r"[^\w\s]+")

def tokens(s: str):
    s = s.lower()
    s = NUM_RE.sub(" ", s)
    s = PUNCT_RE.sub(" ", s)
    out = [t for t in s.split() if t and t not in STOP and len(t) > 2]
    return out

def strip_chk(line: str):
    return re.sub(r"^\s*-\s*\[[ x]\]\s*", "", line).strip()

p = Path("/home/ubuntu/reagan_homeschool_dashboard/todo.md")
lines = p.read_text().splitlines()

items = []  # (lineno, raw, checked, body, tokset)
for i, raw in enumerate(lines, 1):
    m = re.match(r"^\s*-\s*\[([ x])\]\s*(.*)$", raw)
    if not m:
        continue
    checked = (m.group(1) == "x")
    body = m.group(2).strip()
    if len(body) < 8:
        continue
    items.append((i, raw, checked, body, set(tokens(body))))

print(f"Loaded {len(items)} todo items.\n")

# 1. Exact dups
exact = defaultdict(list)
for it in items:
    key = re.sub(r"\s+", " ", it[3].lower()).strip()
    exact[key].append(it)

exact_groups = [v for v in exact.values() if len(v) > 1]
print(f"=== EXACT DUPLICATES: {len(exact_groups)} clusters ===\n")
for grp in exact_groups:
    print(f"  TEXT: {grp[0][3][:120]}")
    for it in grp:
        chk = "x" if it[2] else " "
        print(f"    L{it[0]:4d} [{chk}]")
    print()

# 2. Token-overlap clusters (excluding lines already in an exact cluster)
in_exact = set()
for grp in exact_groups:
    for it in grp:
        in_exact.add(it[0])

remaining = [it for it in items if it[0] not in in_exact]
remaining = [it for it in remaining if len(it[4]) >= 4]

similar_clusters = []
used = set()
for i, a in enumerate(remaining):
    if a[0] in used:
        continue
    cluster = [a]
    for b in remaining[i+1:]:
        if b[0] in used:
            continue
        inter = a[4] & b[4]
        if len(inter) < 4:
            continue
        union = a[4] | b[4]
        jacc = len(inter) / len(union)
        if jacc >= 0.55:
            cluster.append(b)
            used.add(b[0])
    if len(cluster) > 1:
        used.add(a[0])
        similar_clusters.append(cluster)

# Sort clusters by size desc
similar_clusters.sort(key=lambda c: -len(c))

print(f"\n=== SIMILAR (Jaccard >=0.55, >=4 shared tokens): {len(similar_clusters)} clusters ===\n")
for k, grp in enumerate(similar_clusters, 1):
    shared = set.intersection(*[it[4] for it in grp])
    print(f"  [{k}] shared tokens: {sorted(shared)[:8]}")
    for it in grp:
        chk = "x" if it[2] else " "
        print(f"    L{it[0]:4d} [{chk}] {it[3][:140]}")
    print()
