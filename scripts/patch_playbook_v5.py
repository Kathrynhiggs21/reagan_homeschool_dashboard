#!/usr/bin/env python3
"""Patch the heartbeat playbook to add `future_worksheets` target mapping."""
import json, subprocess, sys

# Fetch current playbook
raw = subprocess.run(["manus-config", "schedule", "status"], capture_output=True, text=True).stdout
data = json.loads(raw)
sched = data["schedules"][0]
pb = sched["playbook"]
uid = sched.get("uid") or sched.get("id")

if "future_worksheets" in pb:
    print("Already patched. Nothing to do.")
    sys.exit(0)

# Find the classes mapping block and insert future_worksheets just before it
needle = "- classes:"
if needle not in pb:
    needle = '- "classes":'

insert = ("- future_worksheets: Curriculum and Resources / Future Worksheets / {targetSubpath}\n"
          "  (targetSubpath is a subject name like Math, ELA, Science, Social Studies, Fun extras, Specials.\n"
          "   Pre-seeded README + per-subject _index.md cards. New worksheets dropped here as Mom adds them.)\n")

if needle in pb:
    pb_new = pb.replace(needle, insert + needle, 1)
else:
    # Fallback: append at end of mapping section
    pb_new = pb + "\n" + insert

print(f"Old size: {len(pb)} | New size: {len(pb_new)}")
print("Writing patched playbook back...")

result = subprocess.run(
    ["manus-config", "schedule", "update", "--playbook", pb_new],
    capture_output=True, text=True
)
print(result.stdout[-500:])
if result.returncode != 0:
    print("STDERR:", result.stderr, file=sys.stderr)
    sys.exit(result.returncode)
