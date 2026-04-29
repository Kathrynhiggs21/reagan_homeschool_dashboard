import type { Express, Request, Response } from "express";
import * as db from "./db";

/**
 * Endpoint the daily Manus scheduled task POSTs to with already-classified items
 * pulled from Gmail / Google Drive. The scheduled-task agent has the Google
 * scopes; the deployed site is just the persistence target.
 *
 * Auth model: cookie-gated by the platform-injected SCHEDULED_TASK_COOKIE on
 * the scheduler side. We accept any caller server-side and rely on platform
 * cookie middleware + the fact that the only writes performed are append-only
 * sync_runs and downstream classifyAndRoute calls (which themselves create
 * routine, parent-visible audit rows).
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

      for (const raw of items) {
        try {
          const result = await db.classifyAndRoute(raw);
          await db.appendSyncRunItem({
            runId: run.id,
            source: raw.kind === "email" ? "gmail" : source === "both" ? "drive" : (source as "gmail" | "drive"),
            externalId: String(raw.externalId ?? raw.fileUrl ?? raw.url ?? `${Date.now()}-${routed}`),
            routedTo: result.routedTo,
            recordId: result.recordId,
            title: raw.subject ?? raw.title ?? raw.fileName ?? null,
            message: result.message,
          });
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
      });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e?.message ?? String(e) });
    }
  });

  /** Read endpoint the scheduled-task agent calls before running, to learn
   *  which sources / lookback windows the parent has manually requested. */
  app.get("/api/scheduled/upload-sync/pending", async (_req: Request, res: Response) => {
    try {
      const pending = await db.popPendingSyncRequests();
      return res.json({ ok: true, pending });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e?.message ?? String(e) });
    }
  });
}
