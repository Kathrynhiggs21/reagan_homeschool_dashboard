import type { Express, Request, Response } from "express";
import * as db from "./db";
import { sdk } from "./_core/sdk";

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

      return res.json({ ok: true, dateStr, dayLabel, status: "created", blocksAdded: added, summary: draft.summary, warnings: draft.warnings });
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
    let role: string | null = null;
    try {
      const u = await sdk.authenticateRequest(req);
      role = u?.role ?? null;
    } catch { role = null; }
    if (!role || (role !== "user" && role !== "admin")) {
      return res.status(401).json({ ok: false, error: "Unauthorized \u2014 scheduled-task cookie required." });
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
      const recipients: string[] = Array.isArray(req.body?.recipients) && req.body.recipients.length > 0
        ? req.body.recipients
        : ["marcy.spear@gmail.com", "spear.cpt@gmail.com"];
      const force = !!req.body?.force;

      const { assembleAgendaForDate } = await import("./_lib/agendaAssembler");
      const { buildAgendaPdf } = await import("./_lib/agendaPdf");
      const { storagePut } = await import("./storage");

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

      // Upload PDF
      const fileKey = `nightly-agendas/${forDate}/agenda_${agendaHash.slice(0, 8)}.pdf`;
      const { key, url } = await storagePut(fileKey, pdfBuffer, "application/pdf");

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
      const html = `<!doctype html><html><body style=\"font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#222;max-width:680px;margin:0 auto;padding:20px;\">
<div style=\"text-align:center;margin-bottom:8px;\"><div style=\"font-size:22px;font-weight:800;color:#1f3a2e;\">${payload.studentName}'s School Plan</div><div style=\"color:#666;font-size:14px;\">${payload.dayLabel}</div></div>
${tutorLine}
<div style=\"margin:20px 0;padding:14px 16px;border-left:4px solid #1f3a2e;background:#fafafa;border-radius:8px;\">${blockListHtml || '<div style=\"color:#888;\">No blocks scheduled.</div>'}</div>
<p style=\"font-size:12px;color:#888;text-align:center;margin-top:24px;\">PDF agenda attached. If anything changes before school start, this email will be re-sent automatically.</p>
</body></html>`;

      return res.json({
        ok: true,
        status: isResend ? "resend_ready" : "send_ready",
        forDate,
        agendaHash,
        recipients,
        subject,
        htmlBody: html,
        pdfStorageKey: key,
        pdfUrl: url,
        recordId,
        driveFolderHint: "Reagan / Homeschool Hub / Daily Agendas",
      });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e?.message ?? String(e) });
    }
  });

  /** Mark a queued/sent agenda row complete after gmail MCP confirms send. */
  app.post("/api/scheduled/nightly-agenda-email/result", async (req: Request, res: Response) => {
    let role: string | null = null;
    try { const u = await sdk.authenticateRequest(req); role = u?.role ?? null; } catch { role = null; }
    if (!role || (role !== "user" && role !== "admin")) {
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
}
