#!/usr/bin/env python3
"""
drive_hub_unify_fixup_2026_05_18.py — clean up after the partial apply of
drive_hub_unify_2026_05_18.py.

What the first apply actually did:
  - Trashed 3 garbage folders (success)
  - DID NOT trash the 2 v2.49 empty placeholders (silently no-op)
  - Moved 3 folders into Hub root (success: Curriculum and Standards, Admin and
    Homeschool Records, plus the Printables + Adventures + Worksheets nested
    moves) but DID NOT rename the 2 top-level ones to "03 - ..." / "04 - ..."
    (the combined body+addParents API call silently dropped the rename)
  - Did NOT actually move Backend Pushes (only "rename" was logged but the
    folder still sits in the engineering root with its original name)

Plan for this fix-up:
  1. Trash the 2 empty placeholders separately (single call each)
  2. Rename "Curriculum and Standards" -> "03 - Curriculum and Resources" (single call)
  3. Rename "Admin and Homeschool Records" -> "04 - Admin and Records" (single call)
  4. Move Backend Pushes into Hub/Archive/2026/_engineering/ (verifying chain first)
  5. Re-verify Hub root looks like the v2.49 plan: exactly 8 children
     (6 numbered + Archive + README)

Dry-run by default. Pass --apply to execute.
"""

import argparse
import json
import shlex
import subprocess
import sys
from typing import Optional

HUB_ROOT = "1r3bJacPLJN7VHI8y72rcx1-GRxspqo1r"
ARCHIVE_ROOT = "1kbBUq5HdQ71S6R3CORW63X4Nu9_72__O"

# (file_id, label) — these two should not exist as separate folders;
# the real Curriculum + Admin folders use different IDs.
TRASH = [
    ("1ighaciRpTk8oloh55dEhgx0YZmomsZWJ", "03 - Curriculum and Resources (v2.49 empty placeholder)"),
    ("1aLViM1-T0_ob0CFNxJN9hnzMauROySjF", "04 - Admin and Records (v2.49 empty placeholder)"),
]

# (file_id, new_name) — single-purpose rename calls
RENAMES = [
    ("18HhQdVn6F-IS6eZOV41xRbST5cHGuqJM", "03 - Curriculum and Resources"),
    ("1RcO_WCr2mG2v_4cVxHjslx4UpsFflHan", "04 - Admin and Records"),
]

BACKEND_PUSHES_ID = "1_j0cyiJHRpvXjez5jg3n_DZXPvt_QD_M"


def gws(action: str, params: dict) -> Optional[dict]:
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


def list_children(parent_id: str, name: Optional[str] = None) -> list:
    q = f"'{parent_id}' in parents and trashed=false"
    if name:
        q += f" and name='{name}'"
    res = gws("files list", {"q": q, "fields": "files(id,name,mimeType)", "pageSize": 50})
    return (res or {}).get("files", [])


def ensure_child_folder(parent_id: str, name: str, dry: bool) -> Optional[str]:
    existing = list_children(parent_id, name)
    folders = [f for f in existing if f.get("mimeType") == "application/vnd.google-apps.folder"]
    if folders:
        return folders[0]["id"]
    if dry:
        print(f"  [dry] would CREATE folder {name!r} under {parent_id}")
        return None
    created = gws("files create", {
        "name": name,
        "mimeType": "application/vnd.google-apps.folder",
        "parents": [parent_id],
        "fields": "id,name,parents",
    })
    if not created:
        return None
    print(f"  [created] {name!r} -> {created.get('id')}")
    return created.get("id")


