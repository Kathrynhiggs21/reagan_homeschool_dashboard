/**
 * agendaEditorAutoAttach.ts
 *
 * Pure helper that takes an AgendaEditPlan returned by the LLM and enriches
 * each `insert` op with a real example URL pulled from the AssignmentFinder
 * when the op is for a topic-request ("government video", "fractions
 * worksheet", "civil war read aloud", etc.) and has no URL of its own yet.
 *
 * Design notes:
 *  - This runs AFTER the LLM produced a structurally-valid plan and BEFORE
 *    `applyEditPlanInMemory`. We only ever DECORATE existing insert ops;
 *    we never add or drop ops, so the diff the adult sees is honest.
 *  - The finder is injected so tests can pass a stub.
 *  - The helper is fully sync-checkable: if the finder throws or returns
 *    empty, the op is left untouched (graceful degradation).
 *  - URL/description injection uses a stable marker `[Example] ` so we can
 *    detect already-enriched ops and avoid double-prefixing on re-runs.
 */
import type { AgendaEditPlan, AgendaEditOp } from "./agendaEditor";

export type FinderResultLike = {
  source: "library" | "sonar_web" | "sonar_youtube";
  title: string;
  url: string | null;
  snippet: string;
  type: "worksheet" | "video" | "lesson_plan" | "quiz" | "project" | "app_activity" | "reading" | "other";
  subjectSlug: string | null;
  estimatedMinutes: number | null;
  curriculumTopicCode: string | null;
  curriculumTopicId: number | null;
  ageAppropriate: boolean;
};

export type FinderFn = (args: {
  query: string;
  subjectSlug?: string | null;
  kidSafe?: boolean;
  /**
   * v3.16 (2026-05-30) — grade-level hint for Summer Mode.
   * When set, the underlying finder MAY weight matches whose ladder/library
   * gradeLevel equals this string higher, so Summer Mode pulls 6th-grade
   * preview content instead of 5th-grade review. Optional; finders that
   * ignore it must continue to work unchanged.
   */
  gradeLevel?: string | null;
}) => Promise<FinderResultLike[]>;

/**
 * Pure detector: does this op text describe a topic request that the
 * adult clearly wants an example resource for?
 *
 * Triggers when the title/description mentions any of the resource words
 * (video, worksheet, lesson, read aloud, activity, printable, quiz, project)
 * AND the existing description does not already contain a URL.
 */
