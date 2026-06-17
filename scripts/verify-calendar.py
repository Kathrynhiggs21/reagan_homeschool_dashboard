#!/usr/bin/env python3
"""Search the primary calendar for [Reagan Homeschool] events 6/17-6/30 and
summarize by date. Uses an explicit result path so we always read the right file."""
import json, os, subprocess, tempfile, collections

result_path = tempfile.mktemp(suffix=".json", prefix="cal_verify_")
env = dict(os.environ)
env["MANUS_MCP_RESULT_PATH"] = result_path
env["MANUS_MCP_RESULT_FILEPATH"] = result_path

inp = json.dumps({
    "calendar_id": "primary",
    "time_min": "2026-06-17T00:00:00-04:00",
    "time_max": "2026-07-01T00:00:00-04:00",
    "max_results": 250,
})
subprocess.run(
    ["manus-mcp-cli", "tool", "call", "google_calendar_search_events",
     "--server", "google-calendar", "--input", inp],
    env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False,
)

with open(result_path) as fh:
    data = json.load(fh)
all_events = data.get("result", []) if isinstance(data, dict) else []
events = [e for e in all_events if str(e.get("summary", "")).startswith("[Reagan Homeschool]")]
print("(all events in window:", len(all_events), ")")
by_date = collections.Counter()
titles = collections.defaultdict(list)
for e in events:
    s = e.get("start_time") or e.get("start") or ""
    d = str(s)[:10]
    by_date[d] += 1
    titles[d].append(e.get("summary", "?"))

print("TOTAL [Reagan Homeschool] events in window:", len(events))
for d in sorted(by_date):
    print(f"  {d}: {by_date[d]}")
print("\nSample titles:")
for d in sorted(titles):
    for t in titles[d][:1]:
        print(f"  {d}  {t}")
