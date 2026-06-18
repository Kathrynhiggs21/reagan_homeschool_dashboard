/**
 * v3.31 (2026-06-03) — Nightly packet audit.
 *
 * After the agenda assembler hydrates every block, this pure function checks
 * that each CONTENT-bearing block ended up with real, do-able work:
 *   - a lesson with instructions / objectives, OR
 *   - at least one worksheet (questions or a printable URL), OR
 *   - a generated activity (video, adventure, practice, read-aloud), OR
 *   - book page references.
 *
 * Non-content blocks are exempt: `appointment` (lunch / break / movement /
 * doctor) and `adventure` (hands-on movement — carries its own materials +
 * numbered steps via `generated`, not a worksheet).
 *
 * Katy's hard rule: a content block must NEVER print as a bare title with
 * blank lines. The deterministic fallback in `synthesizeLessonForBlock`
 * should prevent that, but this audit is the belt-and-suspenders check that
 * proves it block-by-block and surfaces any silent gap.
 *
 * Pure: no DB, no network, never throws. The assembler decides what to do
 * with a non-empty `emptyBlocks` list (log + notify owner).
 */

import type { AgendaPdfBlock } from "./agendaPdf";
import { isMorningVibeBlock } from "./slayChargeMorningVibe";

/** Block types that are NOT expected to carry worksheet-style content. */
export const NON_CONTENT_BLOCK_TYPES = new Set<string>([
  "appointment", // lunch / break / movement / doctor / errand
  "adventure", // hands-on movement; carries its own steps via `generated`
  // The daily "Slay Charge" / Summer charge morning-vibe block is an
  // intentional 5-minute mood-setter (joke / clip), NOT schoolwork — it
  // deliberately has no lesson / worksheet / video. Exempt both the current
  // and legacy block-type ids so the nightly audit never flags it as
  // "printed with no work". (2026-06-17, Katy: stop the false-positive email.)
  "morning_vibe",
  "morning_warmup",
]);

export interface AuditBlockInput {
  blockId: number;
  sortOrder: number;
  title: string;
  blockType?: string | null;
  block: AgendaPdfBlock;
}

export interface AuditEmptyBlock {
  blockId: number;
  sortOrder: number;
  title: string;
  blockType: string;
  reason: string;
}

export interface PacketAuditResult {
  forDate: string;
  totalBlocks: number;
  contentBlocks: number;
  emptyBlocks: AuditEmptyBlock[];
  ok: boolean; // true when no content block is empty
}

/** Does this block have any real, do-able content? */
export function blockHasContent(block: AgendaPdfBlock): boolean {
  const lesson = block.lesson;
  if (lesson) {
    const hasInstr =
      typeof lesson.instructions === "string" &&
      lesson.instructions.trim().length > 0;
    const hasObjectives =
      Array.isArray(lesson.objectives) && lesson.objectives.length > 0;
    const hasWorksheet =
      Array.isArray(lesson.worksheets) &&
      lesson.worksheets.some(
        (w) =>
          (Array.isArray(w.questions) && w.questions.length > 0) ||
          (typeof w.printableUrl === "string" && w.printableUrl.trim().length > 0) ||
          (typeof (w as any).resolvedUrl === "string" &&
            (w as any).resolvedUrl.trim().length > 0),
      );
    const hasVideo = Array.isArray(lesson.videos) && lesson.videos.length > 0;
    const hasAnswerKey =
      typeof lesson.answerKey === "string" && lesson.answerKey.trim().length > 0;
    if (hasInstr || hasObjectives || hasWorksheet || hasVideo || hasAnswerKey) {
      return true;
    }
  }

  // A generated activity (video QR, adventure, practice, read-aloud) counts.
  const gen = (block as any).generated;
  if (gen && typeof gen === "object") {
    if (gen.kind || gen.operable || gen.printable || gen.summary) return true;
  }

  // Book page references count (the kid reads the book).
  if (Array.isArray(block.bookPageRefs) && block.bookPageRefs.length > 0) {
    return true;
  }

  return false;
}

/**
 * Audit a fully-assembled packet. `blockTypeByOrder` maps the block's
 * 1-indexed sortOrder back to its DB blockType (the AgendaPdfBlock shape does
 * not carry blockType, so the assembler passes it alongside).
 */
export function auditPacket(
  forDate: string,
  blocks: AgendaPdfBlock[],
  blockTypeBySortOrder: Map<number, string>,
): PacketAuditResult {
  const emptyBlocks: AuditEmptyBlock[] = [];
  let contentBlocks = 0;

  for (const b of blocks) {
    const blockType = String(blockTypeBySortOrder.get(b.sortOrder) ?? "").toLowerCase();
    if (NON_CONTENT_BLOCK_TYPES.has(blockType)) continue;
    // Belt-and-suspenders: also exempt the daily morning-vibe / Slay Charge
    // mood-setter by title, in case it was ever saved under a different type.
    if (isMorningVibeBlock({ blockType, title: b.title })) continue;
    contentBlocks++;
    if (!blockHasContent(b)) {
      emptyBlocks.push({
        blockId: -1, // not carried on AgendaPdfBlock; sortOrder identifies it
        sortOrder: b.sortOrder,
        title: b.title,
        blockType: blockType || "(unknown)",
        reason:
          "No lesson instructions/objectives, no worksheet (questions or printable), no video, no answer key, no generated activity, and no book pages.",
      });
    }
  }

  return {
    forDate,
    totalBlocks: blocks.length,
    contentBlocks,
    emptyBlocks,
    ok: emptyBlocks.length === 0,
  };
}

/** Build a concise owner-notification body for an audit with empty blocks. */
export function formatAuditNotification(result: PacketAuditResult): {
  title: string;
  content: string;
} {
  const n = result.emptyBlocks.length;
  const lines = result.emptyBlocks
    .slice(0, 10)
    .map(
      (e) =>
        `• Block ${e.sortOrder} "${e.title}" (${e.blockType}) — ${e.reason}`,
    );
  if (result.emptyBlocks.length > 10) {
    lines.push(`…and ${result.emptyBlocks.length - 10} more.`);
  }
  return {
    title: `⚠️ Reagan's packet for ${result.forDate}: ${n} block${n === 1 ? "" : "s"} printed with no work`,
    content:
      `The nightly packet audit found ${n} content block${n === 1 ? "" : "s"} ` +
      `with no real printable work (the deterministic fallback should have caught this).\n\n` +
      lines.join("\n") +
      `\n\nReagan can still do the rest of the packet; please add work to the block${n === 1 ? "" : "s"} above when you get a chance.`,
  };
}