export function shouldEnrichInsertOp(op: AgendaEditOp): boolean {
  if (op.kind !== "insert") return false;
  const title = (op.title || "").toLowerCase();
  const desc = (op.description || "").toLowerCase();
  // Already has a URL or the [Example] marker → skip.
  if (/https?:\/\//.test(desc)) return false;
  if (desc.includes("[example]")) return false;
  // Resource words anywhere in title or description.
  const RESOURCE_RE = /(video|worksheet|printable|lesson|read[- ]aloud|activity|quiz|project|brainpop|khan|ixl|youtube)/i;
  if (!RESOURCE_RE.test(title) && !RESOURCE_RE.test(desc)) return false;
  return true;
}

/**
 * Pure ranker. Given a list of FinderResults and the inferred preferred
 * resource type for an op, return the single best candidate or null.
 *
 * Ranking rules (highest → lowest):
 *   1. Library results matching the preferred type
 *   2. Sonar results matching the preferred type
 *   3. Library results of any type
 *   4. Sonar results of any type
 *   5. Anything else
 * Within each tier, items with a resolved `curriculumTopicId` win.
 * Items flagged not age-appropriate are dropped before ranking.
 */
export function pickBestFinderResult(
  results: FinderResultLike[],
  preferredType: FinderResultLike["type"] | null,
): FinderResultLike | null {
  const usable = results.filter(r => r.ageAppropriate && r.url);
  if (usable.length === 0) return null;

  const tier = (r: FinderResultLike): number => {
    const typeMatch = preferredType ? r.type === preferredType : false;
    const isLibrary = r.source === "library";
    if (isLibrary && typeMatch) return 1;
    if (!isLibrary && typeMatch) return 2;
    if (isLibrary) return 3;
    return 4;
  };

  const sorted = usable.slice().sort((a, b) => {
    const ta = tier(a);
    const tb = tier(b);
    if (ta !== tb) return ta - tb;
    // Topic-resolved wins tiebreaker.
    const ra = a.curriculumTopicId ? 0 : 1;
    const rb = b.curriculumTopicId ? 0 : 1;
    return ra - rb;
  });

  return sorted[0] ?? null;
}

/**
 * Pure inference: which resource type should we prefer for this op?
 * Returns null when we can't tell.
 */
export function inferPreferredType(op: AgendaEditOp): FinderResultLike["type"] | null {
  if (op.kind !== "insert") return null;
  const blob = `${op.title || ""} ${op.description || ""}`.toLowerCase();
  if (/\bvideo\b|\byoutube\b|\bwatch\b/.test(blob)) return "video";
  if (/\bworksheet\b|\bprintable\b/.test(blob)) return "worksheet";
  if (/\bread[- ]aloud\b|\bnovel\b|\bbook\b/.test(blob)) return "reading";
  if (/\blesson\b|\bteach\b/.test(blob)) return "lesson_plan";
  if (/\bquiz\b|\btest\b/.test(blob)) return "quiz";
  if (/\bproject\b/.test(blob)) return "project";
  return null;
}

/**
 * Build the canonical query string we pass to the finder for an op.
 * Strips block-jargon ("Custom worksheet:", "Work the attached worksheet:",
 * "Read aloud") and keeps the topic words.
 */
export function buildFinderQueryForOp(op: AgendaEditOp): string {
  if (op.kind !== "insert") return "";
  const raw = `${op.title || ""} ${op.description || ""}`;
  return raw
    .replace(/^custom worksheet:\s*/i, "")
    .replace(/^work the attached worksheet:\s*/i, "")
    .replace(/^read[- ]aloud:?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build the enriched description for an op given the chosen finder result.
 * The format is stable + idempotent — re-enriching the same op is a no-op
 * because `shouldEnrichInsertOp` would return false on the second pass.
 */
export function buildEnrichedDescription(
  op: AgendaEditOp,
  pick: FinderResultLike,
): string {
  if (op.kind !== "insert") return "";
  const existing = (op.description ?? "").trim();
  const lines: string[] = [];
  lines.push(`[Example] ${pick.title}`);
  if (pick.url) lines.push(pick.url);
  if (pick.snippet) lines.push(pick.snippet);
  if (existing) lines.push("", existing);
  return lines.join("\n");
}

/**
 * Main entry point. Returns a NEW plan; never mutates the input.
 * The `finder` callable lets tests pass a deterministic stub.
 */
export async function enrichInsertOpsWithFinderResults(
  plan: AgendaEditPlan,
  finder: FinderFn,
  opts?: { kidSafe?: boolean },
): Promise<AgendaEditPlan> {
  const kidSafe = opts?.kidSafe !== false;
  const newOps: AgendaEditOp[] = [];
  const newWarnings: string[] = [...plan.warnings];
  let enrichedCount = 0;

  for (const op of plan.ops) {
    if (!shouldEnrichInsertOp(op)) {
      newOps.push(op);
      continue;
    }
    const query = buildFinderQueryForOp(op);
    if (!query) {
      newOps.push(op);
      continue;
    }
    const preferred = inferPreferredType(op);
    let results: FinderResultLike[] = [];
    try {
      results = await finder({
        query,
        subjectSlug: op.kind === "insert" ? op.subjectSlug ?? null : null,
        kidSafe,
      });
    } catch {
      results = [];
    }
    const pick = pickBestFinderResult(results, preferred);
    if (!pick || !pick.url) {
      newOps.push(op);
      continue;
    }
    const enriched: AgendaEditOp = {
      ...op,
      description: buildEnrichedDescription(op, pick),
    } as AgendaEditOp;
    newOps.push(enriched);
    enrichedCount++;
  }

  if (enrichedCount > 0) {
    newWarnings.push(
      enrichedCount === 1
        ? "Auto-attached 1 example from the assignment finder."
        : `Auto-attached ${enrichedCount} examples from the assignment finder.`,
    );
  }

  return {
    ...plan,
    ops: newOps,
    warnings: newWarnings,
  };
}
