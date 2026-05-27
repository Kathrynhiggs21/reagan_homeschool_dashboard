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
 * v2.21 (2026-05-17): Also pulls per-block `dailyPrintables` rows for the
 * given date, so anything Mom attaches via `BlockPrintablesPanel` lands
 * in tomorrow's nightly packet PDF as a worksheet.
 *
 * v2.98 (2026-05-28): Also pulls `curriculumResources` for the block's
 * curriculum topic (uploaded PDFs, camera photos, custom lessons from the
 * 4-tab BlockResourcesPanel). This is the key path for the "print-and-go"
 * packet — every resource Mom or Grandma attaches to a block's topic now
 * flows into the nightly PDF.
 *
 * Pure read; no DB writes. Returns null if no rows are pinned to the block.
 */
import * as db from "../db";
import type { AgendaPdfBlock } from "./agendaPdf";

type LessonPayload = NonNullable<AgendaPdfBlock["lesson"]>;

export async function hydrateLessonForBlock(
  blockId: number,
  forDate?: string,
  curriculumTopicId?: number | null,
): Promise<LessonPayload | null> {
  let rows: any[] = [];
  try {
    rows = await db.listAssignmentsLibrary({ blockId, limit: 100 });
  } catch {
    rows = [];
  }

  // Pull per-block printables (v2.19) for this date, if we know the date.
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

  // v2.98: Pull curriculumResources for the block's topic (uploaded PDFs,
  // camera photos, custom lessons from BlockResourcesPanel 4-tab UI).
  let topicResources: any[] = [];
  if (curriculumTopicId) {
    try {
      topicResources = (await db.listTopicResources(curriculumTopicId)) as any[];
    } catch {
      topicResources = [];
    }
  }

  if (
    (!Array.isArray(rows) || rows.length === 0) &&
    (!Array.isArray(blockPrintables) || blockPrintables.length === 0) &&
    (!Array.isArray(topicResources) || topicResources.length === 0)
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

  // Process assignmentsLibrary rows
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
          questions: null,
          printableUrl: url,
        });
        break;
      case "answer_key":
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
      default:
        break;
    }
  }

  // Dedupe tracker — used for both printables and topic resources
  const seenUrls = new Set<string>(
    (lesson.worksheets ?? [])
      .map((w) => (w.printableUrl || "").trim())
      .filter(Boolean),
  );
  const seenVideoUrls = new Set<string>(
    (lesson.videos ?? [])
      .map((v) => (v.url || "").trim())
      .filter(Boolean),
  );

  // Append per-block printables (v2.19)
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

  // v2.98: Append curriculumResources (uploaded PDFs, camera photos, custom
  // lessons from BlockResourcesPanel). Map each kind to the right lesson slot.
  for (const r of topicResources) {
    const kind = String(r.kind ?? "").toLowerCase();
    const title = String(r.title ?? "").trim();
    const notes = r.notes ? String(r.notes).trim() : "";
    const url: string | null = r.url || null;

    switch (kind) {
      case "lesson":
      case "reading": {
        // Custom lessons and reading notes go into instructions
        const body = notes || title;
        if (body) instructionsParts.push(body);
        // If there's also a URL (e.g. uploaded PDF), surface it as a worksheet
        // link so it prints with the lesson page.
        if (url && !seenUrls.has(url.trim())) {
          lesson.worksheets!.push({
            title: title || "Lesson",
            description: notes || null,
            questions: null,
            printableUrl: url,
          });
          seenUrls.add(url.trim());
        }
        break;
      }
      case "worksheet":
      case "printable": {
        if (url && seenUrls.has(url.trim())) break;
        lesson.worksheets!.push({
          title: title || "Worksheet",
          description: notes || null,
          questions: null,
          printableUrl: url,
        });
        if (url) seenUrls.add(url.trim());
        break;
      }
      case "video": {
        if (!url) break;
        if (seenVideoUrls.has(url.trim())) break;
        lesson.videos!.push({
          title: title || "Video",
          url,
          description: notes || null,
        });
        seenVideoUrls.add(url.trim());
        break;
      }
      case "link": {
        // Generic links surface as worksheet-style entries so they print
        // with a clickable URL on the lesson page.
        if (!url || seenUrls.has(url.trim())) break;
        lesson.worksheets!.push({
          title: title || "Link",
          description: notes || null,
          questions: null,
          printableUrl: url,
        });
        seenUrls.add(url.trim());
        break;
      }
      default:
        break;
    }
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
