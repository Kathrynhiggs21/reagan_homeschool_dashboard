#!/usr/bin/env python3
"""
drive_hub_unify_2026_05_18.py — fixes the v2.49 Drive Hub simplification bug.

The v2.49 simplification audited only the user-facing Hub root
(1r3bJacPLJN7VHI8y72rcx1-GRxspqo1r) and created NEW empty 03/04 folders there.
But the dashboard's `appSettings` cache was pointing 5 of 9 canonical-parent
folder IDs at a separate "engineering" root (1GOnWdEIBpfn...) where the real
curriculum/admin/printables/adventures/worksheets folders had been living.

That meant the nightly Drive mirror was writing real content into folders Mom
+ Grandma cannot see, while the user-facing Hub had empty 03/04 placeholders.

This script unifies them by:
  - Trashing the empty 03/04 placeholders at the Hub root
  - Moving the real engineering folders into the Hub root with correct prefixes
  - Nesting Printables-and-Resources + Adventures-and-Enrichment INSIDE the
    moved "03 - Curriculum and Resources" (they are subtypes, not top-level)
  - Moving the Worksheets-(Daily-Packets) into "01 - Daily Operations"
  - Archiving "Reagan Dashboard Backend Pushes" under Hub/Archive/2026/_engineering/
  - Trashing 3 garbage-named folders from a buggy earlier create attempt

Dry-run by default. Pass --apply to execute.

Re-runnable: each step is idempotent — folders already in their target are
skipped silently.
"""

import argparse
import json
import shlex
import subprocess
import sys
from typing import Optional

HUB_ROOT = "1r3bJacPLJN7VHI8y72rcx1-GRxspqo1r"
ENG_ROOT = "1GOnWdEIBpfnY_14Fr-jf2AJKlzEHvMLH"

# Folders that should be DELETED outright (empty v2.49 placeholders + garbage).
TRASH = [
    ("1ighaciRpTk8oloh55dEhgx0YZmomsZWJ", "03 - Curriculum and Resources (empty placeholder)"),
    ("1aLViM1-T0_ob0CFNxJN9hnzMauROySjF", "04 - Admin and Records (empty placeholder)"),
    ("1k1Tb1l32NzogodkJkZwgbl8uOFeFRisj", ",id=19qljXy7RUVwDHZyD_BH1n5G3320R00Th:"),
    ("1mbd71OFHUCAJxy1-_VpLfA04laFpcvH7", ",id=:"),
    ("1NGztVZb0bKckpu-A0gmmpfsm4Rum9yKG", "{1y4jZtanObfPVjbrPJhqavQd4l3Ra2xxF}"),
]

# Folders that should be moved+renamed.
# Format: (folder_id, current_name, new_parent_id, new_name)
# new_parent_id can be HUB_ROOT, or a placeholder we resolve at runtime
# (we resolve "03_curriculum_target" after we move curriculum itself).
MOVES = [
    # 03 — Curriculum and Resources (top-level under Hub)
    ("18HhQdVn6F-IS6eZOV41xRbST5cHGuqJM",
     "Curriculum and Standards",
     HUB_ROOT,
     "03 - Curriculum and Resources"),
    # 04 — Admin and Records (top-level under Hub)
    ("1RcO_WCr2mG2v_4cVxHjslx4UpsFflHan",
     "Admin and Homeschool Records",
     HUB_ROOT,
     "04 - Admin and Records"),
    # Printables and Resources nests INSIDE 03 - Curriculum and Resources
    ("1MpQ0OGDBvloSz_DzCGa8pUYytSjOuHWw",
     "Printables and Resources",
     "18HhQdVn6F-IS6eZOV41xRbST5cHGuqJM",  # the folder we just moved to Hub
     "Printables and Resources"),  # keep same name; it's already correct
    # Adventures and Enrichment nests INSIDE 03 - Curriculum and Resources
    ("1i1-UtUYady8BcWJzozXpf_igQEoY_loa",
     "Adventures and Enrichment",
     "18HhQdVn6F-IS6eZOV41xRbST5cHGuqJM",
     "Adventures and Enrichment"),
    # Worksheets (Daily Packets) was in engineering root, belongs in 01 - Daily Ops
    ("1SmXWhLk7SF_JNoVa5TWqtAdH60tNSjWA",
     "Worksheets (Daily Packets)",
     "1wyFk4rTPT-bZsadEVwODmqnABhevn6yb",  # 01 - Daily Operations
     "Worksheets (Daily Packets)"),
]

# The Backend Pushes folder needs special handling — it goes to Hub/Archive/2026/_engineering/
# We resolve the destination parent dynamically (creating it if missing).
BACKEND_PUSHES_ID = "1_j0cyiJHRpvXjez5jg3n_DZXPvt_QD_M"


def gws(action: str, params: dict) -> Optional[dict]:
    """Run gws drive ... and parse JSON. Returns None on error."""
    cmd = ["gws", "drive", *action.split(), "--params", json.dumps(params)]
    p = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    if p.returncode != 0:
        sys.stderr.write(f"[gws-err] {' '.join(shlex.quote(c) for c in cmd)}\n{p.stderr}\n")
        return None
    out = p.stdout.strip()
    if not out:
        return {}
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        sys.stderr.write(f"[gws-bad-json] {out[:500]}\n")
        return None


