import json, subprocess
JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvcGVuSWQiOiJjUjJRazluTG1wb1hlRTdXNEZjNGlGIiwiYXBwSWQiOiJtbTNzd0dpY3RRTEhEV0tQSkNHaUhwIiwibmFtZSI6IkthdGhyeW4gSGlnZ3MiLCJleHAiOjE4MDg4OTUyNjl9.pnlm8lAcZHnr7HDxXf-P7nuijht_aBj4aoHMuvm-BTE"
BASE = "http://localhost:3000"
payload = {"forDate": "2026-06-18"}
inp = json.dumps({"0": {"json": payload}})
url = f"{BASE}/api/trpc/nightlyAgenda.sendNow?batch=1"
out = subprocess.check_output([
    "curl", "-s", "--max-time", "170", "-X", "POST", url,
    "-H", "Content-Type: application/json",
    "-H", f"Cookie: app_session_id={JWT}",
    "-d", inp,
], timeout=180).decode()
print(out[:2000])
