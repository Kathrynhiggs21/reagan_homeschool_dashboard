/**
 * Overnight push 2026-05-14 — worksheet auto-prep planner (pure helper).
 *
 * Mom's rule: "every block must have a printable worksheet ready by 8 PM
 * the night before, no Mom intervention." The nightly-lesson-gen scheduled
 * job already drafts the next school day's blocks at 9 PM. This planner
 * takes those committed blocks and decides which ones need a worksheet
 * (vs. reading-only / movement / break) and what the LLM prompt should be.
 *
 * Pure: no DB / no IO. Caller takes the resulting WorkItems, runs them
 * through `invokeLLM` + `upsertAnswerKey`, and PDFs each via the existing
 * agenda PDF assembler.
 */

export interface PlannedBlockForPrep {
  blockId: number;
  blockTitle: string;
  subjectSlug?: string | null;
  subjectName?: string | null;
  /** "read pg 12-18 of Tuck Everlasting" / "Place Value practice" / etc. */
  details?: string | null;
  curriculumTopicCode?: string | null;
  /** True if Mom (or AI) tagged the block as reading / movement / break /
   *  outside; the planner should skip it. */
  kind?: "academic" | "reading_only" | "movement" | "break" | "specials";
  /** True if the block already has an answer key — skip. */
  hasAnswerKey?: boolean;
}

export interface WorksheetWorkItem {
  blockId: number;
  prompt: string;
  expectedQuestions: number;
  totalPoints: number;
  /** Plain-English label for Drive filenames + email body. */
  friendlyLabel: string;
}

export interface PlannerResult {
  /** Items to actually generate (in committed order). */
  workItems: WorksheetWorkItem[];
  /** Items the planner deliberately skipped, with a one-word reason. */
  skipped: Array<{
    blockId: number;
    reason:
      | "already_has_answer_key"
      | "reading_only"
      | "movement"
      | "break"
      | "specials"
      | "missing_subject";
  }>;
}

const ACADEMIC_SUBJECT_DEFAULTS: Record<string, { qs: number; pts: number }> = {
  math: { qs: 8, pts: 100 },
  reading: { qs: 5, pts: 100 },
  ela: { qs: 6, pts: 100 },
  science: { qs: 6, pts: 100 },
  social_studies: { qs: 6, pts: 100 },
};

function inferKind(b: PlannedBlockForPrep): NonNullable<PlannedBlockForPrep["kind"]> {
  if (b.kind) return b.kind;
  const t = (b.blockTitle || "").toLowerCase();
  // Reading-only triggers: explicit "read" verb, or famous reading book
  // titles (Tuck Everlasting). Workbook brand names like "Spectrum" alone
  // are NOT reading-only — those are quiz/practice blocks.
  if (/\bread\b|tuck everlasting|chapter \d|story time/.test(t)) {
    return "reading_only";
  }
  if (/(stretch|movement|recess|outside|outdoor|walk|yoga)/.test(t)) {
    return "movement";
  }
  if (/(snack|lunch|break|rest)/.test(t)) return "break";
  if (/(art|music|pe |gym|specials)/.test(t)) return "specials";
  return "academic";
}

export function planWorksheetAutoPrep(
  blocks: PlannedBlockForPrep[],
): PlannerResult {
  const workItems: WorksheetWorkItem[] = [];
  const skipped: PlannerResult["skipped"] = [];

  for (const b of blocks) {
    if (b.hasAnswerKey) {
      skipped.push({ blockId: b.blockId, reason: "already_has_answer_key" });
      continue;
    }
    const kind = inferKind(b);
    if (kind === "reading_only") {
      skipped.push({ blockId: b.blockId, reason: "reading_only" });
      continue;
    }
    if (kind === "movement") {
      skipped.push({ blockId: b.blockId, reason: "movement" });
      continue;
    }
    if (kind === "break") {
      skipped.push({ blockId: b.blockId, reason: "break" });
      continue;
    }
    if (kind === "specials") {
      skipped.push({ blockId: b.blockId, reason: "specials" });
      continue;
    }
    if (!b.subjectSlug && !b.subjectName) {
      skipped.push({ blockId: b.blockId, reason: "missing_subject" });
      continue;
    }

    const subjectKey = (b.subjectSlug ?? b.subjectName ?? "")
      .toLowerCase()
      .replace(/\s+/g, "_");
    const defaults =
      ACADEMIC_SUBJECT_DEFAULTS[subjectKey] ?? { qs: 6, pts: 100 };

    const subjectLabel = b.subjectName ?? subjectKey ?? "Academic";
    const topicLabel = b.curriculumTopicCode
      ? ` (curriculum ${b.curriculumTopicCode})`
      : "";
    const detailsLine = b.details
      ? `\nContext from the day's plan: ${b.details}`
      : "";

    const prompt = [
      `Write a 5th-grade ${subjectLabel} worksheet for the block titled `,
      `"${b.blockTitle}"${topicLabel}.`,
      detailsLine,
      `\nReturn STRICT JSON: {"questions":[{"qId":"q1","kind":"mc"|"text","prompt":string,"correct":string,"rubric":string}], "totalPoints":${defaults.pts}}.`,
      `\nMake exactly ${defaults.qs} questions. Mix multiple-choice and short-answer. Keep wording at a 5th-grade reading level.`,
    ].join("");

    workItems.push({
      blockId: b.blockId,
      prompt,
      expectedQuestions: defaults.qs,
      totalPoints: defaults.pts,
      friendlyLabel: `${subjectLabel} - ${b.blockTitle}`,
    });
  }

  return { workItems, skipped };
}
