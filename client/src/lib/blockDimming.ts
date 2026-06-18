/**
 * Block dimming rule (2026-06-18)
 * --------------------------------
 * A schedule block on the Today view greys out ONLY when:
 *   - it has been checked-done (block status === "complete"), OR
 *   - every worksheet/printable pinned to it has been turned in
 *     (each printable status === "done").
 *
 * It must NEVER dim because its time slot passed, because the day has not
 * started, or because it is merely planned / in_progress. Partial turn-in
 * (some worksheets in, some still out) does NOT dim the block.
 */

export type DimBlock = { status?: string | null };
export type DimPrintable = { status?: string | null };

export function isBlockDone(
  block: DimBlock,
  blockPrintables: DimPrintable[],
): boolean {
  if (block?.status === "complete") return true;
  if (!blockPrintables || blockPrintables.length === 0) return false;
  return blockPrintables.every((m) => m?.status === "done");
}