def get_file(file_id: str) -> Optional[dict]:
    return gws("files get", {"fileId": file_id, "fields": "id,name,parents,trashed,mimeType"})


def ensure_child_folder(parent_id: str, name: str, dry_run: bool) -> Optional[str]:
    """Find or create a folder named `name` under `parent_id`. Returns its ID."""
    listing = gws("files list", {
        "q": f"'{parent_id}' in parents and name='{name}' and mimeType='application/vnd.google-apps.folder' and trashed=false",
        "fields": "files(id,name)",
        "pageSize": 5,
    })
    if listing and listing.get("files"):
        return listing["files"][0]["id"]
    if dry_run:
        print(f"  [dry-run] would CREATE folder {name!r} under {parent_id}")
        return f"<would-create:{name}>"
    created = gws("files create", {
        "name": name,
        "mimeType": "application/vnd.google-apps.folder",
        "parents": [parent_id],
        "fields": "id,name,parents",
    })
    if not created:
        print(f"  [error] failed to create {name!r} under {parent_id}")
        return None
    print(f"  [created] {name!r} -> {created.get('id')}")
    return created.get("id")


def trash_folder(file_id: str, label: str, dry_run: bool) -> bool:
    meta = get_file(file_id)
    if not meta:
        print(f"  [skip-trash] {label} ({file_id}) not found")
        return True
    if meta.get("trashed"):
        print(f"  [skip-trash] {label} ({file_id}) already trashed")
        return True
    name = meta.get("name", "?")
    if dry_run:
        print(f"  [dry-run] would TRASH {label!r} (live name: {name!r}, id: {file_id})")
        return True
    res = gws("files update", {"fileId": file_id, "body": {"trashed": True}})
    if res is None:
        print(f"  [error] trash failed for {label!r} ({file_id})")
        return False
    print(f"  [trashed] {label!r} ({file_id})")
    return True


def move_and_rename(file_id: str, expected_old_name: str, new_parent_id: str, new_name: str, dry_run: bool) -> bool:
    meta = get_file(file_id)
    if not meta:
        print(f"  [skip-move] {file_id} ({expected_old_name}) not found")
        return False
    if meta.get("trashed"):
        print(f"  [skip-move] {file_id} ({expected_old_name}) is trashed; skipping")
        return False
    old_name = meta.get("name", "?")
    old_parents = meta.get("parents") or []
    needs_rename = old_name != new_name
    needs_move = new_parent_id not in old_parents
    if not needs_rename and not needs_move:
        print(f"  [noop] {expected_old_name!r} already at correct parent + name")
        return True
    plan_bits = []
    if needs_rename:
        plan_bits.append(f"rename {old_name!r} -> {new_name!r}")
    if needs_move:
        plan_bits.append(f"move from parents={old_parents} -> {new_parent_id}")
    if dry_run:
        print(f"  [dry-run] would " + " AND ".join(plan_bits) + f" (id: {file_id})")
        return True
    params = {"fileId": file_id, "body": {}}
    if needs_rename:
        params["body"]["name"] = new_name
    if needs_move:
        params["addParents"] = new_parent_id
        params["removeParents"] = ",".join(old_parents) if old_parents else ""
    res = gws("files update", params)
    if res is None:
        print(f"  [error] move/rename failed for {expected_old_name!r}")
        return False
    print(f"  [done] " + " AND ".join(plan_bits) + f" (id: {file_id})")
    return True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="actually apply changes (default: dry-run)")
    args = parser.parse_args()
    dry = not args.apply
    mode = "DRY-RUN" if dry else "APPLY"
    print(f"=== drive_hub_unify_2026_05_18.py [{mode}] ===\n")

    print("STEP 1: Trash the v2.49 empty placeholders + 3 garbage folders")
    for fid, label in TRASH:
        trash_folder(fid, label, dry)
    print()

    print("STEP 2: Move + rename the 5 real folders into the correct Hub slots")
    for fid, old_name, new_parent, new_name in MOVES:
        move_and_rename(fid, old_name, new_parent, new_name, dry)
    print()

    print("STEP 3: Archive 'Reagan Dashboard Backend Pushes' under Hub/Archive/2026/_engineering/")
    # Find or create Archive/2026/_engineering chain
    archive_id = ensure_child_folder(HUB_ROOT, "Archive", dry)
    if archive_id and not archive_id.startswith("<would-create:"):
        archive_2026 = ensure_child_folder(archive_id, "2026", dry)
        if archive_2026 and not archive_2026.startswith("<would-create:"):
            eng_dest = ensure_child_folder(archive_2026, "_engineering", dry)
            if eng_dest and not eng_dest.startswith("<would-create:"):
                move_and_rename(BACKEND_PUSHES_ID, "Reagan Dashboard Backend Pushes",
                                eng_dest, "Reagan Dashboard Backend Pushes (archived 2026-05-18)", dry)
            else:
                print("  [dry-run-or-error] cannot resolve _engineering destination this run")
        else:
            print("  [dry-run-or-error] cannot resolve Archive/2026 this run")
    else:
        print("  [dry-run-or-error] cannot resolve Archive this run")
    print()

    print(f"=== {mode} complete ===")
    if dry:
        print("Re-run with --apply to execute the plan above.")


if __name__ == "__main__":
    main()
