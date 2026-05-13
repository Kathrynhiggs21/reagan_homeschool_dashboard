/**
 * Push 105 (2026-05-13) — Agenda prompt diff applier.
 *
 * Push 88 produced a deterministic AgendaDiffResult (ops + summary +
 * directives). This module is the deterministic *applier* that takes
 * the same block list + a diff and returns the new block list — pure
 * function, no DB. The eventual familyAdmin mutation will:
 *   1. parse prompt → directives
 *   2. apply directives → diff
 *   3. show Mom the preview
 *   4. on confirm, call applyAgendaDiff(...) and write the result
 *
 * Splitting "compute diff" from "apply diff" makes review trivial: the
 * UI shows ops, the server writes only what the UI saw.
 *
 * Invariants:
 *   - completed blocks are NEVER mutated
 *   - skipBlock toggles status:"skipped" (not deleted — kept for audit)
 *   - markFun / markEasy append non-destructive tags
 *   - updateDuration is idempotent (re-apply yields same block list)
 *   - unknown blockIds in ops are silently ignored (defense if UI lags)
 */
import type {
  AgendaDiffOp,
  AgendaDiffResult,
  BlockSnapshot,
} from "./agendaPromptParser";

export interface AppliedBlock extends BlockSnapshot {
  /** Non-destructive flags appended by markFun / markEasy ops. */
  flags?: string[];
  /** Human-readable reason for the most recent edit (for audit log). */
  lastEditReason?: string;
}

export interface ApplyAgendaDiffResult {
  blocks: AppliedBlock[];
  appliedOpCount: number;
  ignoredOpCount: number;
  perBlockReasons: Record<number, string[]>;
}

export function applyAgendaDiff(
  blocks: BlockSnapshot[],
  diff: AgendaDiffResult,
): ApplyAgendaDiffResult {
  // Index by id for O(1) lookups; keep an order list for stable output.
  const byId = new Map<number, AppliedBlock>();
  const order: number[] = [];
  for (const b of blocks) {
    const incoming = b as AppliedBlock;
    byId.set(b.id, {
      ...b,
      // Preserve existing flags / lastEditReason if caller passed an
      // AppliedBlock back through — required for idempotent re-apply.
      flags: Array.isArray(incoming.flags) ? [...incoming.flags] : [],
      lastEditReason: incoming.lastEditReason,
    });
    order.push(b.id);
  }

  const perBlockReasons: Record<number, string[]> = {};
  let applied = 0;
  let ignored = 0;

  const remember = (blockId: number, reason: string) => {
    if (!perBlockReasons[blockId]) perBlockReasons[blockId] = [];
    perBlockReasons[blockId].push(reason);
  };

  for (const op of diff.ops) {
    const block = byId.get(op.blockId);
    if (!block) {
      ignored++;
      continue;
    }
    if (block.status === "complete") {
      ignored++;
      continue;
    }
    if (op.kind === "updateDuration") {
      if (block.durationMin !== op.after) {
        block.durationMin = op.after;
        block.lastEditReason = op.reason;
        remember(op.blockId, op.reason);
        applied++;
      } else {
        // Idempotent — already at target; not counted as applied.
        ignored++;
      }
    } else if (op.kind === "skipBlock") {
      if (block.status !== "skipped") {
        block.status = "skipped";
        block.lastEditReason = op.reason;
        remember(op.blockId, op.reason);
        applied++;
      } else {
        ignored++;
      }
    } else if (op.kind === "markFun") {
      const tags = (block.flags ??= []);
      if (!tags.includes("fun")) {
        tags.push("fun");
        block.lastEditReason = op.reason;
        remember(op.blockId, op.reason);
        applied++;
      } else {
        ignored++;
      }
    } else if (op.kind === "markEasy") {
      const tags = (block.flags ??= []);
      if (!tags.includes("easy")) {
        tags.push("easy");
        block.lastEditReason = op.reason;
        remember(op.blockId, op.reason);
        applied++;
      } else {
        ignored++;
      }
    } else {
      // Defense: unknown op kind (future versions of Push 88).
      ignored++;
    }
  }

  return {
    blocks: order.map((id) => byId.get(id)!),
    appliedOpCount: applied,
    ignoredOpCount: ignored,
    perBlockReasons,
  };
}

/** Convenience: count distinct ops that would actually change something. */
export function countActiveOps(diff: AgendaDiffResult): number {
  return diff.ops.length;
}

/** Convenience for tests: re-export the op union. */
export type { AgendaDiffOp };
