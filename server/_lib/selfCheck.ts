/**
 * selfCheck.ts — pure helpers for the nightly self-check / auto-fix job.
 *
 * Why this exists (2026-06-18):
 *   Three classes of silent data corruption have bitten this dashboard:
 *     1. AM/PM "+12h" block times — a generated morning warm-up lands at
 *        21:00–23:30 instead of 09:00–11:30 (see dayStartSanity.ts).
 *     2. Duplicate pending drivePushQueue rows for the same
 *        (targetFolder, fileName) — folder/file churn for Mom & Grandma.
 *     3. Placeholder profile photos (https://example.com/...) shadowing
 *        Reagan's real avatar.
 *
 *   We already fixed each at the point it happens, but generation runs
 *   unattended overnight. This job is the safety net: scan the near-term
 *   window, repair the safe cases deterministically, and tell the owner what
 *   changed — bounded so it can never run away (fixed date window, capped
 *   row counts, idempotent repairs).
 *
 * This file is PURE: it only shapes/labels data the DB layer hands it. All
 * reads/writes happen in db.ts so this stays trivially unit-testable.
 */

import { normalizeDayStart, type TimedItem } from "./dayStartSanity";

/** A single block as the self-check sees it (subset of scheduleBlocks). */
export type SelfCheckBlock = TimedItem & {
  id: number;
  sortOrder?: number;
};

/** One day's blocks, ordered by sortOrder, for AM/PM evaluation. */
export type SelfCheckDay = {
  dateISO: string;
  /** Optional free-text intent (notes) — honors explicit evening intent. */
  intentText?: string | null;
  blocks: SelfCheckBlock[];
};

/** A concrete startTime correction the job intends to write back. */
export type BlockTimeFix = {
  dateISO: string;
  blockId: number;
  from: string | null | undefined;
  to: string;
};

/**
 * Given a day's ordered blocks, return the exact per-block startTime
 * corrections (if any) using the same narrow leading-run logic the
 * read-time clamp uses. Returns [] when the day is already clean.
 */
export function planTimeFixes(day: SelfCheckDay): BlockTimeFix[] {
  const ordered = [...day.blocks].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
  );
  const { items, corrected } = normalizeDayStart(ordered, day.intentText);
  if (!corrected) return [];

  const fixes: BlockTimeFix[] = [];
  for (let i = 0; i < ordered.length; i++) {
    const before = ordered[i].startTime ?? null;
    const after = items[i].startTime ?? null;
    if (after != null && after !== before) {
      fixes.push({
        dateISO: day.dateISO,
        blockId: ordered[i].id,
        from: before,
        to: after,
      });
    }
  }
  return fixes;
}

/** Aggregate the corrections across many days. */
export function planAllTimeFixes(days: SelfCheckDay[]): BlockTimeFix[] {
  const out: BlockTimeFix[] = [];
  for (const d of days) out.push(...planTimeFixes(d));
  return out;
}

/** A duplicate-pending-row group the job will collapse to one row. */
export type DuplicatePendingGroup = {
  targetFolder: string;
  fileName: string;
  /** All pending row ids in this group, newest-first. */
  ids: number[];
  /** ids to delete (everything except the newest). */
  removeIds: number[];
};

export type PendingRow = {
  id: number;
  targetFolder: string;
  fileName: string;
  /** ms-epoch; higher = newer. Missing → treated as oldest. */
  createdAt?: number | null;
  /** SHA-256 of the file bytes/content the row will push, if known. */
  contentHash?: string | null;
};

/**
 * Identify TRUE duplicate pending Drive-push rows — conservatively.
 *
 * Only rows that share the SAME (targetFolder, fileName, contentHash) AND have
 * a non-empty contentHash are considered duplicates. This guarantees we never
 * delete a pending row whose content differs from the one we keep (e.g. an
 * updated day-log superseding an older queued version): those are left alone.
 *
 * Within a true-duplicate group we keep the newest row and mark the rest for
 * removal. Stable + deterministic.
 */
export function planDuplicatePendingRemovals(
  rows: PendingRow[],
): DuplicatePendingGroup[] {
  const groups = new Map<string, PendingRow[]>();
  for (const r of rows) {
    const hash = (r.contentHash ?? "").trim();
    if (!hash) continue; // no hash → cannot prove it's a true duplicate → skip
    const key = `${r.targetFolder}\u0000${r.fileName}\u0000${hash}`;
    const arr = groups.get(key) ?? [];
    arr.push(r);
    groups.set(key, arr);
  }

  const out: DuplicatePendingGroup[] = [];
  for (const [key, arr] of Array.from(groups.entries())) {
    if (arr.length <= 1) continue;
    const sorted = [...arr].sort(
      (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0) || b.id - a.id,
    );
    const ids = sorted.map((r) => r.id);
    const [, fileName] = key.split("\u0000");
    out.push({
      targetFolder: sorted[0].targetFolder,
      fileName,
      ids,
      removeIds: ids.slice(1), // keep newest (index 0)
    });
  }
  return out;
}

/** True when a photoUrl is a placeholder that must not shadow the real one. */
export function isPlaceholderPhotoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const u = url.trim().toLowerCase();
  if (!u) return false;
  return (
    u.includes("example.com") ||
    u.includes("placeholder") ||
    u === "https://example.com/reagan.jpg"
  );
}

/** Structured outcome of one self-check run (for the owner notification). */
export type SelfCheckReport = {
  ranAtISO: string;
  windowDays: number;
  timeFixes: BlockTimeFix[];
  duplicatePendingRemoved: number;
  placeholderPhotosCleared: number;
  /** True when nothing needed fixing — used to suppress noisy notifications. */
  clean: boolean;
};

/** Build a concise, owner-friendly summary. Returns null when clean. */
export function summarizeReport(report: SelfCheckReport): {
  title: string;
  content: string;
} | null {
  if (report.clean) return null;

  const lines: string[] = [];
  if (report.timeFixes.length) {
    lines.push(
      `• Fixed ${report.timeFixes.length} AM/PM block time${report.timeFixes.length === 1 ? "" : "s"}:`,
    );
    for (const f of report.timeFixes.slice(0, 10)) {
      lines.push(`   – ${f.dateISO} block #${f.blockId}: ${f.from ?? "??"} → ${f.to}`);
    }
    if (report.timeFixes.length > 10) {
      lines.push(`   …and ${report.timeFixes.length - 10} more`);
    }
  }
  if (report.duplicatePendingRemoved) {
    lines.push(
      `• Removed ${report.duplicatePendingRemoved} duplicate pending Drive upload${report.duplicatePendingRemoved === 1 ? "" : "s"}.`,
    );
  }
  if (report.placeholderPhotosCleared) {
    lines.push(
      `• Cleared ${report.placeholderPhotosCleared} placeholder profile photo${report.placeholderPhotosCleared === 1 ? "" : "s"}.`,
    );
  }

  return {
    title: "Reagan Dashboard — nightly self-check made repairs",
    content: lines.join("\n"),
  };
}
