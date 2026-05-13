/**
 * Push 73 (2026-05-13) — Server-side helper that bridges yesterday's
 * scheduleBlocks → catchUpQueueFor().
 *
 * Pure logic + thin DB reads. Stays defensive: any missing helper or
 * empty result returns `[]` so the Today card simply self-hides.
 */
import { catchUpQueueFor, type MissedTopic, type CatchUpQueueItem } from "./catchUpEngine";
import * as db from "../db";

function isoYesterday(today: Date = new Date()): string {
  const d = new Date(today);
  d.setDate(d.getDate() - 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isoToday(today: Date = new Date()): string {
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Build the next-day catch-up queue from yesterday's scheduleBlocks.
 * - Pulls cap from `appSettings("catchUp.maxQueueSize")` (default 3, max 10).
 * - Drops topics already marked done today.
 * - Returns `{ items, cap, asOf }` so the UI can render a calm card.
 */
export async function computeNextDayCatchUpQueue(now: Date = new Date()): Promise<{
  items: CatchUpQueueItem[];
  cap: number;
  asOf: string;
}> {
  const asOf = isoToday(now);
  const yesterday = isoYesterday(now);

  // 1. Read Mom-toggle (default 3).
  let cap = 3;
  try {
    const raw = await (db as any).getAppSetting?.("catchUp.maxQueueSize");
    if (raw != null) {
      const n = parseInt(String(raw), 10);
      if (Number.isFinite(n)) cap = Math.max(0, Math.min(n, 10));
    }
  } catch {
    /* keep default */
  }
  if (cap === 0) return { items: [], cap, asOf };

  // 2. Look up yesterday's plan.
  let plan: any = null;
  try {
    plan = await (db as any).getPlanByDate?.(yesterday);
  } catch {
    /* no plan = no queue */
  }
  if (!plan?.id) return { items: [], cap, asOf };

  // 3. Read blocks; filter to "missed" planned curriculum topics.
  let blocks: any[] = [];
  try {
    blocks = ((await (db as any).listBlocksForPlan?.(plan.id)) ?? []) as any[];
  } catch {
    blocks = [];
  }

  const missed: MissedTopic[] = [];
  for (const b of blocks) {
    const status = String(b?.status ?? "");
    if (status === "complete") continue;
    const topic = (b?.title ?? "").toString().trim();
    if (!topic) continue;
    // Map subjectId → subjectSlug via the join already done in listBlocksForPlan().
    const subjectSlug =
      (b as any)?.subjectSlug ??
      (b as any)?.subject?.slug ??
      "other";
    missed.push({ subjectSlug, topic, missedOn: yesterday });
  }
  if (missed.length === 0) return { items: [], cap, asOf };

  // 4. Today's already-done keys so we don't re-nudge what she finished.
  const alreadyDoneTodayKeys: string[] = [];
  try {
    const todaysPlan = await (db as any).getPlanByDate?.(asOf);
    if (todaysPlan?.id) {
      const todays = ((await (db as any).listBlocksForPlan?.(todaysPlan.id)) ?? []) as any[];
      for (const b of todays) {
        if (String(b?.status ?? "") !== "complete") continue;
        const topic = (b?.title ?? "").toString().trim();
        if (!topic) continue;
        const subjectSlug =
          (b as any)?.subjectSlug ?? (b as any)?.subject?.slug ?? "other";
        alreadyDoneTodayKeys.push(`${subjectSlug}::${topic}`);
      }
    }
  } catch {
    /* ignore */
  }

  // 5. Run through the deterministic queue builder.
  const items = catchUpQueueFor({
    missed,
    alreadyDoneTodayKeys,
    maxQueueSize: cap,
    seed: asOf,
  });
  return { items, cap, asOf };
}
