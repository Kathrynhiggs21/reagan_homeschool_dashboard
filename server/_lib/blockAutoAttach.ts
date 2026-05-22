/**
 * blockAutoAttach.ts — v2.86 (2026-05-21)
 *
 * "Every block on Today should have at least one resource." Mom asked for
 * this because Reagan was opening blocks and finding them empty, which
 * killed her trust in the schedule.
 *
 * For each block on a given date:
 *   - if the block already has any pinned assignmentsLibrary rows OR any
 *     daily_printables rows attached to it → SKIP
 *   - otherwise call the AssignmentFinder with query = block.title (+ subject
 *     hint when available), pick the best library/sonar result, and pin it
 *     by inserting a single assignmentsLibrary row with blockId set
 *
 * Idempotent: re-running on the same date is a no-op for any block that now
 * has at least one resource.
 *
 * Pure orchestration; the finder + db helpers are injected so this file is
 * trivially testable without spinning up the full server.
 */
import {
  pickBestFinderResult,
  type FinderFn,
  type FinderResultLike,
} from "./agendaEditorAutoAttach";

/** Minimal shape we need from a schedule block. */
export type AutoAttachBlock = {
  id: number;
  title: string | null;
  subjectSlug?: string | null;
  blockType?: string | null;
};

/** Minimal shape we need from a pinned library row. */
type AnyRow = { id: number; type?: string | null };

/** Per-block report so the caller can log what changed. */
export type AutoAttachBlockReport = {
  blockId: number;
  blockTitle: string;
  action: "skipped_already_has_resources" | "attached" | "no_finder_result" | "error";
  attachedTitle?: string;
  attachedUrl?: string;
  attachedType?: string;
  errorMessage?: string;
};

export type AutoAttachResult = {
  date: string;
  totalBlocks: number;
  attached: number;
  skipped: number;
  noResult: number;
  errors: number;
  reports: AutoAttachBlockReport[];
};

export type AutoAttachDeps = {
  /** List rows already pinned to a given blockId (assignmentsLibrary). */
  listAssignmentsForBlock: (blockId: number) => Promise<AnyRow[]>;
  /** List daily_printables already pinned to (date, blockId). */
  listPrintablesForBlock: (date: string, blockId: number) => Promise<AnyRow[]>;
  /** AssignmentFinder. */
  finder: FinderFn;
  /** Insert a new assignmentsLibrary row. */
  addAssignmentLibrary: (input: {
    title: string;
    type: string;
    blockId: number;
    dateFor: string;
    subjectSlug: string | null;
    sourceUrl: string | null;
    fileLink: string | null;
    notes: string | null;
    fromSource: string;
    status: string;
  }) => Promise<{ id: number } | void>;
};

/**
 * Map a FinderResultLike.type → assignmentsLibrary.type column. The library
 * uses a slightly broader vocabulary; this is the canonical mapping.
 */
export function finderTypeToLibraryType(t: FinderResultLike["type"]): string {
  switch (t) {
    case "worksheet":
      return "worksheet";
    case "video":
      return "video";
    case "lesson_plan":
      return "lesson_plan";
    case "quiz":
      return "quiz";
    case "project":
      return "project";
    case "app_activity":
      return "app_activity";
    case "reading":
      return "reading";
    default:
      return "other";
  }
}

/**
 * Infer the preferred resource type from the block. Lessons want videos +
 * lesson plans; practice/work blocks want worksheets; reading blocks want
 * readings. Returns null when we have no signal.
 */
export function inferPreferredTypeForBlock(
  block: AutoAttachBlock,
): FinderResultLike["type"] | null {
  const blob = `${block.title ?? ""} ${block.blockType ?? ""}`.toLowerCase();
  if (/\bvideo\b|\bwatch\b|\byoutube\b/.test(blob)) return "video";
  if (/\bworksheet\b|\bpractice\b|\bwork\b|\bprintable\b/.test(blob)) return "worksheet";
  if (/\bread[- ]aloud\b|\bread\b|\bnovel\b|\bbook\b/.test(blob)) return "reading";
  if (/\blesson\b|\bteach\b|\bintro\b/.test(blob)) return "lesson_plan";
  if (/\bquiz\b|\btest\b/.test(blob)) return "quiz";
  if (/\bproject\b|\bbuild\b|\bcreate\b/.test(blob)) return "project";
  // Fallback for typed-but-untitled blocks
  const bt = (block.blockType ?? "").toLowerCase();
  if (bt === "lesson") return "lesson_plan";
  if (bt === "practice" || bt === "work" || bt === "worksheet") return "worksheet";
  if (bt === "reading") return "reading";
  return null;
}

/**
 * Build the canonical query string for the finder from a block.
 * Strips house-syntax noise like "Custom worksheet:" prefixes.
 */
