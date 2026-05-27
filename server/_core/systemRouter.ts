import { z } from "zod";
import { notifyOwner } from "./notification";
import { listHeartbeatJobs } from "./heartbeat";
import {
  adminProcedure,
  publicProcedure,
  router,
} from "./trpc";

/**
 * v2.97.3 (2026-05-27) — Automation Health
 *
 * Lists every heartbeat job registered for this project + its last fired /
 * next fire timestamps so Mom + Grandma can glance at "is the agenda email
 * actually running?" without having to ask the agent.
 *
 * Per-job status is derived client-side from `lastExecutedAt` + `isEnable`:
 *   - paused              → isEnable === false
 *   - never_run           → no lastExecutedAt
 *   - healthy             → fired within (cron interval × 2.5)
 *   - stale               → fired earlier than that window
 *
 * Detailed per-run status (success / failed / timeout) requires the heartbeat
 * `logs` API which the SDK doesn't currently expose. For now, the card shows
 * the high-level "is it running" pill + last-fired timestamp. A future round
 * can add the logs pull when needed.
 */
export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  /**
   * Owner-only (adultProcedure would expose owner identity to non-owner
   * editors; we keep this on adminProcedure for now since it surfaces the
   * upstream Heartbeat job list as-is).
   */
  heartbeatHealth: adminProcedure.query(async ({ ctx }) => {
    try {
      const r = await listHeartbeatJobs(
        (ctx as any).userSession ?? "",
        { page: 1, pageSize: 100 }
      );
      const now = Date.now();
      const jobs = r.jobs.map((j) => {
        const lastFiredMs = j.lastExecutedAt
          ? Date.parse(j.lastExecutedAt)
          : null;
        const nextFireMs = j.nextExecutionAt
          ? Date.parse(j.nextExecutionAt)
          : null;
        let status: "paused" | "never_run" | "healthy" | "stale" = "healthy";
        if (!j.isEnable) {
          status = "paused";
        } else if (!lastFiredMs) {
          status = "never_run";
        } else if (nextFireMs) {
          const expectedInterval = nextFireMs - lastFiredMs;
          // tolerate 2.5x interval before flagging stale
          if (now - lastFiredMs > expectedInterval * 2.5) {
            status = "stale";
          }
        }
        return {
          taskUid: j.taskUid,
          name: j.name,
          description: j.description ?? "",
          cron: j.cronExpression,
          callbackPath: j.callbackPath,
          isEnable: j.isEnable,
          lastFiredAt: j.lastExecutedAt ?? null,
          nextFireAt: j.nextExecutionAt ?? null,
          status,
        };
      });
      // Sort: stale + never_run + paused first (attention items),
      // then healthy ordered by next fire.
      jobs.sort((a, b) => {
        const order = { stale: 0, never_run: 1, paused: 2, healthy: 3 } as const;
        const ao = order[a.status as keyof typeof order];
        const bo = order[b.status as keyof typeof order];
        if (ao !== bo) return ao - bo;
        const at = a.nextFireAt ? Date.parse(a.nextFireAt) : Number.MAX_SAFE_INTEGER;
        const bt = b.nextFireAt ? Date.parse(b.nextFireAt) : Number.MAX_SAFE_INTEGER;
        return at - bt;
      });
      return {
        ok: true as const,
        jobs,
        fetchedAt: new Date().toISOString(),
      };
    } catch (e: any) {
      return {
        ok: false as const,
        error: e?.message ?? String(e),
        jobs: [] as Array<{
          taskUid: string;
          name: string;
          description: string;
          cron: string;
          callbackPath: string;
          isEnable: boolean;
          lastFiredAt: string | null;
          nextFireAt: string | null;
          status: "paused" | "never_run" | "healthy" | "stale";
        }>,
        fetchedAt: new Date().toISOString(),
      };
    }
  }),
});
