/**
 * Lesson hydrator for the nightly agenda packet.
 *
 * The agenda assembler wires basic block info (title, time, subject, book
 * page refs) but historically did NOT pull in lesson content (lesson plan,
 * worksheets, answer keys, videos). The PDF builder happily renders those
 * if `block.lesson` is populated, but with no hydration the lesson page
 * was always empty.
 *
 * This helper reads `assignmentsLibrary` rows for a given blockId and
 * groups them into the `lesson` shape `agendaPdf.ts` expects:
 *   - lesson_plan rows  → instructions + objectives
 *   - worksheet rows    → worksheets[]
 *   - answer_key rows   → answerKey (concatenated)
 *   - video rows        → videos[]
 *
 * Pure read; no DB writes. Returns null if no rows are pinned to the block.
 */
import * as db from "../db";
import type { AgendaPdfBlock } from "./agendaPdf";

type LessonPayload = NonNullable<AgendaPdfBlock["lesson"]>;

/**
 * v2.21 (2026-05-17): The hydrator now also pulls per-block printables
 * (the block_id-anchored daily_printables rows added in v2.19) for the
 * given date, so anything Mom attaches via `BlockPrintablesPanel` lands
 * in tomorrow's nightly packet PDF as a worksheet.
 *
 * `forDate` is optional for backward compatibility — if not supplied,
 * the hydrator behaves exactly as before (assignmentsLibrary only).
 * The agenda assembler now passes the plan date so the merge happens.
 */
export async function hydrateLessonForBlock(
  blockId: number,
  forDate?: string,
): Promise<LessonPayload | null> {
  let rows: any[] = [];
  try {
    rows = await db.listAssignmentsLibrary({ blockId, limit: 100 });
  } catch {
    rows = [];
  }

  // Pull per-block printables (v2.19) for this date, if we know the date.
  // These get appended to lesson.worksheets[] alongside any
  // assignmentsLibrary worksheet rows.
  let blockPrintables: any[] = [];
  if (forDate) {
    try {
      blockPrintables = (await db.listDailyPrintablesForBlock(
        forDate,
        String(blockId),
      )) as any[];
    } catch {
      blockPrintables = [];
    }
  }

  if (
    (!Array.isArray(rows) || rows.length === 0) &&
    (!Array.isArray(blockPrintables) || blockPrintables.length === 0)
  ) {
    return null;
  }

  const lesson: LessonPayload = {
    instructions: null,
    objectives: null,
    materials: null,
    videos: [],
    worksheets: [],
    answerKey: null,
  };

  const instructionsParts: string[] = [];
  const answerKeyParts: string[] = [];

  for (const r of rows) {
    const type = String(r.type ?? "").toLowerCase();
    const title = String(r.title ?? "").trim();
    const notes = r.notes ? String(r.notes).trim() : "";
    const url = r.fileLink || r.sourceUrl || null;

    switch (type) {
      case "lesson_plan":
      case "lesson":
        if (notes) instructionsParts.push(notes);
        else if (title) instructionsParts.push(title);
        break;
      case "worksheet":
      case "quiz":
      case "activity":
      case "app_activity":
        lesson.worksheets!.push({
          title: title || "Worksheet",
          description: notes || null,
          // questions are not modeled per-row in assignmentsLibrary today;
          // leave null so PDF skips the inline questions list. The
          // printableUrl link still lets adults open the source.
          questions: null,
          printableUrl: url,
        });
        break;
      case "answer_key":
        // Prefer notes (the actual key body), fall back to title.
        if (notes) answerKeyParts.push(notes);
        else if (title) answerKeyParts.push(title);
        break;
      case "video":
        lesson.videos!.push({
          title: title || "Video",
          url: url || "",
          description: notes || null,
        });
        break;
      // "reading" / "slideshow" / "other" / "project" intentionally not
      // surfaced as their own section yet — they show up in the block
      // description on the summary page.
      default:
        break;
    }
  }

  // Append per-block printables as worksheets so they print in tomorrow's
  // packet alongside any assignmentsLibrary worksheets. We dedupe by URL
  // so a printable that's ALSO an assignmentsLibrary row doesn't get
  // double-rendered.
  const seenUrls = new Set<string>(
    (lesson.worksheets ?? [])
      .map((w) => (w.printableUrl || "").trim())
      .filter(Boolean),
  );
  for (const p of blockPrintables) {
    const url: string | null =
      p.sourceUrl || p.source_url || p.fileLink || p.url || null;
    if (url && seenUrls.has(url.trim())) continue;
    const title = String(p.title ?? "").trim() || "Printable";
    const desc = p.description ? String(p.description).trim() : null;
    lesson.worksheets!.push({
      title,
      description: desc,
      questions: null,
      printableUrl: url,
    });
    if (url) seenUrls.add(url.trim());
  }

  if (instructionsParts.length > 0) {
    lesson.instructions = instructionsParts.join("\n\n");
  }
  if (answerKeyParts.length > 0) {
    lesson.answerKey = answerKeyParts.join(" | ");
  }

  // If after grouping we still have no lesson content, return null so the
  // PDF skips the per-block lesson page entirely.
  const hasContent =
    !!lesson.instructions ||
    !!lesson.answerKey ||
    (lesson.worksheets?.length ?? 0) > 0 ||
    (lesson.videos?.length ?? 0) > 0;

  return hasContent ? lesson : null;
}
