import json, subprocess, urllib.parse, sys

JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvcGVuSWQiOiJjUjJRazluTG1wb1hlRTdXNEZjNGlGIiwiYXBwSWQiOiJtbTNzd0dpY3RRTEhEV0tQSkNHaUhwIiwibmFtZSI6IkthdGhyeW4gSGlnZ3MiLCJleHAiOjE4MDg4OTUyNjl9.pnlm8lAcZHnr7HDxXf-P7nuijht_aBj4aoHMuvm-BTE"
date = sys.argv[1] if len(sys.argv) > 1 else "2026-06-18"
inp = json.dumps({"0":{"json":{"startDate":date,"endDate":date}}})
enc = urllib.parse.quote(inp)
url = f"https://reaganschool.manus.space/api/trpc/blocks.weekRange?batch=1&input={enc}"
out = subprocess.check_output(["curl","-s",url,"-H",f"Cookie: app_session_id={JWT}"]).decode()
data = json.loads(out)
blocks = data[0]["result"]["data"]["json"]["byDate"].get(date, [])
blocks.sort(key=lambda b: (b.get("startTime") or "", b.get("sortOrder") or 0))
print(f"PLAN for {date}: {len(blocks)} blocks")
print(f"{'id':>9} {'start':>6} {'min':>4} {'type':<16} {'subj':<10} title")
for b in blocks:
    print(f"{b['id']:>9} {str(b.get('startTime')):>6} {str(b.get('durationMin')):>4} {str(b.get('blockType')):<16} {str(b.get('subjectSlug')):<10} {b.get('title')}")
