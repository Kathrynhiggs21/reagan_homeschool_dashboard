#!/usr/bin/env node
/**
 * Drive Connector Drainer (v3.21, 2026-05-31)
 * ===========================================
 *
 * Sandbox-side helper that drains the dashboard's `drive_push_queue`
 * via the Manus `gws` Drive connector. Lives outside the project's
 * production bundle on purpose — Cloud Run doesn't have `gws` and we
 * never want production to depend on it.
 *
 * Usage (from /home/ubuntu/reagan_homeschool_dashboard):
 *
 *   pnpm drive:drain
 *
 * The script:
 *
 *   1. Reads the dashboard URL + bearer from env (DASHBOARD_URL,
 *      DASHBOARD_BEARER) or prompts for them on first run.
 *   2. Calls trpc.drive.connectorPlan to fetch the plan.
 *   3. For each row, ensures the canonical-parent / subfolder / subpath
 *      chain exists under the user's Reagan School Hub root, looks for
 *      a same-name child to skip duplicates, then uploads.
 *   4. Sends every outcome back via trpc.drive.connectorReport.
 *
 * Failure mode: each row is independent — one failure does not abort
 * the rest of the pass. Errors are reported back so the dashboard's
 * Settings card surfaces them.
 *
 * The script is deliberately ES module / Node-only, no extra npm deps.
 * It shells out to `gws` (the Manus Google Workspace CLI) which is
 * authenticated to spear.cpt@gmail.com via the Manus connector.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { argv, env, stdout, stderr, exit } from "node:process";

/* =====================================================================
   Config
   ===================================================================== */

const DASHBOARD_URL =
  env.DASHBOARD_URL ||
  argv.find((a) => a.startsWith("--url="))?.slice(6) ||
  "http://localhost:3000";
const DASHBOARD_BEARER =
  env.DASHBOARD_BEARER ||
  argv.find((a) => a.startsWith("--bearer="))?.slice(9) ||
  "";
const DRAINER_TOKEN =
  env.DRAINER_TOKEN ||
  argv.find((a) => a.startsWith("--token="))?.slice(8) ||
  "";
const PROTOCOL_VERSION = 1;
const HUB_ROOT_NAME = "Reagan School Hub (Dashboard)";

const AUTH_MODE = DRAINER_TOKEN ? "token" : DASHBOARD_BEARER ? "bearer" : null;
if (!AUTH_MODE) {
  stderr.write(
    [
      "[drainer] No auth provided. Pick one of:",
      "  • export DRAINER_TOKEN=…  (preferred — grab it from Settings → Drive Connector → Copy drain command)",
      "  • export DASHBOARD_BEARER=…  (fallback — admin session cookie value)",
    ].join("\n") + "\n",
  );
  exit(2);
}
stdout.write(`[drainer] auth mode: ${AUTH_MODE}\n`);

/* =====================================================================
   Tiny tRPC client (no extra deps; we only need two endpoints)
   ===================================================================== */

/**
 * tRPC over HTTP uses GET with `?input=<json>` for queries and POST
 * with body `{ "0": { json: <payload> } }` style for mutations. We
 * keep this small and explicit so it's debuggable.
 */
async function trpcQuery(procedure, input = undefined) {
  const url = new URL(`/api/trpc/${procedure}`, DASHBOARD_URL);
  if (input !== undefined) {
    url.searchParams.set("input", JSON.stringify({ json: input }));
  }
  const headers = { "Content-Type": "application/json" };
  if (AUTH_MODE === "bearer") {
    headers.Authorization = `Bearer ${DASHBOARD_BEARER}`;
    headers.Cookie = `__Host-msession=${DASHBOARD_BEARER}`;
  }
  const resp = await fetch(url, { headers });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`tRPC ${procedure} ${resp.status}: ${body.slice(0, 400)}`);
  }
  const data = await resp.json();
  if (data?.error) {
    throw new Error(
      `tRPC ${procedure} returned error: ${JSON.stringify(data.error).slice(0, 400)}`,
    );
  }
  return data?.result?.data?.json ?? data?.result?.data;
}

