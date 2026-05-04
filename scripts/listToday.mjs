import * as db from "../server/db.ts";
const plan = await db.ensurePlanForDate("2026-05-04","full",{allowWeekendAutoBuild:true});
const blocks = await db.listBlocksForPlan(plan.id);
for (const b of blocks) {
  console.log("---", b.id, "|", b.title, "| sortOrder", b.sortOrder, "| start", b.startTime, "| dur", b.durationMin, "| videoUrl", b.videoUrl ?? "(none)", "| linkUrl", b.linkUrl ?? "(none)");
  console.log("desc:", b.description ?? "");
}
process.exit(0);
