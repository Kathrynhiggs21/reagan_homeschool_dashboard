#!/usr/bin/env python3
"""Audit every external app/resource link in the dashboard catalog.

Reads URLs from the catalog source files, performs a real HTTP check
(HEAD, falling back to GET), follows redirects, and writes a CSV with:
  url, source_file, http_status, final_url, ok, note
"""
import csv, re, os, sys, subprocess, concurrent.futures as cf
import urllib.request, urllib.error, ssl

ROOT = os.path.expanduser("~/reagan_homeschool_dashboard")
SRC = [
    "shared/practiceLinks.ts",
    "server/_lib/subjectAppLinks.ts",
    "server/_lib/practiceLibrary.ts",
    "client/src/lib/subjectFallbackActivity.ts",
    "client/src/lib/googleAuthLink.ts",
]
URL_RE = re.compile(r"https?://[a-zA-Z0-9./?=_%:&+#~-]+")

def collect():
    seen = {}
    for rel in SRC:
        p = os.path.join(ROOT, rel)
        if not os.path.exists(p):
            continue
        txt = open(p, encoding="utf-8").read()
        for m in URL_RE.findall(txt):
            u = m.rstrip('".,)`')
            # skip template/example/non-resource hosts
            if any(s in u for s in ("example.com", "localhost", "${")):
                continue
            seen.setdefault(u, rel)
    return seen

CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"

def check(u):
    for method in ("HEAD", "GET"):
        try:
            req = urllib.request.Request(u, method=method, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=15, context=CTX) as r:
                return (r.status, r.geturl(), "")
        except urllib.error.HTTPError as e:
            if method == "HEAD" and e.code in (403, 405, 501):
                continue  # retry with GET
            return (e.code, getattr(e, "url", u) or u, str(e.reason))
        except Exception as e:
            if method == "HEAD":
                continue
            return (0, u, type(e).__name__ + ": " + str(e))
    return (0, u, "unreachable")

def main():
    urls = collect()
    rows = []
    with cf.ThreadPoolExecutor(max_workers=12) as ex:
        futs = {ex.submit(check, u): u for u in urls}
        for fut in cf.as_completed(futs):
            u = futs[fut]
            status, final, note = fut.result()
            ok = 200 <= status < 400
            redirected = final.rstrip("/") != u.rstrip("/")
            rows.append({
                "url": u,
                "source_file": urls[u],
                "http_status": status,
                "final_url": final if redirected else "",
                "ok": "yes" if ok else "no",
                "note": note or ("redirected" if redirected else ""),
            })
    rows.sort(key=lambda r: (r["ok"] == "yes", r["url"]))
    out = os.path.join(ROOT, "out", "link_audit_2026-06-18.csv")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["url", "source_file", "http_status", "final_url", "ok", "note"])
        w.writeheader()
        w.writerows(rows)
    bad = [r for r in rows if r["ok"] != "yes"]
    print(f"Total: {len(rows)} | OK: {len(rows)-len(bad)} | Problem: {len(bad)}")
    print("CSV:", out)
    print("\n--- PROBLEM / REDIRECTED ---")
    for r in rows:
        if r["ok"] != "yes" or r["final_url"]:
            print(f"[{r['http_status']}] {r['url']}  ->  {r['final_url'] or r['note']}")

if __name__ == "__main__":
    main()