async function trpcMutation(procedure, input) {
  const url = new URL(`/api/trpc/${procedure}`, DASHBOARD_URL);
  const headers = { "Content-Type": "application/json" };
  if (AUTH_MODE === "bearer") {
    headers.Authorization = `Bearer ${DASHBOARD_BEARER}`;
    headers.Cookie = `__Host-msession=${DASHBOARD_BEARER}`;
  }
  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ json: input }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`tRPC ${procedure} ${resp.status}: ${body.slice(0, 400)}`);
  }
  const data = await resp.json();
  if (data?.error) {
    throw new Error(
      `tRPC ${procedure} returned error: ${JSON.stringify(data.error).slice(0, 400)}`,
    );
  }
  return data?.result?.data?.json ?? data?.result?.data;
}

/* =====================================================================
   gws helpers
   ===================================================================== */

function gws(method, params) {
  const args = ["drive", ...method.split(" "), "--params", JSON.stringify(params)];
  const proc = spawnSync("gws", args, {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 64,
  });
  if (proc.status !== 0) {
    const stderrTxt = proc.stderr || "";
    throw new Error(`gws ${method} failed: ${stderrTxt.slice(0, 400)}`);
  }
  const out = (proc.stdout || "").trim();
  if (!out) return null;
  try {
    return JSON.parse(out);
  } catch {
    // Some gws subcommands print a status line — return raw on parse fail.
    return { raw: out };
  }
}

/**
 * Find a non-trashed direct child of `parentId` matching `name`.
 * Returns its file metadata or null.
 *
 * Names are escaped to survive the Drive query language: only single
 * quotes need escaping with a backslash.
 */
