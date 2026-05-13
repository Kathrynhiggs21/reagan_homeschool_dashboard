/**
 * Push 32 (2026-05-13) — Backfill un-topiced scheduleBlocks.
 *
 * Spec line: "Scan existing `scheduleBlocks` and `assignmentsLibrary`
 *             rows missing `curriculumTopicId` and try to match by
 *             code/title; flag the unmatched ones for adult review."
 *
 * Strategy:
 *   1. Pull all scheduleBlocks where curriculumTopicId IS NULL.
 *   2. For each, look up curriculumTopics in the same subject.
 *   3. Score-based match:
 *        - Exact title match (lowercased, punctuation-stripped) -> auto-assign.
 *        - Substring match (block title contains topic title or vice versa) -> auto-assign IF unique.
 *        - Multiple substring matches -> flag for review (do NOT auto-assign).
 *        - Zero matches -> flag for review.
 *   4. Returns a structured report so the caller can surface the
 *      flag-for-review list to Mom in Settings.
 *
 * Idempotent: re-running on an already-backfilled DB is a no-op for
 * already-tagged rows, and re-flags previously unmatched rows.
 */

import { eq, isNull } from "drizzle-orm";
import { getDb } from "../db";
import { scheduleBlocks, curriculumTopics, subjects } from "../../drizzle/schema";

export type BackfillMatchResult = {
  blockId: number;
  blockTitle: string;
  subjectSlug: string | null;
  matchKind: "exact" | "substring_unique" | "ambiguous" | "no_match";
  /** Set when matchKind is "exact" or "substring_unique" — the topic that was assigned. */
  assignedTopicId?: number;
  assignedTopicCode?: string | null;
  assignedTopicTitle?: string;
  /** Set when matchKind is "ambiguous" — the candidate topic IDs the human must pick from. */
  candidateTopicIds?: number[];
};

export type BackfillReport = {
  scanned: number;
  exactMatches: number;
  substringMatches: number;
  ambiguous: number;
  noMatch: number;
  results: BackfillMatchResult[];
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

export async function backfillScheduleBlockTopics(opts: { dryRun?: boolean } = {}): Promise<BackfillReport> {
  const dryRun = opts.dryRun ?? false;
  const d = getDb();

  // Pull untagged blocks + their subject slug.
  const untagged: any[] = await d
    .select({
      id: scheduleBlocks.id,
      title: scheduleBlocks.title,
      subjectId: scheduleBlocks.subjectId,
      subjectSlug: subjects.slug,
    })
    .from(scheduleBlocks)
    .leftJoin(subjects, eq(scheduleBlocks.subjectId, subjects.id))
    .where(isNull(scheduleBlocks.curriculumTopicId));

  // Pull all topics. curriculumTopics.subject is a free-form label
  // ("Math" | "ELA" | "Science" | "Social" | "Specials") rather than
  // a FK to subjects. Map subject label -> matching scheduleBlock
  // subjects.slug for the lookup. The mapping below mirrors the seed.
  const allTopics: any[] = await d
    .select({
      id: curriculumTopics.id,
      title: curriculumTopics.title,
      code: curriculumTopics.code,
      subjectLabel: curriculumTopics.subject,
    })
    .from(curriculumTopics);

  const SUBJECT_LABEL_TO_SLUG: Record<string, string> = {
    Math: "math",
    ELA: "ela",
    Reading: "reading",
    Writing: "writing",
    Science: "science",
    Social: "ss",
    "Social Studies": "ss",
    Specials: "specials",
  };

  const topicsBySubject = new Map<string, any[]>();
  for (const t of allTopics) {
    const slug = SUBJECT_LABEL_TO_SLUG[t.subjectLabel] ?? t.subjectLabel?.toLowerCase() ?? "__none";
    if (!topicsBySubject.has(slug)) topicsBySubject.set(slug, []);
    topicsBySubject.get(slug)!.push(t);
  }

  const report: BackfillReport = {
    scanned: untagged.length,
    exactMatches: 0,
    substringMatches: 0,
    ambiguous: 0,
    noMatch: 0,
    results: [],
  };

  for (const block of untagged) {
    const subjectKey = block.subjectSlug ?? "__none";
    const candidates = topicsBySubject.get(subjectKey) ?? [];
    const blockTitleNorm = normalize(block.title ?? "");

    if (!blockTitleNorm) {
      report.noMatch++;
      report.results.push({
        blockId: block.id,
        blockTitle: block.title ?? "",
        subjectSlug: block.subjectSlug,
        matchKind: "no_match",
      });
      continue;
    }

    // Tier 1: exact normalized title match.
    const exact = candidates.filter((t) => normalize(t.title ?? "") === blockTitleNorm);
    if (exact.length === 1) {
      report.exactMatches++;
      const t = exact[0];
      report.results.push({
        blockId: block.id,
        blockTitle: block.title,
        subjectSlug: block.subjectSlug,
        matchKind: "exact",
        assignedTopicId: t.id,
        assignedTopicCode: t.code,
        assignedTopicTitle: t.title,
      });
      if (!dryRun) {
        await d.update(scheduleBlocks).set({ curriculumTopicId: t.id } as any).where(eq(scheduleBlocks.id, block.id));
      }
      continue;
    }

    // Tier 2: substring match (block-title-contains-topic OR topic-contains-block-title).
    const subs = candidates.filter((t) => {
      const tn = normalize(t.title ?? "");
      if (!tn) return false;
      return blockTitleNorm.includes(tn) || tn.includes(blockTitleNorm);
    });

    if (subs.length === 1) {
      report.substringMatches++;
      const t = subs[0];
      report.results.push({
        blockId: block.id,
        blockTitle: block.title,
        subjectSlug: block.subjectSlug,
        matchKind: "substring_unique",
        assignedTopicId: t.id,
        assignedTopicCode: t.code,
        assignedTopicTitle: t.title,
      });
      if (!dryRun) {
        await d.update(scheduleBlocks).set({ curriculumTopicId: t.id } as any).where(eq(scheduleBlocks.id, block.id));
      }
      continue;
    }

    if (subs.length > 1) {
      report.ambiguous++;
      report.results.push({
        blockId: block.id,
        blockTitle: block.title,
        subjectSlug: block.subjectSlug,
        matchKind: "ambiguous",
        candidateTopicIds: subs.map((s) => s.id),
      });
      // Do NOT auto-assign — Mom must review.
      continue;
    }

    report.noMatch++;
    report.results.push({
      blockId: block.id,
      blockTitle: block.title,
      subjectSlug: block.subjectSlug,
      matchKind: "no_match",
    });
  }

  return report;
}
