/**
 * Drive Drainer Contract Test (v3.26, 2026-05-31)
 * ================================================
 *
 * Locks in the v3.25 fix for the gws --params vs --json bug.
 *
 * Background: in v3.21–v3.24, `ensureChildFolder` and `ensureHubRoot`
 * inside `scripts/drive-connector-drainer.mjs` passed folder metadata
 * wrapped in `requestBody` through the `params` arg to the `gws` helper,
 * which forwarded it as `--params '{"requestBody":{...}}'` to the `gws`
 * CLI. `gws` silently ignored the unknown `requestBody` property and
 * created a 0-byte file literally named "Untitled" at the user's Drive
 * root (no name, no mimeType, no parents from the dropped body). The
 * drainer then used that file's ID as `parentId` for the next step,
 * surfacing as the cryptic "The specified parent is not a folder" error.
 *
 * This single bug caused:
 *   - The 182 "Untitled" leaked files at Mom's Drive root (v3.23)
 *   - The 63 "specified parent is not a folder" failures (v3.24)
 *
 * The v3.25 fix routes folder metadata through `--json` instead of
 * `--params`. This contract test asserts on the literal source of the
 * drainer to prevent silent regression.
 *
 * We test against the file as text (not via import) because the drainer
 * is intentionally a stand-alone .mjs script outside the Cloud Run
 * bundle — it depends on the local `gws` binary which production does
 * not have. A unit-import would force a refactor that's worse for
 * separation of concerns. A source-shape contract test is sufficient
 * because the regression we care about is structural: the wrong arg
 * shape compiles fine and only fails at runtime.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DRAINER_PATH = resolve(
  import.meta.dirname,
  "..",
  "scripts",
  "drive-connector-drainer.mjs",
);

function loadDrainerSource(): string {
  return readFileSync(DRAINER_PATH, "utf8");
}

describe("drive-connector-drainer.mjs — gws --json contract (v3.25 lock-in)", () => {
  it("uses --json (not --params with requestBody) for ensureChildFolder folder-create calls", () => {
    const src = loadDrainerSource();

    // The fix is: any call to gws("files create", ...) that creates a
    // *folder* (mimeType application/vnd.google-apps.folder) must pass
    // its metadata via { json: {...} } — never via { requestBody: ... }
    // and never inside the first `params` arg.

    // Anti-pattern 1: a `requestBody: {` literal anywhere in the file.
    // The whole point of the v3.25 fix is that we never wrap metadata
    // this way again.
    expect(
      src,
      "drainer must not contain `requestBody:` (the v3.21–v3.24 bug shape)",
    ).not.toMatch(/\brequestBody\s*:/);

    // Positive assertion: ensureChildFolder must call gws("files create", ..., { json: { ... } })
    // We grep for the exact gws call inside ensureChildFolder.
    const ensureChildFolderMatch = src.match(
      /function ensureChildFolder\(parentId, name\)\s*\{[\s\S]*?\n\}/,
    );
    expect(
      ensureChildFolderMatch,
      "ensureChildFolder must exist as a named function",
    ).not.toBeNull();
    const body = ensureChildFolderMatch![0];

    // Must call gws with the 3-arg form (method, params, opts) and the
    // opts must contain `json:` with the folder metadata.
    expect(
      body,
      "ensureChildFolder must call gws with opts.json containing the folder metadata",
    ).toMatch(/gws\(\s*["']files create["'][\s\S]*?json\s*:\s*\{[\s\S]*?mimeType\s*:\s*["']application\/vnd\.google-apps\.folder["']/);

    // Must explicitly pass `parents:` — Drive will park files in the
    // root if parents are missing, which is exactly what caused the
    // Untitled leaks.
    expect(
      body,
      "ensureChildFolder must pass parents:[parentId] in the json body",
    ).toMatch(/json\s*:\s*\{[\s\S]*?parents\s*:\s*\[parentId\]/);
  });

  it("uses --json (not --params with requestBody) for ensureHubRoot folder-create calls", () => {
    const src = loadDrainerSource();

    // The function we care about is `ensureHubRoot` — the one that
    // *creates* the Hub root folder when missing. `resolveHubRoot`
    // (defined separately) only resolves canonical-parent IDs and
    // doesn't create the top-level root.
    // We use a balanced-brace scan instead of a non-greedy regex
    // because the function body contains nested braces (try/catch,
    // option literals).
    const startIdx = src.indexOf("function ensureHubRoot(");
    expect(startIdx, "ensureHubRoot must exist as a named function").toBeGreaterThan(-1);
    let depth = 0;
    let i = src.indexOf("{", startIdx);
    let endIdx = -1;
    for (; i < src.length; i += 1) {
      const ch = src[i];
      if (ch === "{") depth += 1;
      else if (ch === "}") {
        depth -= 1;
        if (depth === 0) { endIdx = i; break; }
      }
    }
    expect(endIdx, "ensureHubRoot body must be brace-balanced").toBeGreaterThan(startIdx);
    const body = src.slice(startIdx, endIdx + 1);

    // Hub root creation (the fallback path when we can't resolve an
    // existing Hub root) must use --json with parents:["root"].
    expect(
      body,
      "Hub root creation must pass metadata via opts.json with parents:['root']",
    ).toMatch(/json\s*:\s*\{[\s\S]*?parents\s*:\s*\[\s*["']root["']\s*\]/);

    expect(
      body,
      "Hub root creation must specify the folder mimeType in the json body",
    ).toMatch(/json\s*:\s*\{[\s\S]*?mimeType\s*:\s*["']application\/vnd\.google-apps\.folder["']/);
  });

  it("gws helper translates opts.json to the --json CLI flag (not --params)", () => {
    const src = loadDrainerSource();

    const gwsHelperMatch = src.match(
      /function gws\([^)]*\)\s*\{[\s\S]*?\n\}/,
    );
    expect(gwsHelperMatch, "gws helper must exist").not.toBeNull();
    const body = gwsHelperMatch![0];

    // The helper must push "--json" as a CLI arg when opts.json is set.
    // Without this translation, the json metadata is silently dropped.
    expect(
      body,
      "gws helper must push --json with JSON.stringify(opts.json) when opts.json is set",
    ).toMatch(/args\.push\(\s*["']--json["']\s*,\s*JSON\.stringify\(opts\.json\)\s*\)/);

    // And `--params` must still go through JSON.stringify(params), not
    // mix with body data.
    expect(
      body,
      "gws helper must push --params with JSON.stringify(params)",
    ).toMatch(/["']--params["']\s*,\s*JSON\.stringify\(params\)/);
  });

  it("includes a v3.25 explanatory comment so future readers understand why --json matters", () => {
    const src = loadDrainerSource();

    // The v3.25 comment block is the institutional memory of this bug.
    // If someone deletes it, future devs may refactor it away.
    expect(
      src,
      "drainer must retain the v3.25 comment explaining the --json vs --params bug",
    ).toMatch(/v3\.25[\s\S]{0,400}--json/);
    expect(
      src,
      "drainer must retain the explanation that the wrong shape created an Untitled file at root",
    ).toMatch(/Untitled[\s\S]{0,200}root/i);
  });
});
