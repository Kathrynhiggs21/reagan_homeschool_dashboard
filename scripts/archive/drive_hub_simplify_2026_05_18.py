#!/usr/bin/env python3
"""
Drive Hub Simplification — 2026-05-18

Reorganizes the Reagan School Hub (Dashboard) Drive folder into 6 numbered
top-level subfolders + 1 Archive bucket, per the audit doc at
references/drive-hub-audit-2026-05-18.md.

Run modes:
  $ python3 scripts/drive_hub_simplify_2026_05_18.py            # dry-run (default)
  $ python3 scripts/drive_hub_simplify_2026_05_18.py --apply    # execute

The script is fully idempotent: each step checks current Drive state and
only mutates if needed. Re-running after a partial failure is safe.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from typing import Optional

HUB_ROOT_ID = "1r3bJacPLJN7VHI8y72rcx1-GRxspqo1r"

# All folder IDs were captured in the audit on 2026-05-18.
RENAMES = [
    ("1wyFk4rTPT-bZsadEVwODmqnABhevn6yb", "Daily Operations",      "01 - Daily Operations"),
    ("1--Z75dZRcTTrEVlRGtIVfP5b1OMi8hCT", "Assignments and Work",  "02 - Assignments and Work"),
    ("1ighaciRpTk8oloh55dEhgx0YZmomsZWJ", "Curriculum and Resources", "03 - Curriculum and Resources"),
    ("1aLViM1-T0_ob0CFNxJN9hnzMauROySjF", "Admin and Records",     "04 - Admin and Records"),
    ("1YYRTEko_yYCg0V3S-tx-wyT6wQ2F2mpj", "Progress and Reports",  "05 - Progress and Reports"),
    ("1PQPK34gnnlZrNojxFLJddCnDSpUQ5kR1", "Inbox (Unsorted)",      "06 - Inbox (Unsorted)"),
]

# (folder_id, expected_current_parent_id, target_parent_id_resolver)
# target_parent_id_resolver is a string that names the renamed-target above.
ABSORPTIONS = [
    # Classes -> 01 - Daily Operations
    ("1_PdN0Sjje97ORaZIT8Cy0cV8pN5fsg5b", "Classes",            "1wyFk4rTPT-bZsadEVwODmqnABhevn6yb"),
    # Behavior Analytics -> 05 - Progress and Reports
    ("1fYM_vVXAmJGSYYWVSAdJEY3gCKnaKPSw", "Behavior Analytics", "1YYRTEko_yYCg0V3S-tx-wyT6wQ2F2mpj"),
    # Snapshots -> 05 - Progress and Reports
    ("1Mbx5efaCkEu22ilN72xrx_Sn4jjBZ7mD", "Snapshots",          "1YYRTEko_yYCg0V3S-tx-wyT6wQ2F2mpj"),
    # Top-level Apps & Tools -> 03 - Curriculum and Resources
    # (the existing Curriculum/Apps and Tools nested folder will be merged later)
    ("11nFevBu1OP-GhKSSJvS5PyEpKS8p-FQW", "Apps & Tools",       "1ighaciRpTk8oloh55dEhgx0YZmomsZWJ"),
]

ARCHIVE_LEGACY = ("1GOnWdEIBpfnY_14Fr-jf2AJKlzEHvMLH", "_archive-engineering-2026-05")


def gws(args: list[str]) -> dict:
    """Run a gws CLI command and return parsed JSON output."""
    proc = subprocess.run(
        ["gws"] + args,
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0 and not proc.stdout.strip().startswith("{"):
        raise RuntimeError(f"gws {' '.join(args)} failed: {proc.stderr}")
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"gws returned non-JSON: {proc.stdout[:200]}") from e


def get_file(file_id: str) -> dict:
    return gws([
        "drive", "files", "get",
        "--params", json.dumps({"fileId": file_id, "fields": "id,name,parents,mimeType"}),
    ])


def find_child(parent_id: str, name: str) -> Optional[dict]:
    res = gws([
        "drive", "files", "list",
        "--params", json.dumps({
            "q": f"'{parent_id}' in parents and name = '{name}' and trashed = false",
            "fields": "files(id,name,parents,mimeType)",
            "pageSize": 5,
        }),
    ])
    files = res.get("files", [])
    return files[0] if files else None


def rename(file_id: str, new_name: str, apply: bool) -> str:
    cur = get_file(file_id)
    if cur.get("name") == new_name:
        return f"  [skip] {file_id} already named {new_name!r}"
    if not apply:
        return f"  [DRY] would rename {file_id} {cur.get('name')!r} -> {new_name!r}"
    gws([
        "drive", "files", "update",
        "--params", json.dumps({"fileId": file_id}),
        "--json", json.dumps({"name": new_name}),
    ])
    return f"  [done] renamed {file_id} -> {new_name!r}"


def move(file_id: str, new_parent_id: str, apply: bool) -> str:
    cur = get_file(file_id)
    parents = cur.get("parents") or []
    if new_parent_id in parents and len(parents) == 1:
        return f"  [skip] {file_id} already under {new_parent_id}"
    if not apply:
        return f"  [DRY] would move {file_id} {cur.get('name')!r} from {parents} -> {new_parent_id}"
    add = new_parent_id
    remove = ",".join(p for p in parents if p != new_parent_id)
    params = {"fileId": file_id, "addParents": add}
    if remove:
        params["removeParents"] = remove
    gws([
        "drive", "files", "update",
        "--params", json.dumps(params),
    ])
    return f"  [done] moved {file_id} -> {new_parent_id}"


def ensure_folder(parent_id: str, name: str, apply: bool) -> tuple[str, Optional[str]]:
    existing = find_child(parent_id, name)
    if existing:
        return (f"  [skip] folder {name!r} already exists under {parent_id} as {existing['id']}", existing["id"])
    if not apply:
        return (f"  [DRY] would create folder {name!r} under {parent_id}", None)
    res = gws([
        "drive", "files", "create",
        "--json", json.dumps({
            "name": name,
            "mimeType": "application/vnd.google-apps.folder",
            "parents": [parent_id],
        }),
    ])
    return (f"  [done] created folder {name!r} -> {res['id']}", res["id"])


def main() -> int:
    parser = argparse.ArgumentParser(description="Drive Hub simplification 2026-05-18")
    parser.add_argument("--apply", action="store_true", help="actually mutate Drive (default: dry-run)")
    args = parser.parse_args()

    print(f"\n=== Drive Hub Simplification — {'APPLY' if args.apply else 'DRY-RUN'} mode ===\n")
    print(f"Hub root: {HUB_ROOT_ID}\n")

    print("Step 1: Rename top-level KEEP folders with numeric prefixes")
    for fid, _old, new in RENAMES:
        print(rename(fid, new, args.apply))

    print("\nStep 2: Absorb stray top-level folders into renamed targets")
    for fid, _label, target in ABSORPTIONS:
        print(move(fid, target, args.apply))

    print("\nStep 3: Build Archive/2026/ bucket and nest the legacy engineering archive")
    archive_msg, archive_id = ensure_folder(HUB_ROOT_ID, "Archive", args.apply)
    print(archive_msg)
    if archive_id:
        y2026_msg, y2026_id = ensure_folder(archive_id, "2026", args.apply)
        print(y2026_msg)
        if y2026_id:
            old_id, _old_name = ARCHIVE_LEGACY
            print(move(old_id, y2026_id, args.apply))
            print(rename(old_id, "_engineering", args.apply))
    else:
        print("  [DRY] would create Archive/2026/ then move + rename the legacy archive folder")

    print("\nStep 4: Verify hub root has the expected 7 children (6 numbered + Archive) + README")
    children = gws([
        "drive", "files", "list",
        "--params", json.dumps({
            "q": f"'{HUB_ROOT_ID}' in parents and trashed = false",
            "fields": "files(id,name,mimeType)",
            "pageSize": 50,
            "orderBy": "name",
        }),
    ])
    for f in children.get("files", []):
        kind = "DIR" if f.get("mimeType", "").endswith("folder") else "FILE"
        print(f"  {kind:4} {f['name']}")

    print(f"\n=== {'APPLIED' if args.apply else 'DRY-RUN COMPLETE'} ===")
    print("If dry-run output looks correct, re-run with --apply to execute.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
