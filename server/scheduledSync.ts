import type { Express, Request, Response } from "express";
import * as db from "./db";
import { sdk } from "./_core/sdk";
import { ENV } from "./_core/env";
import { buildDayLogMarkdown, dayLogFileName, dayLogSubpath } from "./_lib/dayLogBuilder";
import { buildDailyMomBriefing } from "./_lib/dailyMomBriefing";
import { drivePushQueue } from "../drizzle/schema";
import { and, eq } from "drizzle-orm";

/** Build the HTML email body for the 7am Morning Brief. */
export function renderMorningBriefHtml(
  forDate: string,
  data: { date?: string; have_to_do?: any[]; optional?: any[]; extra?: any[] },
): string {
  const fmt = (iso: string) => {
    try {
      const d = new Date(iso + "T12:00:00Z");
      return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    } catch { return iso; }
  };
  const esc = (s: any) => String(s ?? "").replace(/[&<>\"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" } as any)[c]);
  const section = (title: string, color: string, items: any[]) => {
    if (!items || items.length === 0) {
      return `<div style="margin:20px 0;padding:14px 16px;border-left:4px solid ${color};background:#fafafa;border-radius:8px;"><div style="font-weight:700;color:${color};font-size:15px;">${esc(title)}</div><div style="color:#777;font-size:13px;margin-top:6px;">Nothing in this bucket today.</div></div>`;
    }
    const rows = items.map((it: any) => {
      const link = it.sourceUrl ? `<a href="${esc(it.sourceUrl)}" style="color:#0a66c2;text-decoration:none;">Open &rarr;</a>` : "";
      const meta = [it.source, it.estMinutes ? `~${it.estMinutes} min` : null, it.coinReward ? `${it.coinReward} Kiwi Coins` : null].filter(Boolean).join(" &middot; ");
      const desc = it.description ? `<div style="color:#444;font-size:13px;margin-top:4px;">${esc(it.description)}</div>` : "";
      return `<div style="padding:10px 0;border-bottom:1px solid #eee;"><div style="font-weight:600;color:#222;font-size:14px;">${esc(it.title)}</div><div style="color:#888;font-size:12px;margin-top:2px;">${esc(meta)}</div>${desc}<div style="margin-top:6px;font-size:13px;">${link}</div></div>`;
    }).join("");
    return `<div style="margin:20px 0;padding:14px 16px;border-left:4px solid ${color};background:#fafafa;border-radius:8px;"><div style="font-weight:700;color:${color};font-size:15px;margin-bottom:6px;">${esc(title)} (${items.length})</div>${rows}</div>`;
  };
  return `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#222;max-width:680px;margin:0 auto;padding:20px;">
<div style="text-align:center;margin-bottom:8px;"><div style="font-size:22px;font-weight:800;color:#1f3a2e;">Reagan&rsquo;s Morning Brief</div><div style="color:#666;font-size:14px;">${esc(fmt(forDate))}</div></div>
${section("Have-to-do", "#c0392b", data.have_to_do ?? [])}
${section("Optional", "#2e86de", data.optional ?? [])}
${section("Extras", "#27ae60", data.extra ?? [])}
<div style="margin-top:24px;color:#888;font-size:12px;text-align:center;">School-day work only &middot; No homework &middot; Picked from free, kid-safe sources</div>
</body></html>`;
}

/**
 * Endpoint the daily Manus scheduled task POSTs to with already-classified items
 * pulled from Gmail / Google Drive. The scheduled-task agent has the Google
 * scopes; the deployed site is just the persistence target.
 *
 * Auth model: requires the platform-injected SCHEDULED_TASK_COOKIE
 * (`app_session_id=...`). The platform issues role="user" for scheduled-task
 * sessions; manual parent calls hit it as role="admin". Anonymous callers are
 * rejected so no random internet POST can write into Reagan's data.
 *
 * Body shape:
 * {
 *   source: "gmail" | "drive" | "both",
 *   triggeredBy?: "schedule" | "parent",
 *   items: [
 *     { kind: "email", subject, bodyText, senderEmail, senderName?, receivedAt? },
 *     { kind: "file", fileUrl, fileName, mimeType, note? },
 *     { kind: "link", url, title?, note? },
 *     { kind: "text", text, subject?, sender? },
 *   ],
 *   pendingRequestIds?: number[],  // sync_requests rows the run is consuming
 *   errors?: string[]
 * }
 */
/* ===========================================================
 * Shared Drive-mirror ("Job B") handlers.
 *
 * These four handler bodies back BOTH route surfaces:
 *   1. /api/scheduled/*       — reachable ONLY by the platform cron gateway
 *                                (carries the injected scheduled-task identity).
 *   2. /api/admin/drive-mirror/* — reachable by an admin user-session cookie,
 *                                so Mom can run Job B manually from the playbook.
 *
 * The Manus platform gateway hard-restricts the /api/scheduled/* prefix to cron
 * callers (a nonexistent /api/scheduled/* path also 403s with "permission error
 * for cron cookie" — the request never reaches Express). So a user cookie can
 * never hit the /api/scheduled/* copies; the /api/admin/* copies exist purely so
 * an authenticated admin can drive the same idempotent work by hand.
 *
 * Extracted 2026-06-02 (v3.29). Bodies are byte-identical to the original inline
 * /api/scheduled/* handlers — only the surrounding auth gate differs per surface.
 * =========================================================== */

/**
 * Strict admin-only gate for the /api/admin/* mirror surface. Returns true when
 * the caller holds an admin user-session cookie; otherwise writes a 403 and
 * returns false. Stricter than the cron gate (which also allows role==="user").
 */
export async function requireAdminSession(req: Request, res: Response): Promise<boolean> {
  let role: string | null = null;
  try {
    const u = await sdk.authenticateRequest(req);
    role = u?.role ?? null;
  } catch {
    role = null;
  }
  if (role !== "admin") {
    res.status(403).json({ ok: false, error: "Admin session required" });
    return false;
  }
  return true;
}

/** GET handler body for drive-push/pending. Lists up to 100 pending queue rows,
 * each enriched with its canonical-parent folder id + subfolder name. */
