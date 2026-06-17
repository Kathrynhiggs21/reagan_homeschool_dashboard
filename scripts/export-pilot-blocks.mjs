/**
 * Export all schedule blocks for the 2-week pilot (2026-06-17 .. 2026-06-30)
 * to a JSON file the calendar-sync step reads. Pulls date + startTime +
 * durationMin + title + description from the DB via Drizzle.
 *
 * Output: scripts/pilot-blocks.json  (array, sorted by date then startTime)
 */
import { getDb } from "../server/db.ts";
import { dailyPlans, scheduleBlocks } from "../drizzle/schema.ts";
import { and, gte, lte, eq } from "drizzle-orm";
import { writeFileSync } from "node:fs";

async function main() {
  const db = getDb();
  const plans = await db
    .select({ id: dailyPlans.id, date: dailyPlans.date })
    .from(dailyPlans)
    .where(and(gte(dailyPlans.date, "2026-06-17"), lte(dailyPlans.date, "2026-06-30")));

  const out = [];
  for (const p of plans) {
    const dateIso = p.date instanceof Date ? p.date.toISOString().slice(0, 10) : String(p.date).slice(0, 10);
    const blocks = await db
      .select({
        id: scheduleBlocks.id,
        title: scheduleBlocks.title,
        description: scheduleBlocks.description,
        durationMin: scheduleBlocks.durationMin,
        startTime: scheduleBlocks.startTime,
        sortOrder: scheduleBlocks.sortOrder,
        blockType: scheduleBlocks.blockType,
      })
      .from(scheduleBlocks)
      .where(eq(scheduleBlocks.planId, p.id));
    for (const b of blocks) {
      out.push({ date: dateIso, ...b });
    }
  }

  out.sort((a, b) => (a.date === b.date ? (a.startTime || "").localeCompare(b.startTime || "") : a.date.localeCompare(b.date)));
  writeFileSync(new URL("./pilot-blocks.json", import.meta.url), JSON.stringify(out, null, 2));
  console.log(`Exported ${out.length} blocks across ${plans.length} days -> scripts/pilot-blocks.json`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
