import json, subprocess, urllib.parse

JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvcGVuSWQiOiJjUjJRazluTG1wb1hlRTdXNEZjNGlGIiwiYXBwSWQiOiJtbTNzd0dpY3RRTEhEV0tQSkNHaUhwIiwibmFtZSI6IkthdGhyeW4gSGlnZ3MiLCJleHAiOjE4MDg4OTUyNjl9.pnlm8lAcZHnr7HDxXf-P7nuijht_aBj4aoHMuvm-BTE"
BASE = "https://reaganschool.manus.space"
DATE = "2026-06-18"

# Pull today's blocks
inp = json.dumps({"0":{"json":{"startDate":DATE,"endDate":DATE}}})
enc = urllib.parse.quote(inp)
out = subprocess.check_output(["curl","-s",f"{BASE}/api/trpc/blocks.weekRange?batch=1&input={enc}","-H",f"Cookie: app_session_id={JWT}"]).decode()
blocks = json.loads(out)[0]["result"]["data"]["json"]["byDate"][DATE]

def call(proc, payload):
    res = subprocess.check_output(["curl","-s","-X","POST",f"{BASE}/api/trpc/{proc}?batch=1",
        "-H","Content-Type: application/json","-H",f"Cookie: app_session_id={JWT}",
        "-d", json.dumps({"0":{"json":payload}})]).decode()
    return res

for b in blocks:
    title = b["title"]
    payload = {
        "date": DATE,
        "blockId": str(b["id"]),
        "title": title,
    }
    if b.get("subjectSlug"):
        payload["subjectSlug"] = b["subjectSlug"]
    if b.get("blockType"):
        payload["blockType"] = b["blockType"]
    if b.get("description"):
        payload["topicHint"] = b["description"][:1800]
    res = call("worksheets.forBlock", payload)
    try:
        d = json.loads(res)[0]["result"]["data"]["json"]
        kind = "non-academic (skip)" if d.get("nonAcademic") else f"worksheet OK (printableId={d.get('printableId')})"
    except Exception:
        kind = res[:160]
    print(f"{b['id']:>9} {title[:42]:<42} -> {kind}")