def trash_only(file_id: str, label: str, dry: bool) -> bool:
    meta = get_file(file_id)
    if not meta:
        print(f"  [skip] {label}: not found")
        return False
    if meta.get("trashed"):
        print(f"  [skip] {label}: already trashed")
        return True
    live_name = meta.get("name", "?")
    if dry:
        print(f"  [dry] would TRASH {label} (live name: {live_name!r})")
        return True
    res = gws("files update", {
        "fileId": file_id,
        "body": {"trashed": True},
    })
    if res is None:
        print(f"  [error] trash failed for {label}")
        return False
    # confirm via fresh get
    verify = get_file(file_id)
    if verify and verify.get("trashed"):
        print(f"  [trashed] {label}")
        return True
    print(f"  [warn] trash call returned ok but verify says not trashed: {label}")
    return False


def rename_only(file_id: str, new_name: str, dry: bool) -> bool:
    meta = get_file(file_id)
    if not meta:
        print(f"  [skip] {file_id}: not found")
        return False
    if meta.get("name") == new_name:
        print(f"  [skip] {file_id} already named {new_name!r}")
        return True
    old_name = meta.get("name", "?")
    if dry:
        print(f"  [dry] would RENAME {old_name!r} -> {new_name!r}")
        return True
    res = gws("files update", {
        "fileId": file_id,
        "body": {"name": new_name},
    })
    if res is None:
        print(f"  [error] rename failed for {old_name}")
        return False
    verify = get_file(file_id)
    if verify and verify.get("name") == new_name:
        print(f"  [renamed] {old_name!r} -> {new_name!r}")
        return True
    print(f"  [warn] rename call returned ok but verify says still {verify.get('name')!r}")
    return False


def reparent_only(file_id: str, new_parent_id: str, dry: bool) -> bool:
    meta = get_file(file_id)
    if not meta:
        print(f"  [skip] {file_id}: not found")
        return False
    old_parents = meta.get("parents") or []
    if new_parent_id in old_parents and len(old_parents) == 1:
        print(f"  [skip] {file_id} already in parent {new_parent_id}")
        return True
    if dry:
        print(f"  [dry] would MOVE {file_id} from {old_parents} -> {new_parent_id}")
        return True
    res = gws("files update", {
        "fileId": file_id,
        "addParents": new_parent_id,
        "removeParents": ",".join(old_parents),
    })
    if res is None:
        print(f"  [error] move failed for {file_id}")
        return False
    verify = get_file(file_id)
    if verify and new_parent_id in (verify.get("parents") or []):
        print(f"  [moved] {file_id} now under {new_parent_id}")
        return True
    print(f"  [warn] move call returned ok but verify says parents={verify.get('parents')}")
    return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()
    dry = not args.apply
    mode = "DRY-RUN" if dry else "APPLY"
    print(f"=== drive_hub_unify_fixup_2026_05_18.py [{mode}] ===\n")

    print("STEP 1: Trash the v2.49 empty placeholders (single-purpose calls)")
    for fid, label in TRASH:
        trash_only(fid, label, dry)
    print()

    print("STEP 2: Rename the two top-level canonical-parent folders (single-purpose)")
    for fid, new_name in RENAMES:
        rename_only(fid, new_name, dry)
    print()

    print("STEP 3: Move Backend Pushes to Hub/Archive/2026/_engineering/ (chain + move separately)")
    a2026 = ensure_child_folder(ARCHIVE_ROOT, "2026", dry)
    if a2026:
        a_eng = ensure_child_folder(a2026, "_engineering", dry)
        if a_eng:
            reparent_only(BACKEND_PUSHES_ID, a_eng, dry)
            rename_only(BACKEND_PUSHES_ID, "Reagan Dashboard Backend Pushes (archived 2026-05-18)", dry)
        else:
            print("  [error] could not resolve _engineering target")
    else:
        print("  [error] could not resolve Archive/2026 target")
    print()

    print("=== verifying Hub root ===")
    kids = list_children(HUB_ROOT)
    kids.sort(key=lambda f: f["name"])
    for f in kids:
        print(f"  {f['name']:50}  {f['id']}  ({f['mimeType']})")
    print(f"  total: {len(kids)} children")


if __name__ == "__main__":
    main()
