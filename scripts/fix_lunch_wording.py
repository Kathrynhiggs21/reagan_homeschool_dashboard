import json, subprocess

JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvcGVuSWQiOiJjUjJRazluTG1wb1hlRTdXNEZjNGlGIiwiYXBwSWQiOiJtbTNzd0dpY3RRTEhEV0tQSkNHaUhwIiwibmFtZSI6IkthdGhyeW4gSGlnZ3MiLCJleHAiOjE4MDg4OTUyNjl9.pnlm8lAcZHnr7HDxXf-P7nuijht_aBj4aoHMuvm-BTE"
BASE = "https://reaganschool.manus.space"

# Fetch the current description of the Intro block, replace lunch->break, write back.
import urllib.parse
inp = json.dumps({"0":{"json":{"startDate":"2026-06-18","endDate":"2026-06-18"}}})
enc = urllib.parse.quote(inp)
out = subprocess.check_output(["curl","-s",f"{BASE}/api/trpc/blocks.weekRange?batch=1&input={enc}","-H",f"Cookie: app_session_id={JWT}"]).decode()
blocks = json.loads(out)[0]["result"]["data"]["json"]["byDate"]["2026-06-18"]
intro = next(b for b in blocks if b["id"] == 3750001)
desc = intro["description"] or ""
new = (desc
       .replace("then after lunch we test it", "then after the break we test it")
       .replace("PREDICT before lunch:", "PREDICT before the break:")
       .replace("after lunch", "after the break")
       .replace("before lunch", "before the break"))
payload = {"id": 3750001, "description": new}
res = subprocess.check_output(["curl","-s","-X","POST",f"{BASE}/api/trpc/blocks.update?batch=1",
    "-H","Content-Type: application/json","-H",f"Cookie: app_session_id={JWT}",
    "-d", json.dumps({"0":{"json":payload}})]).decode()
print("changed:", desc != new, "->", "OK" if '"result"' in res else res[:200])