export async function drivePushPendingHandler(_req: Request, res: Response) {
  try {
    const rows = await db.listPendingDrivePushes(100);
    // Enrich each row with the canonical-parent folder id so the worker
    // can write the file directly under one of the 9 canonical top-level
    // folders without rediscovering the structure (added 2026-05-12).
    const items = await Promise.all(
      rows.map(async (row: any) => {
        let canonicalParentSlug: string | null = null;
        let canonicalParentFolderId: string | null = null;
        let subfolderName: string | null = null;
        try {
          const target = (row.targetFolder ?? row.target_folder) as any;
          if (target) {
            const parent = await db.getCanonicalParentForRoutable(target);
            canonicalParentSlug = parent.slug;
            canonicalParentFolderId = parent.folderId;
            subfolderName = (db.DRIVE_FOLDER_NAMES as any)[target] ?? null;
          }
        } catch {
          // best-effort enrichment; never fail the whole list because of one row
        }
        return {
          ...row,
          canonicalParentSlug,
          canonicalParentFolderId,
          subfolderName,
        };
      }),
    );
    return res.json({ ok: true, count: items.length, items });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
}

/** POST handler body for drive-push/result. Marks one queue row pushed/skipped/failed. */
export async function drivePushResultHandler(req: Request, res: Response) {
  try {
    const { id, status, driveFileId, errorMessage } = req.body ?? {};
    if (typeof id !== "number" || !status) {
      return res.status(400).json({ ok: false, error: "Expected { id, status, driveFileId?, errorMessage? }" });
    }
    const valid = ["pushed", "skipped", "failed"] as const;
    if (!valid.includes(status)) {
      return res.status(400).json({ ok: false, error: "status must be pushed|skipped|failed" });
    }
    await db.markDrivePushResult({
      id,
      status,
      driveFileId: driveFileId ?? null,
      errorMessage: errorMessage ?? null,
    });
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
}

/** GET handler body for drive-folder-map. Returns the canonical hub root id, the
 * 9 canonical top-level folder ids, and the canonical subfolder names per parent. */
export async function driveFolderMapHandler(_req: Request, res: Response) {
  try {
    const rootFolderId = await db.getAppSetting("drive.rootFolderId");
    const rootFolderOwner = await db.getAppSetting("drive.rootFolderOwner");
    const topLevel: Record<string, { id: string | null; subfolders: string[] }> = {
      "Admin and Homeschool Records": {
        id: await db.getAppSetting("drive.folder.adminAndHomeschoolRecords"),
        subfolders: [
          "IEP Snapshots (preserved)",
          "504 Plans (preserved)",
          "Tutor Agreements",
          "Annual Notice of Intent",
          "PowerSchool Snapshot (read-only)",
          "Reagan Health (medical, IEP, 504, anxiety timeline)",
          "Behavior History (preserved)",
        ],
      },
      "Adventures and Enrichment": {
        id: await db.getAppSetting("drive.folder.adventuresAndEnrichment"),
        subfolders: [
          "Adventures Library",
          "Field Trip Photos",
          "Reading Journal (Bookshelf log)",
        ],
      },
      "Assignments and Work": {
        id: await db.getAppSetting("drive.folder.assignmentsAndWork"),
        subfolders: [
          "Worksheets to Do",
          "Submitted Work",
          "Photos of Work",
        ],
      },
      "Curriculum and Standards": {
        id: await db.getAppSetting("drive.folder.curriculumAndStandards"),
        subfolders: [
          "Topics Covered",
          "Coverage Snapshots",
          "Standards Library",
        ],
      },
      "Daily Operations": {
        id: await db.getAppSetting("drive.folder.dailyOperations"),
        subfolders: [
          "Day Logs",
          "Daily Agenda PDFs",
          "Recap Replies",
        ],
      },
      "Inbox (Unsorted)": {
        id: await db.getAppSetting("drive.folder.inboxUnsorted"),
        subfolders: [],
      },
      "Printables and Resources": {
        id: await db.getAppSetting("drive.folder.printablesAndResources"),
        subfolders: [
          "Coloring Pages",
          "Reward Charts",
          "Master Worksheet Library",
          "Reagan's Books (cover scans + page refs)",
        ],
      },
      "Progress and Reports": {
        id: await db.getAppSetting("drive.folder.progressAndReports"),
        subfolders: [
          "Weekly Digests",
          "Term Summaries",
          "Behavior + Mood Timeline",
          "Absences and Sick Days",
          "Analytics CSV Exports",
        ],
      },
      "Todo": {
        id: await db.getAppSetting("drive.folder.todo"),
        subfolders: [
          "Mom Todos",
          "Grandma Todos",
          "Tutor Todos",
        ],
      },
    };
    return res.json({ ok: true, rootFolderId, rootFolderOwner, topLevel });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
}

/** POST handler body for drive-folder-map/result. Caches resolved subfolder ids
 * as app_settings['drive.folderMap.<parent>.<sub>']. */
export async function driveFolderMapResultHandler(req: Request, res: Response) {
  try {
    const entries = (req.body?.entries ?? []) as Array<{ parentName?: string; subfolderName?: string; driveFolderId?: string }>;
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ ok: false, error: "Expected { entries: [{ parentName, subfolderName, driveFolderId }, ...] }" });
    }
    let saved = 0;
    for (const e of entries) {
      if (!e.parentName || !e.subfolderName || !e.driveFolderId) continue;
      const slugParent = e.parentName.replace(/[^A-Za-z0-9]+/g, "_");
      const slugSub = e.subfolderName.replace(/[^A-Za-z0-9]+/g, "_");
      await db.setAppSetting(`drive.folderMap.${slugParent}.${slugSub}`, e.driveFolderId);
      saved++;
    }
    return res.json({ ok: true, saved });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
}

export function registerScheduledSync(app: Express) {
  app.post("/api/scheduled/upload-sync", async (req: Request, res: Response) => {
    // ---- Auth gate: must be a logged-in platform session (scheduled task or parent) ----
    let role: string | null = null;
    try {
      const u = await sdk.authenticateRequest(req);
      role = u?.role ?? null;
    } catch {
      role = null;
    }
    if (!role || (role !== "user" && role !== "admin")) {
      return res.status(401).json({ ok: false, error: "Unauthorized — scheduled-task cookie required." });
    }

    try {
      const { source, items, triggeredBy, errors } = req.body ?? {};

      if (!source || !Array.isArray(items)) {
        return res.status(400).json({ ok: false, error: "Expected { source, items[] }" });
      }
      if (!["gmail", "drive", "both"].includes(source)) {
        return res.status(400).json({ ok: false, error: "source must be gmail|drive|both" });
      }

      const run = await db.startSyncRun({ source, triggeredBy: triggeredBy || "schedule" });
      let routed = 0;
      let skipped = 0;
      const itemResults: Array<{ externalId: string; routedTo: string; recordId: number; message: string }> = [];

      for (const raw of items) {
        const externalId = String(raw.externalId ?? raw.fileUrl ?? raw.url ?? `${Date.now()}-${routed + skipped}`);
        try {
          // Dedupe: if we've already seen this externalId in a previous run, skip it.
          const seen = await db.findSyncItemByExternalId(externalId);
          if (seen) {
            skipped += 1;
            continue;
          }
          const result = await db.classifyAndRoute(raw);
          await db.appendSyncRunItem({
            runId: run.id,
            source: raw.kind === "email" ? "gmail" : source === "both" ? "drive" : (source as "gmail" | "drive"),
            externalId,
            routedTo: result.routedTo,
            recordId: result.recordId,
            title: raw.subject ?? raw.title ?? raw.fileName ?? null,
            message: result.message,
          });
          itemResults.push({ externalId, routedTo: result.routedTo, recordId: result.recordId, message: result.message });
          routed += 1;
        } catch (e: any) {
          skipped += 1;
        }
      }

      await db.finishSyncRun({
        runId: run.id,
        itemsScanned: items.length,
        itemsRouted: routed,
        itemsSkipped: skipped,
        errors: Array.isArray(errors) && errors.length ? errors.join("\n") : null,
      });

      return res.json({
        ok: true,
        runId: run.id,
        itemsScanned: items.length,
        itemsRouted: routed,
        itemsSkipped: skipped,
        items: itemResults,
      });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e?.message ?? String(e) });
    }
  });

  /** Read endpoint the scheduled-task agent calls before running, to learn
   *  which sources / lookback windows the parent has manually requested. */
  app.get("/api/scheduled/upload-sync/pending", async (req: Request, res: Response) => {
    let role: string | null = null;
    try {
      const u = await sdk.authenticateRequest(req);
      role = u?.role ?? null;
    } catch {
      role = null;
    }
    if (!role || (role !== "user" && role !== "admin")) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    try {
      const pending = await db.popPendingSyncRequests();
      return res.json({ ok: true, pending });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e?.message ?? String(e) });
    }
  });

  /**
   * Weekly digest endpoint. The Sunday 7 PM scheduled task hits this to:
   * 1. GET (or compute via preview) the latest digest payload
   * 2. POST to record that it was emailed (with status)
   *
   * GET  /api/scheduled/weekly-digest        → returns fresh payload + saves a row
   * POST /api/scheduled/weekly-digest/sent   → marks a digest as emailed
   */
  app.get("/api/scheduled/weekly-digest", async (req: Request, res: Response) => {
    let role: string | null = null;
    try {
      const u = await sdk.authenticateRequest(req);
      role = u?.role ?? null;
    } catch {
      role = null;
    }
    if (!role || (role !== "user" && role !== "admin")) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    try {
      const payload = await db.buildWeeklyDigestPayload();
      const id = await db.saveWeeklyDigest(payload);
      return res.json({ ok: true, digestId: id, payload });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e?.message ?? String(e) });
    }
  });

  app.post("/api/scheduled/weekly-digest/sent", async (req: Request, res: Response) => {
    let role: string | null = null;
    try {
      const u = await sdk.authenticateRequest(req);
      role = u?.role ?? null;
    } catch {
      role = null;
    }
    if (!role || (role !== "user" && role !== "admin")) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    try {
      const { digestId, status } = req.body ?? {};
      if (typeof digestId !== "number") {
        return res.status(400).json({ ok: false, error: "Expected { digestId, status }" });
      }
      await db.markDigestEmailed(digestId, status === "failed" ? "failed" : "sent");
      return res.json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e?.message ?? String(e) });
    }
  });

  /**
   * Drive auto-push endpoints. The daily 6:30 AM scheduled task hits these to mirror
   * uploaded files into the right Reagan/IHES Google Drive subfolder.
   *
   * GET  /api/scheduled/drive-push/pending  → returns up to 100 pending queue rows
   * POST /api/scheduled/drive-push/result   → marks one row { id, status, driveFileId?, errorMessage? }
   */
  app.get("/api/scheduled/drive-push/pending", async (req: Request, res: Response) => {
    let role: string | null = null;
    try {
      const u = await sdk.authenticateRequest(req);
      role = u?.role ?? null;
    } catch {
      role = null;
    }
    if (!role || (role !== "user" && role !== "admin")) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    return drivePushPendingHandler(req, res);
  });

  app.post("/api/scheduled/drive-push/result", async (req: Request, res: Response) => {
    let role: string | null = null;
    try {
      const u = await sdk.authenticateRequest(req);
      role = u?.role ?? null;
    } catch {
      role = null;
    }
    if (!role || (role !== "user" && role !== "admin")) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    return drivePushResultHandler(req, res);
  });

  /**
   * GET /api/scheduled/drive-folder-map
   *
   * Contract for the external Drive worker: returns the canonical hub root id,
   * the 9 canonical top-level folder ids (already established in spear.cpt's
   * Drive on 2026-05-12), and the canonical SUBFOLDER names the dashboard
   * wants under each. The worker is expected to:
   *   1. Read this once per cron tick.
   *   2. List children of each top-level folder.
   *   3. For any canonical subfolder name that is missing, CREATE it.
   *   4. POST resolved {parentName, subfolderName, driveFolderId} tuples
   *      back to /api/scheduled/drive-folder-map/result so we cache them in
   *      app_settings['drive.folderMap.<parent>.<sub>'].
   *
   * The worker MUST NEVER recreate the 9 top-level folders — those ids are
   * fixed and editing/duplicating them would break every existing reference.
   */
  app.get("/api/scheduled/drive-folder-map", async (req: Request, res: Response) => {
    let role: string | null = null;
    try {
      const u = await sdk.authenticateRequest(req);
      role = u?.role ?? null;
    } catch {
      role = null;
    }
    if (!role || (role !== "user" && role !== "admin")) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    return driveFolderMapHandler(req, res);
  });

  /**
   * POST /api/scheduled/drive-folder-map/result
   *
   * Worker reports back the resolved subfolder ids it discovered or created.
   * Body: { entries: Array<{ parentName, subfolderName, driveFolderId }> }
   * We cache each as app_settings['drive.folderMap.<parent>.<sub>'].
   */
  app.post("/api/scheduled/drive-folder-map/result", async (req: Request, res: Response) => {
    let role: string | null = null;
    try {
      const u = await sdk.authenticateRequest(req);
      role = u?.role ?? null;
    } catch {
      role = null;
    }
    if (!role || (role !== "user" && role !== "admin")) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    return driveFolderMapResultHandler(req, res);
  });

  /* ===========================================================
   * /api/admin/drive-mirror/* — admin-cookie-runnable mirror of the four Job B
   * endpoints above. The platform gateway blocks /api/scheduled/* for non-cron
   * callers, so these admin-prefixed routes are the ONLY way for Mom to run
   * Job B by hand (e.g. from the nightly playbook). Each route is gated by
   * requireAdminSession (role==="admin" only) then delegates to the exact same
   * idempotent handler the cron path uses.
   *
   * Added 2026-06-02 (v3.29). Do NOT relax requireAdminSession to allow
   * role==="user" — the cron gate intentionally protects Reagan's queue, and
   * this surface is reachable from the open internet.
   * =========================================================== */
  app.get("/api/admin/drive-mirror/folder-map", async (req: Request, res: Response) => {
    if (!(await requireAdminSession(req, res))) return;
    return driveFolderMapHandler(req, res);
  });
  app.post("/api/admin/drive-mirror/folder-map/result", async (req: Request, res: Response) => {
    if (!(await requireAdminSession(req, res))) return;
    return driveFolderMapResultHandler(req, res);
  });
  app.get("/api/admin/drive-mirror/pending", async (req: Request, res: Response) => {
    if (!(await requireAdminSession(req, res))) return;
    return drivePushPendingHandler(req, res);
  });
  app.post("/api/admin/drive-mirror/result", async (req: Request, res: Response) => {
    if (!(await requireAdminSession(req, res))) return;
    return drivePushResultHandler(req, res);
  });

  /* ====================== CLASSROOM-AGENDAS (daily teacher sync) ====================== */
  // GET  /api/scheduled/classroom-agendas/pending
  // Returns the dates (last 7 days) for which we are still missing agendas.
  app.get("/api/scheduled/classroom-agendas/pending", async (req: Request, res: Response) => {
    let role: string | null = null;
    try {
      const u = await sdk.authenticateRequest(req);
      role = u?.role ?? null;
    } catch {
      role = null;
    }
    if (!role || (role !== "user" && role !== "admin")) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    try {
      const gaps = await db.listAgendaHydrationGaps(7);
      const recent = await db.listRecentClassroomAgendas(10);
      return res.json({ ok: true, gaps, recentCount: recent.length });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e?.message ?? String(e) });
    }
  });

  // POST /api/scheduled/classroom-agendas/result
  // Body: { items: Array<{ agendaDate, teacher?, course?, subjectSlug?, school?, term?, source, rawText?, topics?, assignments?, sourceUrl?, imageKey?, standalonePdfKey? }> }
  app.post("/api/scheduled/classroom-agendas/result", async (req: Request, res: Response) => {
    let role: string | null = null;
    try {
      const u = await sdk.authenticateRequest(req);
      role = u?.role ?? null;
    } catch {
      role = null;
    }
    if (!role || (role !== "user" && role !== "admin")) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    try {
      const { items } = req.body ?? {};
      if (!Array.isArray(items)) {
        return res.status(400).json({ ok: false, error: "Expected { items: [] }" });
      }
      let inserted = 0, skipped = 0;
      for (const raw of items) {
        if (!raw?.agendaDate || !raw?.source) {
          skipped++;
          continue;
        }
        const existing = await db.findClassroomAgenda(
          raw.agendaDate,
          raw.teacher ?? null,
          raw.course ?? null,
        );
        if (existing) {
          skipped++;
          continue;
        }
        await db.insertClassroomAgenda({
          agendaDate: raw.agendaDate,
          teacher: raw.teacher ?? null,
          course: raw.course ?? null,
          subjectSlug: raw.subjectSlug ?? null,
          school: raw.school ?? "indian_hill",
          term: raw.term ?? null,
          source: raw.source,
          sourceUrl: raw.sourceUrl ?? null,
          imageKey: raw.imageKey ?? null,
          rawText: raw.rawText ?? null,
          topics: Array.isArray(raw.topics) ? raw.topics : null,
          assignments: Array.isArray(raw.assignments) ? raw.assignments : null,
          standalonePdfKey: raw.standalonePdfKey ?? null,
        });
        inserted++;
      }
      return res.json({ ok: true, inserted, skipped });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e?.message ?? String(e) });
    }
  });

  /* ====================== IEP REFRESH (vision+LLM extraction) ====================== */
  // GET  /api/scheduled/iep-refresh/trigger
  // Tells the scheduled task whether a fresh IEP PDF has been uploaded since the last refresh.
  app.get("/api/scheduled/iep-refresh/trigger", async (req: Request, res: Response) => {
    let role: string | null = null;
    try {
      const u = await sdk.authenticateRequest(req);
      role = u?.role ?? null;
    } catch {
      role = null;
    }
    if (!role || (role !== "user" && role !== "admin")) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    try {
      // Version 1: we just surface goal count + latest refresh date.
      // The scheduled task agent decides (via its own Drive access) whether a new file exists.
      const goals = await db.listIepGoals();
      return res.json({
        ok: true,
        currentGoalCount: goals.length,
        needsRefresh: true, // let the daily job always check Drive; dedupe happens at /result
      });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e?.message ?? String(e) });
    }
  });

  // POST /api/scheduled/iep-refresh/result
  // Body: { source: "drive"|"vision"|"manual", rawText?, extractedGoals: [{area,goalText,presentLevel?,currentPercent?,subjectSlug?}] }
  app.post("/api/scheduled/iep-refresh/result", async (req: Request, res: Response) => {
    let role: string | null = null;
    try {
      const u = await sdk.authenticateRequest(req);
      role = u?.role ?? null;
    } catch {
      role = null;
    }
    if (!role || (role !== "user" && role !== "admin")) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    try {
      const { source, rawText, extractedGoals, notes } = req.body ?? {};
      if (!source || !Array.isArray(extractedGoals)) {
        return res.status(400).json({ ok: false, error: "Expected { source, extractedGoals[] }" });
      }
      const result = await db.recordIepRefresh({
        source,
        rawText: rawText ?? null,
        extractedGoals,
        notes,
      });
      return res.json({ ok: true, ...result });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e?.message ?? String(e) });
    }
  });

  /* ====================== MORNING BRIEF (Daily Printables) ======================
   *
   * Each morning the Manus scheduled task picks the day's printables (ranked free
   * sources, Reagan Profile Model-aware) and POSTs them here. We replace today's
   * "pending" rows for the date and return an HTML email body the scheduled task
   * then emails to spear.cpt@gmail.com and marcy.spear@gmail.com via gmail MCP.
   */
  app.post("/api/scheduled/morning-brief", async (req: Request, res: Response) => {
    let role: string | null = null;
    try {
      const u = await sdk.authenticateRequest(req);
      role = u?.role ?? null;
    } catch {
      role = null;
    }
    if (!role || (role !== "user" && role !== "admin")) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    try {
      const { forDate, items } = req.body ?? {};
      if (typeof forDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(forDate)) {
        return res.status(400).json({ ok: false, error: "Expected forDate=YYYY-MM-DD" });
      }
      if (!Array.isArray(items)) {
        return res.status(400).json({ ok: false, error: "Expected items[]" });
      }
      const n = await db.replaceDailyPrintables(forDate, items as any[]);
      const today = await db.listDailyPrintables(forDate);
      const html = renderMorningBriefHtml(forDate, today as any);
      return res.json({ ok: true, replaced: n, emailHtml: html });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e?.message ?? String(e) });
    }
  });

  /* ====================== GOOGLE CLASSROOM SYNC (reference-only) ======================
   *
   * Daily Manus scheduled task pulls Reagan's Google Classroom assignments via
   * the gws CLI (under spear.cpt@gmail.com) and POSTs them here. We upsert into
   * classroomAssignments by externalId so re-runs are idempotent.
   *
   * IHES Classroom is reference-only — the adult dashboard renders these in a
   * collapsed panel. They never auto-populate Reagan's daily plan.
   */
  app.post("/api/scheduled/classroom-sync", async (req: Request, res: Response) => {
    let role: string | null = null;
    try {
      const u = await sdk.authenticateRequest(req);
      role = u?.role ?? null;
    } catch {
      role = null;
    }
    if (!role || (role !== "user" && role !== "admin")) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    try {
      const { items } = req.body ?? {};
      if (!Array.isArray(items)) {
        return res.status(400).json({ ok: false, error: "Expected { items: […] }" });
      }
      const upsertCount = await db.upsertClassroomAssignments(items as any[]);
      return res.json({ ok: true, upserts: upsertCount });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e?.message ?? String(e) });
    }
  });
  /* ====================== ADULT ASSIGNMENTS LIBRARY IMPORT ======================
   *
   * Daily 6 AM scheduled task pulls from Reagan's IH Gmail (forwarded to
   * spear.cpt@gmail.com), Google Drive, and Google Classroom, then POSTs the
   * classified items here. We upsert by (title, dateReceived, fromSource) so
   * re-runs are safe.
   *
   * Body shape (each item):
   *   {
   *     title: string,
   *     subjectSlug?: "math"|"ela"|"reading"|"writing"|"science"|"ss"|"art"|"music"|"other",
   *     type: "worksheet"|"video"|"slideshow"|"lesson_plan"|"quiz"|"answer_key"|"project"|"app_activity"|"reading"|"other",
   *     topic?: string,
   *     fromSource: string,         // e.g. "IXL", "IH (printout)", "Khan Academy", "IH Email"
   *     ihClassroom?: boolean,
   *     dateReceived?: "YYYY-MM-DD",
   *     dateFor?: "YYYY-MM-DD",
   *     recommendedUse?: 1|2|3|4|5,
   *     sourceUrl?: string,         // page / app / website
   *     fileLink?: string,          // editable Drive copy / direct download
   *     notes?: string
   *   }
   */
  app.post("/api/scheduled/library-import", async (req: Request, res: Response) => {
    let role: string | null = null;
    try {
      const u = await sdk.authenticateRequest(req);
      role = u?.role ?? null;
    } catch {
      role = null;
    }
    if (!role || (role !== "user" && role !== "admin")) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    try {
      const { items } = req.body ?? {};
      if (!Array.isArray(items)) {
        return res.status(400).json({ ok: false, error: "Expected { items: [...] }" });
      }
      let added = 0;
      let skipped = 0;
      for (const raw of items) {
        if (!raw || typeof raw.title !== "string" || typeof raw.type !== "string") {
          skipped++;
          continue;
        }
        // Idempotency: skip if a same-title same-source same-day row exists
        const existing = await db.findExistingLibraryRow({
          title: raw.title,
          fromSource: raw.fromSource ?? "scheduled",
          dateReceived: raw.dateReceived ?? null,
        });
        if (existing) {
          skipped++;
          continue;
        }
        await db.addAssignmentLibrary({
          title: raw.title,
          subjectSlug: raw.subjectSlug ?? null,
          type: raw.type,
          topic: raw.topic ?? null,
          tags: Array.isArray(raw.tags) ? raw.tags : null,
          fromSource: raw.fromSource ?? "scheduled",
          ihClassroom: !!raw.ihClassroom,
          dateReceived: raw.dateReceived ?? null,
          dateFor: raw.dateFor ?? null,
          recommendedUse: typeof raw.recommendedUse === "number" ? raw.recommendedUse : 3,
          sourceUrl: raw.sourceUrl ?? null,
          fileLink: raw.fileLink ?? null,
          bundleId: null,
          bundleStep: null,
          notes: raw.notes ?? null,
          blockId: null,
        } as any);
        added++;
      }
      return res.json({ ok: true, added, skipped });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e?.message ?? String(e) });
    }
  });

  /* ============================================================================
   * NIGHTLY DAILY LESSON GENERATOR (Phase 5)
   * --------------------------------------------------------------------------
   * POST /api/scheduled/nightly-lesson-gen
   *
   * Picked up by the platform scheduler at 21:00 every night. Computes the
   * NEXT school day (Mon–Fri; Sat/Sun roll forward to Monday), drafts a fresh
   * plan via the existing AI generator, and commits the blocks. If the next
   * school day already has any blocks (parent/tutor pre-staged something) we
   * skip to avoid clobbering manual edits.
   *
   * Body: { force?: boolean }   force=true bypasses the "already has blocks" guard.
   * Returns: { ok, dateStr, dayLabel, status: "created"|"skipped_existing"|"weekend", blocksAdded }
   * =========================================================================== */
  app.post("/api/scheduled/nightly-lesson-gen", async (req: Request, res: Response) => {
    let role: string | null = null;
    try {
      const u = await sdk.authenticateRequest(req);
      role = u?.role ?? null;
    } catch { role = null; }
    if (!role || (role !== "user" && role !== "admin")) {
      return res.status(401).json({ ok: false, error: "Unauthorized \u2014 scheduled-task cookie required." });
    }

    try {
      const force = !!req.body?.force;
      // Compute the next *school* day (skip Sat/Sun).
      const now = new Date();
      let target = new Date(now.getTime() + 24 * 60 * 60 * 1000); // tomorrow
      // Roll forward over Sat (6) and Sun (0).
      while (target.getDay() === 0 || target.getDay() === 6) {
        target = new Date(target.getTime() + 24 * 60 * 60 * 1000);
      }
      const dateStr = target.toISOString().slice(0, 10);
      const dayLabel = target.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

      // Ensure plan exists (weekday → default "full"; helper handles Wednesday=half).
      const plan = await db.ensurePlanForDate(dateStr, "full");
      if (!plan) return res.status(500).json({ ok: false, error: "could not ensure plan" });

      // Don't blow away pre-staged blocks unless forced.
      const existing = await db.listBlocksForPlan(plan.id);
      if (!force && (existing as any[]).length > 0) {
        return res.json({ ok: true, dateStr, dayLabel, status: "skipped_existing", blocksAdded: 0, existing: (existing as any[]).length });
      }

      // Draft a fresh plan with the same generator the UI uses.
      const profile: any = await db.getProfile().catch(() => null);
      const subjects = (await db.listSubjects()).map((s: any) => ({ slug: s.slug, name: s.name }));
      const { generateScheduleDraft } = await import("./_lib/aiScheduleGenerator");
      const { loadTopicHintsForPrompt, resolveTopicIds } = await import("./_lib/topicCatalog");
      const { resolveTutorOfDay } = await import("./_lib/tutorOfDay");
      const { loadOwnedBooksForAgenda } = await import("./_lib/ownedBooksHints");
      const [topicCatalog, tutorOfDay, ownedBooks] = await Promise.all([
        loadTopicHintsForPrompt().catch(() => []),
        resolveTutorOfDay(dateStr).catch(() => null),
        loadOwnedBooksForAgenda().catch(() => []),
      ]);
      const draft = await generateScheduleDraft({
        dateStr,
        dayLabel,
        studentName: profile?.studentName || "Reagan",
        gradeLevel: profile?.gradeLevel || "5th grade",
        interests: profile?.interests || [],
        whatWorks: profile?.whatWorks || [],
        whatHarms: profile?.whatHarms || [],
        adultPrompt: "Nightly auto-draft. Bias toward curriculum gaps (notStarted/inProgress topics). Keep blocks short and varied.",
        dayLength: "full",
        subjects,
        topicCatalog,
        tutorOfDay,
        ownedBooks,
      });

      if (!draft.blocks || draft.blocks.length === 0) {
        return res.json({ ok: true, dateStr, dayLabel, status: "empty_draft", blocksAdded: 0, summary: draft.summary, warnings: draft.warnings });
      }

      // Persist blocks. Wipe any not_started leftovers first when forced.
      if (force) {
        for (const b of existing as any[]) {
          try { await db.deleteBlock(b.id); } catch (e) { console.warn("[nightly-lesson-gen] delete block failed", e); }
        }
      }
      const slugToId = new Map<string, number>(subjects.map((s: any) => [s.slug, s.id as number]));
      const codeMap = await resolveTopicIds(draft.blocks.map((b: any) => b.curriculumTopicCode || null)).catch(() => new Map<string, number>());
      let sortOrder = 0; let added = 0;
      for (const b of draft.blocks) {
        const subjectId = b.subjectSlug ? (slugToId.get(b.subjectSlug) ?? null) : null;
        const codeKey = (b as any).curriculumTopicCode ? String((b as any).curriculumTopicCode).trim().toUpperCase() : "";
        const topicId = codeKey ? (codeMap.get(codeKey) ?? null) : null;
        try {
          await db.createBlock({
            planId: plan.id,
            blockType: b.blockType as any,
            subjectId,
            title: b.title,
            description: b.description || null,
            durationMin: b.durationMin,
            startTime: b.startTime || null,
            sortOrder: sortOrder++,
            status: "not_started" as any,
            curriculumTopicId: topicId,
          } as any);
          added++;
        } catch (e) { console.warn("[nightly-lesson-gen] createBlock failed", e); }
      }

      // Push 148 (2026-05-14) — worksheet auto-prep planner.
      // After committing the next school day's blocks, plan which of
      // them need a worksheet generated for tomorrow's 8 PM packet.
      // Pure planning only here — no LLM calls. The scheduled-task
      // agent picks up `autoPrep.workItems` and feeds each through the
      // existing answer-key + worksheet PDF pipeline.
      let autoPrep: { workItems: any[]; skipped: any[] } = {
        workItems: [],
        skipped: [],
      };
      try {
        const committed = await db.listBlocksForPlan(plan.id);
        const slugById = new Map<number, { slug: string; name: string }>();
        for (const s of subjects as any[]) {
          slugById.set(s.id, { slug: s.slug, name: s.name });
        }
        const planned = (committed as any[]).map((b) => {
          const subj = b.subjectId ? slugById.get(b.subjectId) ?? null : null;
          return {
            blockId: b.id as number,
            blockTitle: (b.title ?? "") as string,
            subjectSlug: subj?.slug ?? null,
            subjectName: subj?.name ?? null,
            details: (b.description ?? null) as string | null,
            curriculumTopicCode: null,
            kind: undefined,
            hasAnswerKey: false,
          };
        });
        const { planWorksheetAutoPrep } = await import(
          "./_lib/worksheetAutoPrepPlanner"
        );
        autoPrep = planWorksheetAutoPrep(planned);
      } catch (e) {
        console.warn("[nightly-lesson-gen] worksheet auto-prep planning failed", e);
      }

      return res.json({
        ok: true,
        dateStr,
        dayLabel,
        status: "created",
        blocksAdded: added,
        summary: draft.summary,
        warnings: draft.warnings,
        autoPrep,
      });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e?.message ?? String(e) });
    }
  });

  /* ============================================================================
   * NIGHTLY AGENDA PDF EMAIL — 8 PM the night before each school day
   *
   * Manus scheduled task hits this nightly (and again at 6 AM as a change
   * resend pass). It POSTs { forDate?, recipients?, force? } and we:
   *   1. Assemble the agenda from the DB
   *   2. Hash it canonically and short-circuit if unchanged since last sent
   *   3. Render the PDF with pdfkit and upload to S3 storage
   *   4. Return { pdfUrl, recipients, subject, htmlBody, recordId, status }
   *      so the scheduled-task agent can hand it to gmail MCP for sending,
   *      and to gws for the Drive Homeschool Hub mirror.
   * ============================================================================ */
  app.post("/api/scheduled/nightly-agenda-email", async (req: Request, res: Response) => {
    // v2.92 (2026-05-27) — dual auth: accept EITHER the cookie-based
    // scheduled-task session OR a shared bearer secret in the Authorization
    // header. The bearer path bypasses the Cloudflare edge cookie gate that
    // has been silently 403'ing the nightly cron since May 4. The cookie
    // path stays so manual parent calls still work.
    const bearerHeader = String(req.headers["authorization"] ?? req.headers["Authorization" as any] ?? "");
    const bearerSecret = ENV.scheduledBearer;
    const bearerOk =
      !!bearerSecret &&
      bearerHeader.startsWith("Bearer ") &&
      bearerHeader.slice(7).trim() === bearerSecret;

    let role: string | null = null;
    if (!bearerOk) {
      try {
        const u = await sdk.authenticateRequest(req);
        role = u?.role ?? null;
      } catch { role = null; }
    }
    const cookieOk = !!role && (role === "user" || role === "admin");
    if (!bearerOk && !cookieOk) {
      return res.status(401).json({ ok: false, error: "Unauthorized \u2014 scheduled-task cookie or bearer required." });
    }
    try {
      // Resolve target date: explicit forDate, else next school day (skip Sat/Sun).
      let forDate: string = (req.body?.forDate ?? "") as string;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(forDate)) {
        const now = new Date();
        let target = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        while (target.getDay() === 0 || target.getDay() === 6) {
          target = new Date(target.getTime() + 24 * 60 * 60 * 1000);
        }
        forDate = target.toISOString().slice(0, 10);
      }
      // 2026-06-18: Grandma paused + single-recipient rule. Default to Mom
      // only; the mailer still strips any Grandma address defensively.
      const recipients: string[] = Array.isArray(req.body?.recipients) && req.body.recipients.length > 0
        ? req.body.recipients
        : ["spear.cpt@gmail.com"];
      const force = !!req.body?.force;

      const { assembleAgendaForDate } = await import("./_lib/agendaAssembler");
      const { buildAgendaPdf } = await import("./_lib/agendaPdf");
      const { buildPerBlockWorksheetAttachments } = await import("./_lib/perBlockWorksheetPdf");
      const { storagePut, storageGetSignedUrl } = await import("./storage");
      const { runAutoAttachForDate } = await import("./_lib/blockAutoAttach");

      // v2.97.2 (2026-05-27) — Auto-attach is now FIRE-AND-FORGET so this
      // endpoint stays under the 30s heartbeat timeout. The 8 PM evening
      // pre-prep heartbeat already runs auto-attach the night before, so
      // by 7 AM blocks are populated. We still kick off a background pass
      // to backfill any block that was added/edited overnight, but we do
      // NOT await it. The agenda assembles from whatever is already in DB.
      void (async () => {
        try {
          const autoR = await runAutoAttachForDate(forDate, { kidSafe: true });
          // eslint-disable-next-line no-console
          console.log(
            `[nightly-agenda-email] background auto-attach for ${forDate}: attached=${autoR.attached} skipped=${autoR.skipped} noResult=${autoR.noResult} errors=${autoR.errors} (of ${autoR.totalBlocks})`,
          );
        } catch (e: any) {
          // eslint-disable-next-line no-console
          console.warn(`[nightly-agenda-email] background auto-attach failed: ${String(e?.message ?? e)}`);
        }
      })();

      const payload = await assembleAgendaForDate(forDate);
      if (!payload) {
        return res.json({ ok: true, status: "no_plan", forDate });
      }
      const { pdfBuffer, agendaHash } = await buildAgendaPdf(payload);

      // Idempotency: if the most recent SENT row for this date has the same
      // hash, skip (unless forced).
      const last = await db.getLatestNightlyAgendaEmail(forDate);
      if (last && last.agendaHash === agendaHash && last.status === "sent" && !force) {
        return res.json({
          ok: true,
          status: "unchanged",
          forDate,
          agendaHash,
          lastSentAt: last.sentAt,
        });
      }
      const isResend = !!last;

      // Upload PDF, then immediately request an ABSOLUTE presigned S3 GET URL
      // for the email body. The relative `/manus-storage/...` path requires a
      // dashboard cookie to follow the 307 redirect, which Mom and Grandma do
      // NOT have when clicking the link from Gmail. Bug fix 2026-05-12.
      const fileKey = `nightly-agendas/${forDate}/agenda_${agendaHash.slice(0, 8)}.pdf`;
      const { key, url } = await storagePut(fileKey, pdfBuffer, "application/pdf");
      let absolutePdfUrl: string | null = null;
      try {
        absolutePdfUrl = await storageGetSignedUrl(key);
      } catch (e) {
        // If presign fails we still want the email to send — fall back to
        // attachment-only delivery (the gmail MCP attaches the buffer separately).
        absolutePdfUrl = null;
      }

      /* ----------------------------------------------------------------------
       * PRIORITY-1 (2026-05-14, overnight push): per-block worksheet PDFs.
       * Mom asked for the printable worksheets to actually appear as Gmail
       * attachments instead of just a link button. Build one PDF per block-
       * with-printable, kid-readable headings ("What to do", "Try these",
       * "Answers (for Mom)"), then return them as `attachments[]` so the
       * scheduled-task agent attaches them when it sends via Gmail MCP.
       *
       * Also enqueue an auto-Drive-mirror row per file so the same packet
       * lands in `Reagan School Hub (Dashboard) > Daily Operations > Daily
       * Agenda PDFs > {YYYY-MM} > {date}` and `... > Worksheets (Daily
       * Packets) > {YYYY-MM} > {date} - Block{n} - {subject} - {title}.pdf`
       * without anyone clicking anything.
       * -------------------------------------------------------------------- */
      let perBlockAttachments: Array<{
        filename: string;
        attachmentKey: string;
        blockSortOrder: number;
        subjectName: string | null;
        topicCode: string | null;
        storageKey: string;
        storageUrl: string;
        signedUrl: string | null;
        byteSize: number;
        pdfBase64: string;
      }> = [];
      try {
        const built = await buildPerBlockWorksheetAttachments(payload as any);
        for (const a of built) {
          const wsKey = `nightly-agendas/${forDate}/worksheets/${a.attachmentKey.replace(/[^A-Za-z0-9_/.-]+/g, "_")}.pdf`;
          const { key: wsStorageKey, url: wsStorageUrl } = await storagePut(
            wsKey,
            a.pdfBuffer,
            "application/pdf",
          );
          let wsSigned: string | null = null;
          try { wsSigned = await storageGetSignedUrl(wsStorageKey); } catch { wsSigned = null; }
          perBlockAttachments.push({
            filename: a.filename,
            attachmentKey: a.attachmentKey,
            blockSortOrder: a.blockSortOrder,
            subjectName: a.subjectName,
            topicCode: a.topicCode,
            storageKey: wsStorageKey,
            storageUrl: wsStorageUrl,
            signedUrl: wsSigned,
            byteSize: a.byteSize,
            pdfBase64: a.pdfBuffer.toString("base64"),
          });
          // Auto-mirror this worksheet to Drive (Worksheets / Daily Packets)
          try {
            // Flattened 2026-06-18: no {YYYY-MM} subfolder. Prefix the
            // worksheet filename with the date so names stay unique and
            // naturally sorted in the flat Worksheets folder.
            const wsName = a.filename.startsWith(forDate)
              ? a.filename
              : `${forDate} - ${a.filename}`;
            await (db as any).enqueueDrivePush?.({
              fileKey: wsStorageKey,
              fileUrl: wsSigned ?? wsStorageUrl,
              fileName: wsName,
              mimeType: "application/pdf",
              targetFolder: "worksheets" as any,
              targetSubpath: "",
            } as any);
          } catch { /* drive mirror is fire-and-forget */ }
        }
      } catch (e) {
        // Worksheet split failure must NOT block the email — fall back to
        // just the agenda PDF attachment.
        perBlockAttachments = [];
      }

      // Auto-mirror the agenda PDF itself.
      try {
        // Flattened 2026-06-18: dated filename, no {YYYY-MM} subfolder.
        await (db as any).enqueueDrivePush?.({
          fileKey: key,
          fileUrl: absolutePdfUrl ?? url,
          fileName: `${forDate} - ${payload.studentName} - Agenda.pdf`,
          mimeType: "application/pdf",
          targetFolder: "agenda_pdf" as any,
          targetSubpath: "",
        } as any);
      } catch { /* fire-and-forget */ }

      // Insert queued row
      const recordId = await db.insertNightlyAgendaEmail({
        forDate,
        recipients: recipients.join(", "),
        agendaHash,
        blockCount: payload.blocks.length,
        pdfStorageKey: key,
        status: "queued",
        triggerKind: isResend ? "change_resend" : "nightly",
      });

      // Email body
      const subject = (isResend ? "[UPDATED] " : "") + `${payload.studentName}'s school plan \u2014 ${payload.dayLabel}`;
      const tutorLine = payload.tutorName
        ? `<p style=\"color:#0a66c2;font-size:14px;\"><b>Tutor:</b> ${payload.tutorName}` +
          (payload.tutorArrival ? ` &middot; arrives ${payload.tutorArrival}` : "") +
          (payload.tutorDeparture ? ` &middot; leaves ${payload.tutorDeparture}` : "") + "</p>"
        : "";
      const blockListHtml = payload.blocks.map((b: any) => {
        const head = `<b>${b.sortOrder}. ${b.startTime ?? "flex"} &middot; ${b.durationMin} min</b>` +
          (b.subjectName ? ` <span style=\"color:#888;\">[${b.subjectName}]</span>` : "") +
          (b.curriculumTopicCode ? ` <span style=\"color:#888;\">topic ${b.curriculumTopicCode}</span>` : "");
        const desc = b.description ? `<div style=\"color:#444;font-size:13px;margin:2px 0 0 14px;\">${b.description}</div>` : "";
        const books = (b.bookPageRefs ?? []).map((r: any) =>
          `<div style=\"color:#0a66c2;font-size:13px;margin:2px 0 0 14px;\">\ud83d\udcd6 ${r.bookTitle} \u2014 pg. ${r.fromPage}\u2013${r.toPage}</div>`
        ).join("");
        return `<div style=\"padding:8px 0;border-bottom:1px solid #eee;\">${head}<div style=\"margin:2px 0 0 14px;\">${b.title}</div>${desc}${books}</div>`;
      }).join("");
      // Plain-English kid + Grandma summary line ("Reagan has 4 things to
      // do tomorrow: Math, Reading, Science, and a Stretch break.").
      let kidSummaryLine = "";
      try {
        const subjects = Array.from(
          new Set(
            (payload.blocks ?? [])
              .map((b: any) => (b.subjectName ?? b.title ?? "").toString().trim())
              .filter((s: string) => s.length > 0),
          ),
        );
        if (subjects.length > 0) {
          const list = subjects.length === 1
            ? subjects[0]
            : subjects.slice(0, -1).join(", ") + ", and " + subjects[subjects.length - 1];
          kidSummaryLine =
            `<div style=\"margin:14px 0;padding:12px 16px;background:#fff8e1;border-radius:8px;color:#5d4a00;font-size:15px;\">` +
            `<b>What's coming up:</b> ${payload.studentName} has ${payload.blocks.length} block` +
            `${payload.blocks.length === 1 ? "" : "s"} ` +
            `tomorrow \u2014 ${list}.</div>`;
        }
      } catch { /* summary line is optional cosmetic */ }

      // 2026-06-18 single-PDF rule: short branded note + the friendly
      // "What's coming up" line (kept for Reagan) — but NO HTML block dump.
      // The colored printable PDF (attached) is the deliverable.
      void blockListHtml; void tutorLine;
      const html = `<!doctype html><html><body style=\"font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#222;max-width:560px;margin:0 auto;padding:24px;\">
<div style=\"text-align:center;margin-bottom:12px;\"><div style=\"font-size:22px;font-weight:800;color:#1f3a2e;\">${payload.studentName}'s School Plan</div><div style=\"color:#666;font-size:14px;\">${payload.dayLabel}</div></div>
${kidSummaryLine}
<p style=\"font-size:15px;color:#1f3a2e;text-align:center;margin:20px 0;font-weight:600;\">📎 Today's colored printable is attached as a PDF — print it or open it on the dashboard.</p>
<p style=\"font-size:12px;color:#888;text-align:center;margin-top:8px;\">If anything changes before school start, this email is re-sent automatically.</p>
</body></html>`;

      // Build the attachments[] array the scheduled-task agent will pass to
      // Gmail MCP. Agenda PDF first, then per-block worksheets in sortOrder.
      const attachments: Array<{
        filename: string;
        contentBase64: string;
        mimeType: string;
        byteSize: number;
        kind: "agenda" | "worksheet";
        blockSortOrder?: number;
      }> = [];
      attachments.push({
        filename: `${forDate} - ${payload.studentName} - Agenda.pdf`,
        contentBase64: pdfBuffer.toString("base64"),
        mimeType: "application/pdf",
        byteSize: pdfBuffer.byteLength,
        kind: "agenda",
      });
      for (const ws of perBlockAttachments) {
        attachments.push({
          filename: ws.filename,
          contentBase64: ws.pdfBase64,
          mimeType: "application/pdf",
          byteSize: ws.byteSize,
          kind: "worksheet",
          blockSortOrder: ws.blockSortOrder,
        });
      }

      // PRIORITY-2 (2026-05-14, Wave-8 push 162): bundle today's actual
      // grades + Kiwi mood + planned-vs-actual into one Mom-readable
      // briefing markdown. Pure helper, never throws on missing data
      // (returns harmless 'nothing logged today' lines).
      let momBriefing: ReturnType<typeof buildDailyMomBriefing> | null = null;
      try {
        momBriefing = buildDailyMomBriefing({
          schoolDayISO: forDate,
          kidName: payload.studentName,
          grades: [],
          timeBySubjectMin: {},
          totalMinutesOnTask: 0,
          totalMinutesPlanned: (payload.blocks ?? []).reduce(
            (s: number, b: any) => s + (Number.isFinite(b?.durationMin) ? Number(b.durationMin) : 0),
            0,
          ),
          moodReadings: [],
          worksheetsAttached: perBlockAttachments.length,
        });
      } catch { momBriefing = null; }

      // ============================================================
      // v2.98 (2026-05-28): Send via Gmail MCP (manus-mcp-cli).
      // Replaces broken SMTP/Nodemailer path. Gmail MCP triggers a
      // confirmation card in the Manus UI — user taps Send to confirm.
      // Attachments are uploaded to public CDN URLs first.
      // ============================================================
      const { sendEmail } = await import("./_core/mailer");
      // 2026-06-18 single-PDF rule: the daily email carries ONLY the one
      // combined colored printable agenda PDF (worksheets are already merged
      // inline). Per-block worksheet attachments are dropped from email; the
      // app is where Reagan grabs individual fillable worksheets.
      const emailAttachments = attachments
        .filter((a) => a.kind === "agenda")
        .map((a) => ({
          filename: a.filename,
          content: Buffer.from(a.contentBase64, "base64"),
          contentType: a.mimeType,
        }));
      const sendResult = await sendEmail({
        to: recipients,
        subject,
        html,
        attachments: emailAttachments,
      });
      // Update DB row: mark sent (or failed)
      try {
        await db.markNightlyAgendaEmailStatus({
          id: recordId,
          status: sendResult.ok ? "sent" : "failed",
          errorMessage: sendResult.error ?? null,
        });
      } catch { /* non-fatal — row stays queued */ }

      return res.json({
        ok: true,
        status: isResend ? "resend_ready" : "send_ready",
        forDate,
        agendaHash,
        recipients,
        subject,
        htmlBody: html,
        pdfStorageKey: key,
        pdfUrl: url,                    // DEPRECATED for cron; cookie-gated
        pdfDownloadUrl: absolutePdfUrl, // CRON USES THIS — absolute presigned S3
        recordId,
        momBriefing: momBriefing
          ? {
              schoolDayISO: momBriefing.schoolDayISO,
              markdownBody: momBriefing.markdownBody,
              notificationHeadline: momBriefing.notificationHeadline,
              moodBand: momBriefing.moodRollup.band,
              kidHeadline: momBriefing.kidSummary.headline,
              plannedVsActualLine: momBriefing.plannedVsActualLine,
            }
          : null,
        attachments,
        worksheetAttachments: perBlockAttachments.map((a) => ({
          filename: a.filename,
          attachmentKey: a.attachmentKey,
          blockSortOrder: a.blockSortOrder,
          subjectName: a.subjectName,
          topicCode: a.topicCode,
          storageKey: a.storageKey,
          storageUrl: a.storageUrl,
          signedUrl: a.signedUrl,
          byteSize: a.byteSize,
        })),
        driveFolderHint: "Reagan School Hub (Dashboard) > Daily Operations > Daily Agenda PDFs",
      });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e?.message ?? String(e) });
    }
  });

  /* ============================================================================
   * EVENING AUTO-ATTACH — 8 PM EDT the night before each school day.
   *
   * Decoupled from nightly-agenda-email so the 7 AM email request stays under
   * the 30s heartbeat timeout. This endpoint runs the LLM-backed finder for
   * every block on tomorrow's plan, attaching kid-safe resources so by 7 AM
   * the agenda assembles instantly.
   *
   * Idempotent: skips any block that already has a pinned resource.
   * ============================================================================ */
  app.post("/api/scheduled/auto-attach-evening", async (req: Request, res: Response) => {
    // Dual auth (cookie OR bearer)
    const bearerHeader = String(req.headers["authorization"] ?? req.headers["Authorization" as any] ?? "");
    const bearerOk = !!ENV.scheduledBearer && bearerHeader.startsWith("Bearer ") && bearerHeader.slice(7).trim() === ENV.scheduledBearer;
    let role: string | null = null;
    if (!bearerOk) {
      try { const u = await sdk.authenticateRequest(req); role = u?.role ?? null; } catch { role = null; }
    }
    if (!bearerOk && (!role || (role !== "user" && role !== "admin"))) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    try {
      // Resolve target date: explicit forDate, else next school day (skip Sat/Sun).
      let forDate: string = (req.body?.forDate ?? "") as string;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(forDate)) {
        const now = new Date();
        let target = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        while (target.getDay() === 0 || target.getDay() === 6) {
          target = new Date(target.getTime() + 24 * 60 * 60 * 1000);
        }
        forDate = target.toISOString().slice(0, 10);
      }
      const { runAutoAttachForDate } = await import("./_lib/blockAutoAttach");
      const r = await runAutoAttachForDate(forDate, { kidSafe: true });
      return res.json({
        ok: true,
        forDate,
        attached: r.attached,
        skipped: r.skipped,
        noResult: r.noResult,
        errors: r.errors,
        totalBlocks: r.totalBlocks,
      });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e?.message ?? String(e) });
    }
  });

  /** Mark a queued/sent agenda row complete after gmail MCP confirms send. */
  app.post("/api/scheduled/nightly-agenda-email/result", async (req: Request, res: Response) => {
    // v2.92 (2026-05-27) — dual auth, see nightly-agenda-email POST above.
    const bearerHeader2 = String(req.headers["authorization"] ?? req.headers["Authorization" as any] ?? "");
    const bearerOk2 = !!ENV.scheduledBearer && bearerHeader2.startsWith("Bearer ") && bearerHeader2.slice(7).trim() === ENV.scheduledBearer;
    let role: string | null = null;
    if (!bearerOk2) {
      try { const u = await sdk.authenticateRequest(req); role = u?.role ?? null; } catch { role = null; }
    }
    if (!bearerOk2 && (!role || (role !== "user" && role !== "admin"))) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    try {
      const { recordId, status, errorMessage, drivePushed } = req.body ?? {};
      if (typeof recordId !== "number") return res.status(400).json({ ok: false, error: "Expected { recordId }" });
      const finalStatus: "sent" | "failed" | "resent" = status === "failed" ? "failed" : status === "resent" ? "resent" : "sent";
      await db.markNightlyAgendaEmailStatus({
        id: recordId,
        status: finalStatus,
        errorMessage: errorMessage ?? null,
        drivePushed: drivePushed === true,
      });
      return res.json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e?.message ?? String(e) });
    }
  });

  /**
   * iCal overlay refresh — pull every enabled feed, parse, replace cached events.
   * Called by the nightly scheduled task and by the Schedule UI's manual refresh.
   *
   * GET /api/scheduled/ical-refresh
   *   → { ok, results: [{ feedId, label, status, count?, error? }] }
   */
  app.get("/api/scheduled/ical-refresh", async (req: Request, res: Response) => {
    let role: string | null = null;
    try { const u = await sdk.authenticateRequest(req); role = u?.role ?? null; } catch { role = null; }
    if (!role || (role !== "user" && role !== "admin")) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    try {
      const { parseIcs, eventForDateString } = await import("./_lib/icsParser");
      const feeds = await db.listIcalFeeds();
      const enabled = (feeds as any[]).filter((f) => f.enabled);
      const results: Array<{ feedId: number; label: string; status: string; count?: number; error?: string }> = [];
      for (const feed of enabled) {
        try {
          const r = await fetch(feed.url, { headers: { Accept: "text/calendar" } });
          if (!r.ok) throw new Error(`Feed responded ${r.status}`);
          const text = await r.text();
          const events = parseIcs(text);
          await db.replaceIcalEventsForFeed(feed.id, events.map((e) => ({
            uid: e.uid,
            summary: e.summary,
            location: e.location,
            description: e.description,
            startsAt: e.startsAt,
            endsAt: e.endsAt,
            allDay: e.allDay,
            forDate: eventForDateString(e),
            rawSnippet: e.rawSnippet,
          })));
          await db.recordIcalSyncResult({ feedId: feed.id, status: "ok", eventsCached: events.length });
          results.push({ feedId: feed.id, label: feed.label, status: "ok", count: events.length });
        } catch (e: any) {
          await db.recordIcalSyncResult({ feedId: feed.id, status: "failed", error: e?.message ?? String(e) });
          results.push({ feedId: feed.id, label: feed.label, status: "failed", error: e?.message ?? String(e) });
        }
      }
      return res.json({ ok: true, results });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e?.message ?? String(e) });
    }
  });

  /* ====================== CONTINUOUS DRIVE SNAPSHOT ====================== */
  /**
   * GET /api/scheduled/drive-snapshot
   *
   * Mom asked May 2026: "auto-sync everything with Google Drive continuously."
   * This endpoint exports a *live* JSON+CSV snapshot of every dashboard section
   * the cron worker can mirror into Drive Hub > Snapshots/{date}/{HHMM}.
   *
   * Returns one payload with:
   *   - assignments  (open + done in the last 14 days)
   *   - finishedWork (submissions in the last 14 days)
   *   - schedule     (today + next 6 days of plans + blocks)
   *   - coins        (current balance + last 30 ledger entries)
   *   - analytics    (skills mastery snapshot + struggle patterns)
   *   - journal      (last 14 days of entries)
   *
   * The cron worker is responsible for writing these files into Drive (it has
   * gws/rclone). We keep the read-only data assembly here in the server because
   * the DB lives here.
   */
  app.get("/api/scheduled/drive-snapshot", async (req: Request, res: Response) => {
    let role: string | null = null;
    try {
      const u = await sdk.authenticateRequest(req);
      role = u?.role ?? null;
    } catch {
      role = null;
    }
    if (!role || (role !== "user" && role !== "admin")) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    try {
      const today = new Date().toISOString().slice(0, 10);
      const fourteenAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      // Each call defensively swallows errors so a partial snapshot still ships.
      const [
        assignments,
        finishedWork,
        scheduleNext7,
        coinBalance,
        coinLedger,
        skills,
        struggles,
        journal,
      ] = await Promise.all([
        (db as any).listOpenAssignments?.(50).catch(() => null) ?? null,
        (db as any).listRecentSubmissions?.(50).catch(() => null) ?? null,
        (db as any).listPlansBetween?.(today, new Date(Date.now() + 6 * 86400000).toISOString().slice(0,10)).catch(() => null) ?? null,
        (db as any).getCoinBalance?.().catch(() => null) ?? null,
        (db as any).listRecentCoinLedger?.(30).catch(() => null) ?? null,
        (db as any).listSkillsMastery?.().catch(() => null) ?? null,
        (db as any).listEmotionalStruggles?.({ since: fourteenAgo }).catch(() => null) ?? null,
        (db as any).listJournalEntries?.({ since: fourteenAgo }).catch(() => null) ?? null,
      ]);

      return res.json({
        ok: true,
        generatedAt: new Date().toISOString(),
        snapshot: {
          assignments,
          finishedWork,
          scheduleNext7,
          coins: { balance: coinBalance, ledger: coinLedger },
          analytics: { skills, struggles },
          journal,
        },
      });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e?.message ?? String(e) });
    }
  });

  /* ===========================================================
   * Slice 4.5 — Daily Recap workflow (May 12 2026)
   *
   * If the day has no actualAgendaEntries by 8 PM ET, email Mom +
   * Grandma + every active tutor with a magic-link reply token. The
   * first reply wins; their reply text is parsed by an LLM into
   * actualAgendaEntries + topicsCoveredOffPlan rows; off-plan topics
   * are pushed to the Drive Topics-Covered folder.
   * =========================================================== */

  function nowETDateISO(): string {
    const now = new Date();
    // Convert to America/New_York; ET = UTC-5 (EST) or UTC-4 (EDT). Use Intl.
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });
    const parts = fmt.formatToParts(now);
    const y = parts.find(p => p.type === "year")?.value ?? "1970";
    const m = parts.find(p => p.type === "month")?.value ?? "01";
    const d = parts.find(p => p.type === "day")?.value ?? "01";
    return `${y}-${m}-${d}`;
  }

  function makeReplyToken(): string {
    const bytes = new Uint8Array(24);
    if (typeof globalThis.crypto?.getRandomValues === "function") {
      globalThis.crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  /**
   * POST /api/scheduled/daily-recap-send
   *
   * Heartbeat-triggered at 8 PM ET. Idempotent — safe to retry.
   * Skips if today already has any actualAgendaEntries OR if a recap
   * has already been replied to today.
   */
  app.post("/api/scheduled/daily-recap-send", async (req: Request, res: Response) => {
    // Auth gate — tightened in push 9 (2026-05-12).
    // Previously this route silently swallowed missing auth and always
    // proceeded, which meant any anonymous internet caller could create
    // recap-request rows + trigger downstream email sends. This route
    // now matches the rest of the /api/scheduled/* family: require a
    // real authenticated user with role==='user' OR 'admin'.
    let role: string | null = null;
    try {
      const u = await sdk.authenticateRequest(req);
      role = u?.role ?? null;
    } catch {
      role = null;
    }
    if (!role || (role !== "user" && role !== "admin")) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    try {
      const dateISO = (req.body?.dateISO as string | undefined) ?? nowETDateISO();

      // Guards
      const actualCount = await (db as any).countActualForDate?.(dateISO).catch(() => 0) ?? 0;
      if (actualCount > 0) {
        return res.json({ ok: true, skipped: "actual-entries-exist", dateISO, actualCount });
      }
      const alreadyAnswered = await (db as any).isRecapAlreadyAnswered?.(dateISO).catch(() => false) ?? false;
      if (alreadyAnswered) {
        return res.json({ ok: true, skipped: "already-answered", dateISO });
      }

      // Recipients: 2026-06-18 Grandma paused — Mom only, plus every active
      // tutor with a non-empty email. (Mailer also strips Grandma defensively.)
      const fixedRecipients = ["spear.cpt@gmail.com"];
      let tutorEmails: string[] = [];
      try {
        const tutorsRows = (await (db as any).listTutors?.(true)) ?? [];
        tutorEmails = tutorsRows
          .map((t: any) => (t?.email ?? "").trim().toLowerCase())
          .filter((e: string) => /.+@.+\..+/.test(e));
      } catch { /* tutor table missing or empty — ignore */ }
      const recipients = Array.from(new Set([...fixedRecipients, ...tutorEmails]));

      // Create one recap-request row per recipient (each gets its own token).
      const created: Array<{ recipient: string; token: string }> = [];
      for (const recipient of recipients) {
        const token = makeReplyToken();
        try {
          await (db as any).createRecapRequest?.({ dateISO, sentTo: recipient, replyToken: token });
          created.push({ recipient, token });
        } catch (e) {
          // continue — don't fail the whole send because one recipient row failed
          console.error("[daily-recap-send] createRecapRequest failed for", recipient, e);
        }
      }

      // The actual email send is handled by an external AGENT cron that polls
      // /api/scheduled/daily-recap-send/pending to learn which (recipient, token)
      // pairs still need an outbound email. We just persist the rows here and
      // return them in the response so a synchronous mailer (if added) can use them.
      return res.json({ ok: true, dateISO, sent: created });
    } catch (e: any) {
      console.error("[daily-recap-send] error", e);
      return res.status(500).json({ ok: false, error: e?.message ?? String(e) });
    }
  });

  /**
   * GET /api/scheduled/daily-recap-send/pending
   * Returns the recap-request rows whose status is still 'sent' (no reply yet)
   * so an external mailer agent can compose + send the email.
   */
  app.get("/api/scheduled/daily-recap-send/pending", async (_req: Request, res: Response) => {
    try {
      const rows = await (db as any).listPendingRecapRequests?.(50).catch(() => []) ?? [];
      return res.json({ ok: true, pending: rows });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e?.message ?? String(e) });
    }
  });

  /**
   * POST /api/scheduled/daily-recap-reply
   * Body: { token: string, replyText: string, replyFrom?: string }
   *
   * Inbound webhook called by the email-reply forwarder OR the in-app reply
   * surface. First reply for a given dateISO wins — subsequent replies are
   * recorded but their parsed entries are not inserted again.
   */
  app.post("/api/scheduled/daily-recap-reply", async (req: Request, res: Response) => {
    try {
      const { clampReplyText, isNothingHappenedReply, normalizeRecapEntries } = await import("./_lib/normalizeRecapEntry");
      const token = String(req.body?.token ?? "").trim();
      const replyText = clampReplyText(String(req.body?.replyText ?? "").trim());
      const replyFrom = String(req.body?.replyFrom ?? "").trim().toLowerCase();
      if (!token || !replyText) {
        return res.status(400).json({ ok: false, error: "token-and-replyText-required" });
      }

      const reqRow = await (db as any).getRecapRequestByToken?.(token);
      if (!reqRow) return res.status(404).json({ ok: false, error: "unknown-token" });
      if (reqRow.status === "replied") {
        return res.json({ ok: true, skipped: "already-replied-via-this-token" });
      }
      const dateISO = reqRow.dateISO as string;

      // Honor first-reply-wins across recipients.
      const someoneAnswered = await (db as any).isRecapAlreadyAnswered?.(dateISO).catch(() => false) ?? false;
      if (someoneAnswered) {
        await (db as any).markRecapReplied?.(reqRow.id, replyText, 0).catch(() => {});
        return res.json({ ok: true, skipped: "another-recipient-answered-first" });
      }

      // Short-circuit "nothing happened today" replies — mark as replied, no LLM call.
      if (isNothingHappenedReply(replyText)) {
        await (db as any).markRecapReplied?.(reqRow.id, replyText, 0).catch(() => {});
        return res.json({ ok: true, dateISO, parsed: 0, inserted: 0, source: "nothing-happened", note: "day-off-or-rest" });
      }

      // LLM-extract structured entries from the freeform reply text.
      let parsed: Array<{ subjectSlug: string; topic: string; minutesSpent: number; notes: string | null; offPlan: boolean }> = [];
      try {
        const { invokeLLM } = await import("./_core/llm");
        const sys = `You convert a parent's freeform daily-recap email about their homeschooler into structured rows. \nReturn JSON: {"entries":[{subjectSlug, topic, minutesSpent, notes, offPlan}]}.\nsubjectSlug must be one of: math, ela, science, social-studies, life-skills, art, music, pe, social-emotional, other.\nIf the activity is school-adjacent (museum, baking, nature walk, science experiment) but not in a planned subject, mark offPlan=true and pick the closest subjectSlug (often other).`;
        const resp: any = await invokeLLM({
          messages: [
            { role: "system", content: sys },
            { role: "user", content: replyText },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "recap_entries",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  entries: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        subjectSlug: { type: "string" },
                        topic: { type: "string" },
                        minutesSpent: { type: "integer" },
                        notes: { type: "string" },
                        offPlan: { type: "boolean" },
                      },
                      required: ["subjectSlug", "topic", "minutesSpent", "notes", "offPlan"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["entries"],
                additionalProperties: false,
              },
            },
          },
        });
        const raw = resp?.choices?.[0]?.message?.content ?? "{}";
        const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
        // Normalize: clamp minutes, alias subjectSlugs, drop empty topics, etc.
        parsed = normalizeRecapEntries(obj?.entries);
      } catch (llmErr) {
        console.error("[daily-recap-reply] LLM parse failed; storing reply text only", llmErr);
      }

      // Determine source label from replyFrom email
      const source: string =
        replyFrom === "marcy.spear@gmail.com" ? "grandma-recap" :
        replyFrom === "spear.cpt@gmail.com" ? "mom-input" :
        replyFrom ? "tutor-note" :
        "grandma-recap";

      // Insert entries.
      let inserted = 0;
      for (const e of parsed) {
        try {
          const entryId = await (db as any).recordActualEntry?.({
            dateISO,
            plannedBlockId: null,
            subjectSlug: e.subjectSlug,
            topic: e.topic,
            minutesSpent: Number.isFinite(e.minutesSpent) ? e.minutesSpent : 0,
            source,
            notes: e.notes ?? null,
            createdBy: replyFrom || null,
          });
          inserted += 1;
          if (e.offPlan) {
            // Slice 4.5: insert + enqueue for Drive sync to Curriculum and Standards/Topics Covered/{YYYY-MM}/
            const md = `# ${e.topic}\n\n- Date: ${dateISO}\n- Subject: ${e.subjectSlug}\n- Minutes: ${e.minutesSpent}\n- Source: ${source}${replyFrom ? ` (${replyFrom})` : ""}\n${e.notes ? `\n## Notes\n${e.notes}\n` : ""}`;
            await (db as any).queueOffPlanTopicForDriveSync?.(
              dateISO,
              e.subjectSlug,
              e.topic,
              entryId,
              md,
            );
            // Push 52: also seed a real curriculumTopics row (status='covered',
            // source='recap-reply') so catch-up + coverage analytics surface it.
            try {
              await (db as any).autoAddRecapTopicToCurriculum?.({
                subjectSlug: e.subjectSlug,
                topic: e.topic,
                dateISO,
                sourceLabel: source,
              });
            } catch (curErr) {
              console.error("[daily-recap-reply] autoAddRecapTopicToCurriculum failed", curErr);
            }
          }
        } catch (insErr) {
          console.error("[daily-recap-reply] insert failed", insErr);
        }
      }

      await (db as any).markRecapReplied?.(reqRow.id, replyText, inserted);

      return res.json({ ok: true, dateISO, parsed: parsed.length, inserted, source });
    } catch (e: any) {
      console.error("[daily-recap-reply] error", e);
      return res.status(500).json({ ok: false, error: e?.message ?? String(e) });
    }
  });

  /**
   * POST /api/scheduled/daily-log-rebuild
   * Heartbeat every ~5 min. Rebuilds today's canonical day-log and enqueues
   * a Drive push to Daily Operations/{YYYY-MM}/{date} - Day Log.md.
   * Cheap when nothing has changed (skips push if hash matches last enqueued).
   */
  app.post("/api/scheduled/daily-log-rebuild", async (req: Request, res: Response) => {
    let role: string | null = null;
    try {
      const u = await sdk.authenticateRequest(req);
      role = u?.role ?? null;
    } catch {
      role = null;
    }
    if (!role || (role !== "user" && role !== "admin")) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    try {
      const dateISO = (req.body?.dateISO as string | undefined) ?? nowETDateISO();

      // Build the markdown via the canonical builder (handles weekend, absence,
      // off-plan topics, planned-complete counts, and source provenance).
      const md = await buildDayLogMarkdown(dateISO);
      const enc = new TextEncoder();
      const bytes = enc.encode(md);
      const fileName = dayLogFileName(dateISO);
      const subpath = dayLogSubpath(dateISO);

      // Upsert: there must be at most one pending row per (target, subpath,
      // fileName) tuple. If one already exists, overwrite its contentText with
      // the latest markdown; otherwise insert a new pending row. This prevents
      // the May 21 bug where every edit during the day created another pending
      // duplicate (we found 10 pending rows for the same date before dedupe).
      const dbInst = (db as any).getDb?.();
      let alreadyQueued = false;
      if (dbInst) {
        try {
          const existing: any[] = await dbInst
            .select()
            .from(drivePushQueue)
            .where(
              and(
                eq(drivePushQueue.targetFolder as any, "day_log" as any),
                eq(drivePushQueue.targetSubpath as any, subpath as any),
                eq(drivePushQueue.fileName as any, fileName as any),
                eq(drivePushQueue.status as any, "pending" as any),
              ),
            )
            .limit(1);
          if (existing.length > 0) {
            alreadyQueued = true;
            // Update content in place if it changed, so the next worker run
            // pushes the latest markdown for this date.
            if (existing[0].contentText !== md) {
              try {
                await dbInst
                  .update(drivePushQueue)
                  .set({ contentText: md, mimeType: "text/markdown" } as any)
                  .where(eq(drivePushQueue.id as any, existing[0].id));
              } catch (eu) {
                console.warn("[day-log-rebuild] in-place update failed", eu);
              }
            }
          }
        } catch (e) {
          console.warn("[day-log-rebuild] idempotency check failed", e);
        }
      }

      if (!alreadyQueued && dbInst) {
        try {
          await dbInst.insert(drivePushQueue).values({
            targetFolder: "day_log" as any,
            targetSubpath: subpath,
            fileName,
            mimeType: "text/markdown",
            contentText: md,
            status: "pending" as any,
          } as any);
        } catch (eq) {
          console.error("[day-log-rebuild] enqueue failed", eq);
        }
      }

      return res.json({
        ok: true,
        dateISO,
        fileName,
        subpath,
        bytes: bytes.length,
        alreadyQueued,
      });
    } catch (e: any) {
      console.error("[day-log-rebuild] error", e);
      return res.status(500).json({ ok: false, error: e?.message ?? String(e) });
    }
  });

  /* ===========================================================
   * PUSH 49 (2026-05-13) — Weekly digest send (Sunday 6 PM ET)
   * -----------------------------------------------------------
   * Heartbeat-triggered weekly. Builds the same payload as the
   * existing `weekly-digest` GET helper, then formats a tutor-
   * + grandparent-friendly Markdown summary and dispatches it to
   * the project owner via `notifyOwner` (Mom). The active
   * recipients list (`listRecipients()`) is included in the
   * payload metadata so a downstream mail relay can fan out to
   * tutors + grandparents without us re-implementing SMTP here.
   *
   * The route is idempotent: if a digest row already exists for
   * the current week and was marked `emailed`, we skip the
   * second send. Same auth gate as the rest of /api/scheduled/*.
   * =========================================================== */
  app.post("/api/scheduled/weekly-digest-send", async (req: Request, res: Response) => {
    let role: string | null = null;
    try {
      const u = await sdk.authenticateRequest(req);
      role = u?.role ?? null;
    } catch {
      role = null;
    }
    if (!role || (role !== "user" && role !== "admin")) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    try {
      const payload = await (db as any).buildWeeklyDigestPayload?.();
      if (!payload) {
        return res.status(500).json({ ok: false, error: "buildWeeklyDigestPayload missing" });
      }
      const digestId = await (db as any).saveWeeklyDigest?.(payload);
      const recipients = await (db as any).listRecipients?.().catch(() => []);
      const recipientEmails: string[] = (recipients ?? []).map((r: any) => r.email).filter(Boolean);

      // Build a compact tutor-+-grandparent-friendly markdown summary.
      const lines: string[] = [];
      lines.push(`# Reagan — Weekly digest`);
      lines.push("");
      const ms = payload?.moodArc?.total ?? 0;
      if (ms > 0) {
        lines.push(
          `**Mood arc:** ${payload.moodArc.easy} easy · ${payload.moodArc.ok} ok · ${payload.moodArc.hard} hard (${ms} signal${ms === 1 ? "" : "s"})`,
        );
      } else {
        lines.push(`_No mood signals captured this week._`);
      }
      const tutors = payload?.tutorSessions?.length ?? 0;
      lines.push(`**Tutor sessions completed:** ${tutors}`);
      const flags = payload?.parentFlags?.length ?? 0;
      if (flags > 0) lines.push(`**Parent flags raised:** ${flags}`);
      const wins = payload?.confidenceWins?.length ?? 0;
      if (wins > 0) lines.push(`**Confidence wins:** ${wins} (level-ups + auto proud moments)`);
      lines.push("");
      // ─── Mastery Snapshot ────────────────────────────────────────────────────
      try {
        const masteryRows = await (db as any).subjectLevelSummary?.();
        if (masteryRows && masteryRows.length > 0) {
          lines.push("");
          lines.push("## Mastery Snapshot");
          const LIGHT = (pct: number) => pct >= 75 ? "🟢" : pct >= 40 ? "🟡" : "🔴";
          const LABEL = (pct: number) => pct >= 75 ? "Strong" : pct >= 40 ? "Developing" : "Needs work";
          const SUBJ: Record<string, string> = {
            math: "Math",
            ela: "ELA / Reading",
            science: "Science",
            social_studies: "Social Studies",
            ss: "Social Studies",
            writing: "Writing",
            history: "History",
          };
          for (const s of masteryRows as any[]) {
            const label = SUBJ[s.subjectSlug] ?? s.subjectSlug;
            const pct = Math.round(s.pctMastered ?? 0);
            const lvl = s.avgLevel != null ? Number(s.avgLevel).toFixed(1) : "—";
            lines.push(`${LIGHT(pct)} **${label}** — ${pct}% mastered · avg level ${lvl} · ${LABEL(pct)}`);
          }
        }
      } catch (e) {
        console.warn("[weekly-digest-send] mastery snapshot failed (non-fatal)", e);
      }
      lines.push(`_Auto-emailed weekly. Recipients: ${recipientEmails.length ? recipientEmails.join(", ") : "(none configured)"}._`);
      const content = lines.join("\n");

      let notifyOk = false;
      try {
        const { notifyOwner } = await import("./_core/notification");
        notifyOk = await notifyOwner({
          title: "Reagan — Weekly digest",
          content,
        });
      } catch (e) {
        console.error("[weekly-digest-send] notifyOwner failed", e);
        notifyOk = false;
      }

      if (notifyOk && digestId) {
        try { await (db as any).markDigestEmailed?.(digestId, "sent"); } catch { /* non-fatal */ }
      }

      return res.json({
        ok: true,
        digestId,
        notifyOk,
        recipientCount: recipientEmails.length,
        contentBytes: new TextEncoder().encode(content).length,
      });
    } catch (e: any) {
      console.error("[weekly-digest-send] error", e);
      return res.status(500).json({ ok: false, error: e?.message ?? String(e) });
    }
  });

  /* ===========================================================
   * PUSH 47 (2026-05-13) — Nightly analytics CSV cron
   * -----------------------------------------------------------
   * Heartbeat-triggered at 8:05 PM ET. Builds yesterday-or-today's
   * Mom-only analytics CSV via `enqueueDailyAnalyticsExport`, which
   * is itself idempotent (skips a re-queue if pending row already
   * has the exact same contentText). The route is auth-gated to
   * match the rest of the `/api/scheduled/*` family — only an
   * authenticated `user|admin` (or the heartbeat service itself,
   * which forwards its OAuth token) can trigger it.
   *
   * Defaults to today's ET date so an 8 PM trigger captures the day
   * that just ended. Tests + the Settings panel can override via
   * `dateISO` in the JSON body.
   * =========================================================== */
  app.post("/api/scheduled/nightly-analytics-csv", async (req: Request, res: Response) => {
    let role: string | null = null;
    try {
      const u = await sdk.authenticateRequest(req);
      role = u?.role ?? null;
    } catch {
      role = null;
    }
    if (!role || (role !== "user" && role !== "admin")) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    try {
      const dateISO = (req.body?.dateISO as string | undefined) ?? nowETDateISO();
      const result = await (db as any).enqueueDailyAnalyticsExport?.(dateISO);
      if (!result) {
        return res.status(500).json({ ok: false, error: "enqueueDailyAnalyticsExport missing" });
      }
      return res.json({ ok: result.ok === true, dateISO, ...result });
    } catch (e: any) {
      console.error("[nightly-analytics-csv] error", e);
      return res.status(500).json({ ok: false, error: e?.message ?? String(e) });
    }
  });

  /* ===========================================================
   * PUSH (2026-06-18) — Nightly self-check / auto-fix cron
   * -----------------------------------------------------------
   * Heartbeat-triggered overnight. Bounded safety net that
   * repairs the three known silent-corruption classes:
   *   1. AM/PM "+12h" leading-run block times
   *   2. Duplicate pending drivePushQueue rows
   *   3. Placeholder profile photos (example.com/...)
   * Notifies the owner (Mom) ONLY when something was actually
   * repaired, so a clean night stays quiet. Auth-gated to the
   * same user|admin (or heartbeat) family as the rest of
   * /api/scheduled/*. Accepts optional { todayISO, lookbackDays,
   * lookaheadDays, dryRun } overrides for tests + the Settings
   * panel.
   * =========================================================== */
  app.post("/api/scheduled/nightly-self-check", async (req: Request, res: Response) => {
    // Dual auth (shared bearer OR cookie role) — matches the other
    // platform-fired crons so the Heartbeat caller (no user role) is accepted.
    const bearerHeader = String(req.headers["authorization"] ?? req.headers["Authorization" as any] ?? "");
    const bearerOk = !!ENV.scheduledBearer && bearerHeader.startsWith("Bearer ") && bearerHeader.slice(7).trim() === ENV.scheduledBearer;
    let role: string | null = null;
    if (!bearerOk) {
      try {
        const u = await sdk.authenticateRequest(req);
        role = u?.role ?? null;
      } catch {
        role = null;
      }
    }
    if (!bearerOk && (!role || (role !== "user" && role !== "admin"))) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    try {
      const body = (req.body ?? {}) as {
        todayISO?: string;
        lookbackDays?: number;
        lookaheadDays?: number;
        dryRun?: boolean;
      };
      const report = await (db as any).runNightlySelfCheck({
        todayISO: body.todayISO,
        lookbackDays: body.lookbackDays,
        lookaheadDays: body.lookaheadDays,
        dryRun: body.dryRun === true,
      });

      // Ping the owner ONLY for notify-worthy conditions (not routine auto-
      // repairs). `summarizeReport` returns null for clean runs AND for runs
      // whose only changes were routine auto-fixes (AM/PM clamps, dup-pending
      // collapses, placeholder-photo clears) — so those stay silent per Katy's
      // 2026-06-18 directive. The guard below still short-circuits clean/dry-run.
      let notified = false;
      if (!report.clean && body.dryRun !== true) {
        try {
          const { summarizeReport } = await import("./_lib/selfCheck");
          const summary = summarizeReport(report);
          if (summary) {
            const { notifyOwner } = await import("./_core/notification");
            notified = await notifyOwner(summary);
          }
        } catch (e) {
          console.error("[nightly-self-check] notifyOwner failed", e);
        }
      }

      return res.json({ ok: true, notified, report });
    } catch (e: any) {
      console.error("[nightly-self-check] error", e);
      return res.status(500).json({ ok: false, error: e?.message ?? String(e) });
    }
  });
}

