import type { Express, Request, Response } from "express";
import * as db from "./db";
import { sdk } from "./_core/sdk";

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
    try {
      const rows = await db.listPendingDrivePushes(100);
      return res.json({ ok: true, count: rows.length, items: rows });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e?.message ?? String(e) });
    }
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

  /* ====================== POWERSCHOOL INGEST (daily scraper) ====================== */
  app.post("/api/scheduled/powerschool/ingest", async (req: Request, res: Response) => {
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
      const { raw, source } = req.body ?? {};
      if (typeof raw !== "string" || raw.length < 10) {
        return res.status(400).json({ ok: false, error: "Expected { raw: string }" });
      }
      const { parsePowerSchoolPaste } = await import("./_lib/powerschoolParser");
      const parsed = parsePowerSchoolPaste(raw);
      const importRow = await db.recordPowerschoolImport({
        source: source ?? "scraper",
        rawBody: raw,
        parsedCount: parsed.grades.length + parsed.assignments.length,
        errorCount: parsed.unparsedLines.length,
        notes: parsed.notes.join(" · "),
        importedBy: "scheduled-task",
      });
      await db.bulkInsertPowerschoolGrades(importRow.id, parsed.grades);
      await db.bulkInsertPowerschoolAssignments(importRow.id, parsed.assignments);
      return res.json({
        ok: true,
        importId: importRow.id,
        grades: parsed.grades.length,
        assignments: parsed.assignments.length,
        unparsed: parsed.unparsedLines.length,
        kind: parsed.kind,
      });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e?.message ?? String(e) });
    }
  });
}
