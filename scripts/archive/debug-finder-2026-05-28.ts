/**
 * Diagnostic: for each block on 2026-05-28, show:
 *   - cleaned query passed to the finder
 *   - inferred preferred type
 *   - finder results (raw, before kid-safe filter)
 *   - whether pickBestFinderResult chose anything
 *
 * No DB writes. Read-only.
 */
import * as db from "../server/db";
import { findAssignments } from "../server/_lib/assignmentFinder";
import {
  buildFinderQueryForBlock,
  inferPreferredTypeForBlock,
} from "../server/_lib/blockAutoAttach";
import { pickBestFinderResult } from "../server/_lib/agendaEditorAutoAttach";

(async () => {
  const plan = await db.getPlanByDate("2026-05-28");
  if (!plan) {
    console.log("no plan");
    process.exit(0);
  }
  const blocks = (await db.listBlocksForPlan((plan as any).id)) as any[];
  for (const b of blocks) {
    const query = buildFinderQueryForBlock({
      id: b.id,
      title: b.title,
      subjectSlug: b.subjectSlug,
      blockType: b.blockType,
    });
    const preferred = inferPreferredTypeForBlock({
      id: b.id,
      title: b.title,
      subjectSlug: b.subjectSlug,
      blockType: b.blockType,
    });
    console.log(`\n=== Block ${b.id}: "${b.title}" ===`);
    console.log(`  subjectSlug=${b.subjectSlug ?? "null"} blockType=${b.blockType ?? "null"}`);
    console.log(`  cleaned query: "${query}"`);
    console.log(`  preferredType: ${preferred ?? "null"}`);
    const results = await findAssignments({
      query,
      subjectSlug: b.subjectSlug ?? null,
      kidSafe: true,
      includeWeb: true,
    });
    console.log(`  raw results count: ${results.length}`);
    for (const r of results.slice(0, 4)) {
      console.log(
        `    [${r.source}] type=${r.type} url=${r.url ?? "null"} title="${r.title.slice(0, 60)}"`,
      );
    }
    const pick = pickBestFinderResult(results as any, preferred);
    console.log(`  pick: ${pick ? `${pick.source}/${pick.type} "${pick.title.slice(0, 40)}"` : "null"}`);
  }
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
