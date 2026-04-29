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
}