/* ===========================================================
 * Day-log markdown renderer (exported for tests).
 * =========================================================== */
export function renderDayLogMarkdown(
  dateISO: string,
  plannedBlocks: Array<{ id?: number; startTime?: string | null; durationMin?: number | null; title?: string | null; subject?: { name?: string; slug?: string } | null }>,
  actualEntries: Array<{ subjectSlug?: string; topic?: string; minutesSpent?: number; source?: string; notes?: string | null; createdBy?: string | null; createdAt?: number | Date | null }>,
): string {
  const lines: string[] = [];
  lines.push(`# Reagan — Day Log — ${dateISO}`);
  lines.push("");
  lines.push(`_Auto-built by daily-log-rebuild. Planned vs Actual side-by-side. Source of truth for curriculum coverage = the Actual section._`);
  lines.push("");
  lines.push("## Planned");
  if (!plannedBlocks.length) {
    lines.push("_(no planned blocks)_");
  } else {
    for (const b of plannedBlocks) {
      const time = b.startTime ?? "--:--";
      const mins = b.durationMin ?? 0;
      const subj = b.subject?.name ?? "";
      const title = b.title ?? "(untitled)";
      lines.push(`- **${time}** — ${subj}${subj ? " — " : ""}${title} _(${mins} min planned)_`);
    }
  }
  lines.push("");
  lines.push("## Actual");
  if (!actualEntries.length) {
    lines.push("_(no actual entries yet — awaiting Reagan check-in, adult quick-entry, Kiwi-listened pass, or Grandma recap reply)_");
  } else {
    for (const e of actualEntries) {
      const subj = e.subjectSlug ?? "other";
      const topic = e.topic ?? "(no topic)";
      const mins = e.minutesSpent ?? 0;
      const src = e.source ?? "unknown";
      const notes = e.notes ? ` — ${e.notes}` : "";
      lines.push(`- **${subj}** — ${topic} _(${mins} min, source: ${src})_${notes}`);
    }
  }
  lines.push("");
  lines.push(`_Generated at ${new Date().toISOString()}._`);
  return lines.join("\n");
}

