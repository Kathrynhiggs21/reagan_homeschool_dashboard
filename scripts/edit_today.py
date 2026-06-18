import json, subprocess, urllib.parse, sys

JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvcGVuSWQiOiJjUjJRazluTG1wb1hlRTdXNEZjNGlGIiwiYXBwSWQiOiJtbTNzd0dpY3RRTEhEV0tQSkNHaUhwIiwibmFtZSI6IkthdGhyeW4gSGlnZ3MiLCJleHAiOjE4MDg4OTUyNjl9.pnlm8lAcZHnr7HDxXf-P7nuijht_aBj4aoHMuvm-BTE"
BASE = "https://reaganschool.manus.space"

def call(proc, payload):
    inp = json.dumps({"0": {"json": payload}})
    url = f"{BASE}/api/trpc/{proc}?batch=1"
    out = subprocess.check_output([
        "curl", "-s", "-X", "POST", url,
        "-H", "Content-Type: application/json",
        "-H", f"Cookie: app_session_id={JWT}",
        "-d", inp,
    ]).decode()
    return out

# New plan (1:30 PM start, trimmed, ends 4:15 PM). sortOrder ascending.
# id -> {startTime, durationMin, sortOrder, (optional) title, blockType}
edits = [
    {"id": 3360003, "startTime": "13:30", "durationMin": 10, "sortOrder": 1},  # Funny clip
    {"id": 3360004, "startTime": "13:40", "durationMin": 25, "sortOrder": 2},  # Measurement overview
    {"id": 3360005, "startTime": "14:05", "durationMin": 25, "sortOrder": 3},  # Conversion intro
    {"id": 3750001, "startTime": "14:30", "durationMin": 20, "sortOrder": 4},  # Intro: Why Water Rolls Off a Duck (watch)
    {"id": 3360002, "startTime": "14:50", "durationMin": 15, "sortOrder": 5,
     "title": "Break", "blockType": "custom",
     "description": "Quick break — snack, stretch, time with the parakeets or ducks. Come back when you're ready."},  # was Lunch + reset
    {"id": 3360006, "startTime": "15:05", "durationMin": 40, "sortOrder": 6},  # 3-Duck Measurement Adventure
    {"id": 3720001, "startTime": "15:45", "durationMin": 30, "sortOrder": 7},  # Duck Hydro Lab -> ends 16:15
]

for e in edits:
    payload = {k: v for k, v in e.items()}
    res = call("blocks.update", payload)
    ok = '"result"' in res
    print(f"update id={e['id']} start={e['startTime']} dur={e['durationMin']} -> {'OK' if ok else res[:200]}")
