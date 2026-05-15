/**
 * Wave-15 / Push 199 — notebookDoodleArchivePruner
 *
 * PURE deterministic helper. Decides which Notebook doodle entries
 * are kept on the live shelf vs archived (kid still sees them in
 * "Old Stuff" but they're out of the main scroll) vs hard-deleted
 * (only adult-marked junk after a long grace period).
 *
 * House rules:
 *  - Kid never loses a doodle she made on purpose. Default to KEEP.
 *  - Auto-archive ONLY after 90 days inactive AND not pinned AND
 *    not marked "favorite" by Reagan.
 *  - Hard-delete ONLY entries explicitly adult-marked junk AND
 *    older than 30 days since the junk mark (grace period).
 *  - Pinned + favorite + adult-marked-keep entries NEVER move.
 */

export interface DoodleEntry {
  id: string;
  createdIso: string;
  lastViewedIso: string;
  isPinned: boolean;
  isFavorite: boolean;
  adultMark: "none" | "keep_forever" | "junk";
  junkMarkedIso?: string | null;
}

export interface PrunerInput {
  entries: DoodleEntry[];
  isoDateLocal: string;
  archiveAfterDays?: number;
  hardDeleteJunkAfterDays?: number;
}

export type DoodleAction = "keep" | "archive" | "delete";

export interface DoodleDecision {
  id: string;
  action: DoodleAction;
  reason: string;
}

export interface PrunerResult {
  decisions: DoodleDecision[];
  counts: { keep: number; archive: number; delete: number };
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(fromIso.length === 10 ? `${fromIso}T12:00:00Z` : fromIso);
  const b = Date.parse(toIso.length === 10 ? `${toIso}T12:00:00Z` : toIso);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.floor((b - a) / (24 * 60 * 60 * 1000));
}

export function pruneDoodles(input: PrunerInput): PrunerResult {
  const archiveAfter = input.archiveAfterDays ?? 90;
  const deleteAfter = input.hardDeleteJunkAfterDays ?? 30;
  const today = input.isoDateLocal;

  const decisions: DoodleDecision[] = [];
  const counts = { keep: 0, archive: 0, delete: 0 };

  for (const e of input.entries) {
    let action: DoodleAction = "keep";
    let reason = "default keep";

    if (e.isPinned) {
      reason = "pinned";
    } else if (e.adultMark === "keep_forever") {
      reason = "adult marked keep_forever";
    } else if (e.isFavorite) {
      reason = "kid favorite";
    } else if (e.adultMark === "junk") {
      const since = e.junkMarkedIso ? daysBetween(e.junkMarkedIso, today) : 0;
      if (since >= deleteAfter) {
        action = "delete";
        reason = `adult-marked junk for ${since}d (>= ${deleteAfter}d)`;
      } else {
        action = "archive";
        reason = `adult-marked junk for ${since}d (under ${deleteAfter}d grace)`;
      }
    } else {
      const inactive = daysBetween(e.lastViewedIso, today);
      if (inactive >= archiveAfter) {
        action = "archive";
        reason = `inactive ${inactive}d (>= ${archiveAfter}d)`;
      }
    }

    decisions.push({ id: e.id, action, reason });
    counts[action]++;
  }

  return { decisions, counts };
}

export const __FOR_TEST__ = { daysBetween };
