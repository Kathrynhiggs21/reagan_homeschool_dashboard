#!/usr/bin/env python3
import json, os, subprocess, tempfile, sys

event_id = sys.argv[1] if len(sys.argv) > 1 else "1krochvnjened4c2g051qdtacc"
result_path = tempfile.mktemp(suffix=".json", prefix="get_event_")
env = dict(os.environ)
env["MANUS_MCP_RESULT_PATH"] = result_path
env["MANUS_MCP_RESULT_FILEPATH"] = result_path

inp = json.dumps({"calendar_id": "primary", "event_id": event_id})
subprocess.run(
    ["manus-mcp-cli", "tool", "call", "google_calendar_get_event",
     "--server", "google-calendar", "--input", inp],
    env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False,
)
with open(result_path) as fh:
    print(fh.read()[:1500])
