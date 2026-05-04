/**
 * ownedBooksHints.ts
 *
 * Pulls Reagan's owned books out of the `books` table and shapes them into
 * the AIOwnedBookHint[] form the agenda generator expects, with the next
 * page-span pre-computed so the LLM can never re-assign a page that was
 * already ticked off via the reconciliation tool.
 */
import * as db from "../db";
import type { AIOwnedBookHint } from "./aiScheduleGenerator";

const VITEST_FILTER = (b: any) => {
  const t = String(b.title || "").toLowerCase();
  const a = String(b.author || "").toLowerCase();
  return !t.includes("vitest") && !a.includes("vitest");
};

export async function loadOwnedBooksForAgenda(): Promise<AIOwnedBookHint[]> {
  let rows: any[] = [];
  try { rows = await db.listBooks(); } catch { return []; }
  const out: AIOwnedBookHint[] = [];
  for (const b of rows.filter(VITEST_FILTER)) {
    const status = (b.status || "in_progress") as AIOwnedBookHint["status"];
    if (status === "shelved" || status === "done") continue;
    const isWorkbook = b.type === "workbook" || b.type === "reference";
    let suggestedPageSpan: { from: number; to: number } | null = null;
    if (isWorkbook) {
      try {
        suggestedPageSpan = await db.nextPageSpanForBook(b.id, b.defaultDailyPageSpan || 2);
      } catch { suggestedPageSpan = null; }
    }
    out.push({
      title: String(b.title),
      type: (b.type || "workbook") as AIOwnedBookHint["type"],
      subjectSlug: b.subjectSlug || null,
      status,
      suggestedPageSpan,
      currentChapter: typeof b.currentChapter === "number" ? b.currentChapter : null,
      totalChapters: typeof b.totalChapters === "number" ? b.totalChapters : null,
      totalPages: typeof b.totalPages === "number" ? b.totalPages : null,
      topicCodes: Array.isArray(b.topicCodes) ? b.topicCodes.map(String).slice(0, 12) : [],
      notes: b.notes || null,
    });
  }
  return out;
}