function findChildByName(parentId, name, mimeFilter = null) {
  const safe = name.replace(/'/g, "\\'");
  const qParts = [
    `'${parentId}' in parents`,
    `name = '${safe}'`,
    `trashed = false`,
  ];
  if (mimeFilter) qParts.push(`mimeType = '${mimeFilter}'`);
  const res = gws("files list", {
    pageSize: 5,
    q: qParts.join(" and "),
    fields: "files(id,name,mimeType,md5Checksum)",
  });
  return res?.files?.[0] ?? null;
}

/**
 * Idempotent mkdir under a parent. Returns the folder ID.
 */
function ensureChildFolder(parentId, name) {
  const existing = findChildByName(
    parentId,
    name,
    "application/vnd.google-apps.folder",
  );
  if (existing) return existing.id;
  const created = gws("files create", {
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id,name",
  });
  return created.id;
}

/**
 * Resolve (or restore) one of the 9 canonical Hub roots inside the
 * "Reagan School Hub (Dashboard)" folder. If the dashboard's stored
 * canonical-parent ID is trashed, we find/create a same-named folder
 * under the Hub root instead and use that — keeps the worker self-
 * healing without forcing Mom to re-pick IDs in Settings.
 *
 * `displayName` is the canonical human name we show in Drive (e.g.
 * "Adventures and Enrichment").
 */
function resolveHubRoot(hubRootId, canonicalParentDriveId, displayName) {
  // Fast path — the stored ID exists and isn't trashed.
  if (canonicalParentDriveId) {
    try {
      const meta = gws("files get", {
        fileId: canonicalParentDriveId,
        fields: "id,name,trashed",
      });
      if (meta && !meta.trashed) return meta.id;
    } catch {
      // fall through to the rebuild path
    }
  }
  // Rebuild path — find or create by name under the Hub root.
  return ensureChildFolder(hubRootId, displayName);
}

const CANONICAL_DISPLAY_NAMES = {
  adminAndHomeschoolRecords: "Admin and Records",
  adventuresAndEnrichment: "Adventures and Enrichment",
  assignmentsAndWork: "Assignments and Work",
  curriculumAndStandards: "Curriculum and Resources",
  dailyOperations: "Daily Operations",
  inboxUnsorted: "Inbox (Unsorted)",
  printablesAndResources: "Printables",
  progressAndReports: "Progress and Reports",
  todo: "Todo",
};

/**
 * Locate the "Reagan School Hub (Dashboard)" root in the user's My
 * Drive. Created if missing. Cached for the whole drainer pass.
 */
let _hubRootIdCache = null;
function ensureHubRoot() {
  if (_hubRootIdCache) return _hubRootIdCache;
  const res = gws("files list", {
    pageSize: 5,
    q: `name = '${HUB_ROOT_NAME.replace(/'/g, "\\'")}' and 'root' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id,name)",
  });
  let id = res?.files?.[0]?.id ?? null;
  if (!id) {
    const created = gws("files create", {
      requestBody: {
        name: HUB_ROOT_NAME,
        mimeType: "application/vnd.google-apps.folder",
        parents: ["root"],
      },
      fields: "id,name",
    });
    id = created.id;
  }
  _hubRootIdCache = id;
  return id;
}

/* =====================================================================
   Per-row driver
   ===================================================================== */

function sha256Hex(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * Process one plan row. Returns a ConnectorReportOutcome.
 */
async function processRow(row, targetMap, hubRootId) {
  const map = targetMap[row.targetFolder];
  if (!map) {
    return {
      id: row.id,
      outcome: "failed",
      error: `Unknown targetFolder "${row.targetFolder}" in plan`,
    };
  }

  // Resolve canonical Hub-root parent (self-healing if trashed).
  const displayName =
    CANONICAL_DISPLAY_NAMES[map.canonicalParent] ?? map.canonicalParent;
  let parentId;
  try {
    parentId = resolveHubRoot(
      hubRootId,
      map.canonicalParentDriveId,
      displayName,
    );
  } catch (e) {
    return {
      id: row.id,
      outcome: "failed",
      error: `resolveHubRoot(${map.canonicalParent}): ${e?.message ?? e}`,
    };
  }

  // mkdir-p subfolder name (e.g. "Day Logs"), then targetSubpath segments.
  if (map.subfolderName) {
    parentId = ensureChildFolder(parentId, map.subfolderName);
  }
  if (row.targetSubpath) {
    for (const seg of String(row.targetSubpath)
      .split("/")
      .map((s) => s.trim())
      .filter(Boolean)) {
      parentId = ensureChildFolder(parentId, seg);
    }
  }

  // Skip if a same-name file already exists with a matching hash.
  let existingMatch = null;
  try {
    existingMatch = findChildByName(parentId, row.fileName);
  } catch {
    /* non-fatal */
  }

  // Materialize the bytes we're going to upload — either inline content
  // or fetched from the dashboard's storage path.
  let bytes;
  let mime = row.mimeType || "application/octet-stream";
  if (row.contentText !== null && row.contentText !== undefined) {
    bytes = Buffer.from(String(row.contentText), "utf8");
    if (!row.mimeType) mime = "text/markdown";
  } else if (row.fileKey) {
    try {
      const fileResp = await fetch(
        new URL(`/manus-storage/${row.fileKey}`, DASHBOARD_URL),
        {
          headers: {
            Authorization: `Bearer ${DASHBOARD_BEARER}`,
            Cookie: `__Host-msession=${DASHBOARD_BEARER}`,
          },
        },
      );
      if (!fileResp.ok) {
        return {
          id: row.id,
          outcome: "failed",
          error: `Failed to fetch S3 bytes (${fileResp.status}) for ${row.fileKey}`,
        };
      }
      const ab = await fileResp.arrayBuffer();
      bytes = Buffer.from(ab);
    } catch (e) {
      return {
        id: row.id,
        outcome: "failed",
        error: `Storage fetch for ${row.fileKey}: ${e?.message ?? e}`,
      };
    }
  } else {
    return {
      id: row.id,
      outcome: "failed",
      error: "Row has neither contentText nor fileKey — nothing to upload",
    };
  }

  const hash = sha256Hex(bytes);
  if (existingMatch) {
    // Same name already there; if the row has contentHash and it
    // matches what we computed, we can short-circuit as a skip.
    if (
      existingMatch.md5Checksum &&
      row.contentHash &&
      existingMatch.md5Checksum.toLowerCase() ===
        sha256Hex(bytes).slice(0, existingMatch.md5Checksum.length).toLowerCase()
    ) {
      // md5 vs sha256 don't match formats; this branch is intentionally
      // strict-by-name-only below. Keeping this here so a future cleanup
      // can replace md5 with our hash once Drive returns sha256.
    }
    if (row.contentHash && row.contentHash.toLowerCase() === hash.toLowerCase()) {
      return {
        id: row.id,
        outcome: "skipped",
        reason: `Already present in Drive as ${existingMatch.id} (matching contentHash)`,
        driveFileId: existingMatch.id,
      };
    }
    return {
      id: row.id,
      outcome: "skipped",
      reason: `A file named "${row.fileName}" already exists at ${existingMatch.id} — skipping to avoid Drive's auto-rename. If this is wrong, rename or delete the existing file in Drive.`,
      driveFileId: existingMatch.id,
    };
  }

  // Upload via gws files create with a temp file (gws expects a path).
  const tmp = join(tmpdir(), `drive-drain-${row.id}-${Date.now()}`);
  writeFileSync(tmp, bytes);
  try {
    const created = gws("files create", {
      requestBody: { name: row.fileName, parents: [parentId], mimeType: mime },
      media_body: tmp,
      media_mime_type: mime,
      fields: "id,name,size",
    });
    return {
      id: row.id,
      outcome: "pushed",
      driveFileId: created.id,
      bytes: bytes.length,
    };
  } catch (e) {
    return {
      id: row.id,
      outcome: "failed",
      error: `gws upload: ${e?.message ?? e}`,
    };
  } finally {
    try {
      if (existsSync(tmp)) unlinkSync(tmp);
    } catch {
      /* non-fatal */
    }
  }
}

/* =====================================================================
   Main
   ===================================================================== */

async function main() {
  stdout.write(`[drainer] dashboard=${DASHBOARD_URL}\n`);

  const plan = await (AUTH_MODE === "token"
    ? trpcQuery("drive.connectorPlanWithToken", { token: DRAINER_TOKEN, limit: 100 })
    : trpcQuery("drive.connectorPlan", { limit: 100 }));
  if (!plan || plan.protocolVersion !== PROTOCOL_VERSION) {
    throw new Error(
      `Plan protocolVersion mismatch — drainer is v${PROTOCOL_VERSION}, server returned v${plan?.protocolVersion}.`,
    );
  }
  stdout.write(`[drainer] plan: ${plan.rows.length} pending row(s)\n`);
  if (plan.rows.length === 0) {
    stdout.write("[drainer] queue is empty — nothing to do.\n");
    return;
  }

  const hubRootId = ensureHubRoot();
  stdout.write(`[drainer] hub root: ${hubRootId}\n`);

  const results = [];
  let pushed = 0;
  let skipped = 0;
  let failed = 0;
  for (const row of plan.rows) {
    const out = await processRow(row, plan.targetMap, hubRootId);
    results.push(out);
    if (out.outcome === "pushed") pushed += 1;
    else if (out.outcome === "skipped") skipped += 1;
    else failed += 1;
    stdout.write(
      `[drainer] #${row.id} (${row.targetFolder}) ${out.outcome}${
        out.outcome === "pushed" ? ` driveFileId=${out.driveFileId}` : ""
      }${out.outcome === "failed" ? ` error=${out.error}` : ""}${
        out.outcome === "skipped" ? ` reason=${out.reason}` : ""
      }\n`,
    );
  }

  const reportProc =
    AUTH_MODE === "token" ? "drive.connectorReportWithToken" : "drive.connectorReport";
  const reportBody = AUTH_MODE === "token" ? { token: DRAINER_TOKEN } : {};
  await trpcMutation(reportProc, {
    ...reportBody,
    protocolVersion: PROTOCOL_VERSION,
    finishedAtISO: new Date().toISOString(),
    byUser: env.USER || "sandbox",
    results,
  });

  stdout.write(
    `[drainer] done — pushed=${pushed} skipped=${skipped} failed=${failed} total=${results.length}\n`,
  );
}

main().catch((e) => {
  stderr.write(`[drainer] fatal: ${e?.message ?? e}\n`);
  exit(1);
});
