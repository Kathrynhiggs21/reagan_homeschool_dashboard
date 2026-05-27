/**
 * Audit script (one-off, not run in production):
 * Verifies that assembleAgendaForDate('2026-05-28') produces a real,
 * worksheet-hydrated payload — which is what the nightly cron will send.
 *
 * Run from the project root:
 *   node --import tsx scripts/auditLessonHydration.ts 2026-05-28
 */
async function main() {
  const dateStr = process.argv[2] || new Date().toISOString().slice(0, 10);
  const { assembleAgendaForDate } = await import("../server/_lib/agendaAssembler");
  const out = await assembleAgendaForDate(dateStr);
  if (!out) {
    console.log(`[${dateStr}] no_plan`);
    return;
  }
  const blocks = (out as any).blocks ?? [];
  let withLesson = 0, withWorksheets = 0, withBooks = 0, withAK = 0, withLP = 0, withVid = 0;
  for (const b of blocks) {
    if (b.lesson) withLesson++;
    if (b.lesson?.worksheets?.length > 0) withWorksheets++;
    if (b.lesson?.answerKey) withAK++;
    if (b.lesson?.lessonPlan) withLP++;
    if ((b.lesson?.videos?.length ?? 0) > 0) withVid++;
    if ((b.bookRefs ?? b.bookAssignments ?? []).length > 0) withBooks++;
  }
  console.log(`[${dateStr}] ${blocks.length} blocks — lesson:${withLesson} ws:${withWorksheets} ak:${withAK} lp:${withLP} vid:${withVid} books:${withBooks}`);
  for (const b of blocks) {
    const lp = b.lesson?.lessonPlan ? "LP" : "..";
    const ak = b.lesson?.answerKey ? "AK" : "..";
    const ws = (b.lesson?.worksheets ?? []).length;
    const vid = (b.lesson?.videos ?? []).length;
    const bk = (b.bookRefs ?? b.bookAssignments ?? []).length;
    console.log(
      `  [${String(b.sortOrder).padStart(2)}] ${lp} ${ak} ws:${ws} vid:${vid} bk:${bk}  ${(b.title ?? "").slice(0, 60)}`
    );
  }
}

main().catch((e) => { console.error("ERR:", e); process.exit(1); });
