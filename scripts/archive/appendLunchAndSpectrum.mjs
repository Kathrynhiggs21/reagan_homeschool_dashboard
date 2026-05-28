import "dotenv/config";
import * as db from "../server/db.ts";

const TODAY = "2026-05-04";

async function main() {
  const plan = await db.ensurePlanForDate(TODAY, "full", { allowWeekendAutoBuild: true });
  if (!plan) throw new Error("no plan");

  const subjects = await db.listSubjects();
  const mathId = subjects.find(s => s.slug === "math")?.id ?? null;

  const mathTopics = await db.listCurriculumTopics("math");
  const angleTopic = mathTopics.find(t => /angle|polygon|triangle/i.test(t.title)) || null;

  const existing = await db.listBlocksForPlan(plan.id);
  // figure out next sortOrder + a sensible start time after the last block
  const last = existing[existing.length - 1];
  let nextSort = (last?.sortOrder ?? existing.length - 1) + 1;
  // last reflection ends at 10:45; lunch at 10:45 (30m), spectrum at 11:15 (30m)
  const lunchStart = "10:45";
  const spectrumStart = "11:15";

  const lunchId = await db.createBlock({
    planId: plan.id,
    blockType: "custom",
    subjectId: null,
    title: "🥪 Lunch with Mom",
    description:
      "Take a real break and eat lunch together with Mom. Talk about the planets activity, what surprised you, what was your favorite part of the morning.",
    durationMin: 30,
    startTime: lunchStart,
    sortOrder: nextSort++,
    status: "not_started",
    curriculumTopicId: null,
  });
  console.log("lunch", lunchId);

  const specId = await db.createBlock({
    planId: plan.id,
    blockType: "math",
    subjectId: mathId,
    title: "📘 Spectrum Math Grade 5 — pg 146 to 148",
    description:
      "Open your printed Spectrum Math Grade 5 workbook to pages 146, 147, and 148.\n\nWork through each problem in the book. If you get stuck on one, circle it and skip — we'll come back together.\n\nWhen you finish, snap a photo of each page and submit it from this block (the camera/upload icon below).",
    durationMin: 30,
    startTime: spectrumStart,
    sortOrder: nextSort++,
    status: "not_started",
    curriculumTopicId: angleTopic?.id ?? null,
  });
  console.log("spectrum", specId);

  // Library entry for printable book reference
  try {
    const row = await db.addAssignmentLibrary({
      title: "📘 Spectrum Math Grade 5 — pg 146–148",
      type: "printable",
      subjectSlug: "math",
      topic: "Spectrum Math Grade 5 (printed workbook)",
      dateFor: TODAY,
      status: "pending",
      recommendedUse: 4,
      notes: "Printed workbook reference. Submit photos of finished pages.",
    });
    console.log("lib +", row?.id);
  } catch (e) { console.warn(e?.message || e); }

  console.log("DONE");
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