export function buildFinderQueryForBlock(block: AutoAttachBlock): string {
  const raw = block.title ?? "";
  return raw
    .replace(/^custom worksheet:\s*/i, "")
    .replace(/^work the attached worksheet:\s*/i, "")
    .replace(/^read[- ]aloud:?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Run the auto-attach pass for one block. Pure (no global state). Returns a
 * single block report and, when applicable, performs exactly one DB insert
 * via deps.addAssignmentLibrary.
 */
export async function runAutoAttachForBlock(
  block: AutoAttachBlock,
  date: string,
  deps: AutoAttachDeps,
  opts: { kidSafe?: boolean } = {},
): Promise<AutoAttachBlockReport> {
  const blockTitle = block.title ?? "(untitled)";
  // 1. Skip if already populated.
  let existingLib: AnyRow[] = [];
  let existingPrint: AnyRow[] = [];
  try {
    existingLib = await deps.listAssignmentsForBlock(block.id);
  } catch {
    existingLib = [];
  }
  try {
    existingPrint = await deps.listPrintablesForBlock(date, block.id);
  } catch {
    existingPrint = [];
  }
  if (existingLib.length > 0 || existingPrint.length > 0) {
    return {
      blockId: block.id,
      blockTitle,
      action: "skipped_already_has_resources",
    };
  }

  // 2. Run finder.
  const query = buildFinderQueryForBlock(block);
  if (!query) {
    return {
      blockId: block.id,
      blockTitle,
      action: "no_finder_result",
    };
  }

  let results: FinderResultLike[] = [];
  try {
    results = await deps.finder({
      query,
      subjectSlug: block.subjectSlug ?? null,
      kidSafe: opts.kidSafe !== false,
    });
  } catch (err: any) {
    return {
      blockId: block.id,
      blockTitle,
      action: "error",
      errorMessage: String(err?.message ?? err),
    };
  }

  const preferred = inferPreferredTypeForBlock(block);
  const pick = pickBestFinderResult(results, preferred);
  if (!pick || !pick.url) {
    return {
      blockId: block.id,
      blockTitle,
      action: "no_finder_result",
    };
  }

  // 3. Insert pinned row.
  const libType = finderTypeToLibraryType(pick.type);
  try {
    await deps.addAssignmentLibrary({
      title: pick.title,
      type: libType,
      blockId: block.id,
      dateFor: date,
      subjectSlug: block.subjectSlug ?? pick.subjectSlug ?? null,
      sourceUrl: pick.url,
      fileLink: pick.url,
      notes: pick.snippet ? `[Auto-attached] ${pick.snippet}` : "[Auto-attached]",
      fromSource: "auto_attach",
      status: "pending",
    });
  } catch (err: any) {
    return {
      blockId: block.id,
      blockTitle,
      action: "error",
      errorMessage: String(err?.message ?? err),
    };
  }

  return {
    blockId: block.id,
    blockTitle,
    action: "attached",
    attachedTitle: pick.title,
    attachedUrl: pick.url,
    attachedType: libType,
  };
}

/**
 * Run the auto-attach pass over all supplied blocks. Bulk orchestrator.
 */
export async function runAutoAttachForBlocks(
  blocks: AutoAttachBlock[],
  date: string,
  deps: AutoAttachDeps,
  opts: { kidSafe?: boolean } = {},
): Promise<AutoAttachResult> {
  const reports: AutoAttachBlockReport[] = [];
  let attached = 0;
  let skipped = 0;
  let noResult = 0;
  let errors = 0;
  for (const b of blocks) {
    const r = await runAutoAttachForBlock(b, date, deps, opts);
    reports.push(r);
    if (r.action === "attached") attached++;
    else if (r.action === "skipped_already_has_resources") skipped++;
    else if (r.action === "no_finder_result") noResult++;
    else errors++;
  }
  return {
    date,
    totalBlocks: blocks.length,
    attached,
    skipped,
    noResult,
    errors,
    reports,
  };
}


/**
 * runAutoAttachForDate — db-bound convenience wrapper.
 *
 * Loads today's plan + blocks, wires real db helpers + the real
 * AssignmentFinder, runs the auto-attach pass, returns the bulk result.
 *
 * If there's no plan for the date, returns a zero-result with a note —
 * callers can short-circuit on totalBlocks === 0.
 */
export async function runAutoAttachForDate(
  date: string,
  opts: { kidSafe?: boolean } = {},
): Promise<AutoAttachResult> {
  const db = await import("../db");
  const { findAssignments } = await import("./assignmentFinder");

  const plan = await db.getPlanByDate(date);
  if (!plan) {
    return {
      date,
      totalBlocks: 0,
      attached: 0,
      skipped: 0,
      noResult: 0,
      errors: 0,
      reports: [],
    };
  }
  const rawBlocks = await db.listBlocksForPlan((plan as any).id);
  const blocks: AutoAttachBlock[] = (rawBlocks as any[]).map((b) => ({
    id: b.id,
    title: b.title ?? null,
    subjectSlug: b.subjectSlug ?? null,
    blockType: b.blockType ?? null,
  }));

  const deps: AutoAttachDeps = {
    listAssignmentsForBlock: async (blockId: number) =>
      (await db.listAssignmentsLibrary({ blockId, limit: 5 })) as any[],
    listPrintablesForBlock: async (forDate: string, blockId: number) =>
      (await db.listDailyPrintablesForBlock(forDate, String(blockId))) as any[],
    finder: async (args) => {
      const r = await findAssignments({
        query: args.query,
        subjectSlug: args.subjectSlug ?? null,
        kidSafe: args.kidSafe !== false,
        includeWeb: true,
      } as any);
      return (r ?? []) as unknown as FinderResultLike[];
    },
    addAssignmentLibrary: async (input) => {
      const out: any = await db.addAssignmentLibrary(input as any);
      return out;
    },
  };

  return runAutoAttachForBlocks(blocks, date, deps, opts);
}
