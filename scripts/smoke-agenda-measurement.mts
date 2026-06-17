/**
 * One-off smoke test (NOT a unit test): runs the real agenda-editor LLM planner
 * against Katy's actual measurement-day prompt and applies the budget/start
 * layout exactly as the router does, so we can eyeball the composed plan.
 *
 * Run: npx tsx scripts/smoke-agenda-measurement.mts
 */
import { generateAgendaEditPlan, validateEditPlan, type AgendaPlanContext } from "../server/_lib/agendaEditor";
import { parseBudgetAndStart, layoutInsertedBlocks } from "../server/_lib/agendaBudget";

const ctx: AgendaPlanContext = {
  planId: 999,
  date: "2026-06-17",
  dayLabel: "Wednesday, June 17",
  studentName: "Reagan",
  gradeLevel: "6",
  tutorOfDayLabel: null,
  blocks: [
    // An existing Ali appointment fixed on the day, to prove blocks flow around it.
    { id: 501, title: "Ali therapy", description: null, blockType: "appointment", startTime: "11:00", durationMin: 60, sortOrder: 0, status: "not_started", subjectSlug: null, curriculumTopicCode: null },
  ],
  subjects: [
    { slug: "math", name: "Math" },
    { slug: "science", name: "Science" },
    { slug: "ela", name: "English Language Arts" },
  ],
  topicCatalog: [
    { code: "OH.5.MD.1", title: "Convert like measurement units", subjectSlug: "math" },
    { code: "OH.5.MD.A", title: "Measurement types", subjectSlug: "math" },
  ],
};

const message =
  "Today starts at 1pm, 2 to 4 hours total. Teach measurement types, a lesson on measurement conversions, include metric info too, a worksheet on all of it, then a fun duck-themed activity using measurement — give me several ways to choose from.";

const main = async () => {
  console.log("PROMPT:", message, "\n");
  const plan = await generateAgendaEditPlan(ctx, message);
  const validated = validateEditPlan(plan, ctx);

  const budget = parseBudgetAndStart(message);
  console.log("PARSED budget/start:", JSON.stringify(budget), "\n");

  const insertOps = validated.ops.filter((o: any) => o.kind === "insert");
  if (budget.startTime || budget.minMinutes != null || budget.maxMinutes != null) {
    const fixed = ctx.blocks
      .filter((b) => b.startTime && b.blockType === "appointment")
      .map((b, i) => ({ ref: 10000 + i, durationMin: b.durationMin, fixed: true as const, startTime: b.startTime as string }));
    const flex = insertOps.map((o: any, i: number) => ({ ref: i, durationMin: o.durationMin }));
    const laid = layoutInsertedBlocks([...flex, ...fixed], {
      startTime: budget.startTime ?? null,
      minMinutes: budget.minMinutes,
      maxMinutes: budget.maxMinutes,
    });
    const byRef = new Map(laid.map((r) => [r.ref, r]));
    insertOps.forEach((o: any, i: number) => {
      const r = byRef.get(i);
      if (r) { o.durationMin = r.durationMin; if (r.startTime) o.startTime = r.startTime; }
    });
  }

  console.log("COMPOSED INSERTS (after budget layout):");
  let total = 0;
  for (const o of insertOps as any[]) {
    total += o.durationMin;
    console.log(`  ${o.startTime ?? "  ?  "}  ${String(o.durationMin).padStart(3)}m  [${o.blockType}]  ${o.title}`);
  }
  console.log(`  --- total flexible minutes: ${total} (target window 120–240) ---\n`);

  const options = validated.ops.filter((o: any) => o.kind === "offer_options");
  console.log("OFFERED OPTIONS:");
  for (const op of options as any[]) {
    console.log(`  prompt: ${op.prompt}`);
    for (const c of op.options) console.log(`    • ${c.title} (${c.durationMin}m) — ${c.description}`);
  }
  const worksheets = validated.ops.filter((o: any) => o.kind === "generate_worksheet");
  console.log(`\nWORKSHEET OPS: ${worksheets.length}`);
  console.log("\nSUMMARY:", validated.summary);
};

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
