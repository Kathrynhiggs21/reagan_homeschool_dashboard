import "dotenv/config";
import * as db from "../server/db.ts";

const TODAY = "2026-05-04";
const VIDEO_URL = "https://youtu.be/fajsyiKRfxI";
const COMPASS_VIDEO = "https://www.youtube.com/watch?v=ZaQkohuqoXY"; // STEM kid-friendly DIY compass

async function main() {
  const plan = await db.ensurePlanForDate(TODAY, "full", { allowWeekendAutoBuild: true });
  if (!plan) throw new Error("no plan");
  const subjects = await db.listSubjects();
  const sciId = subjects.find(s => s.slug === "science")?.id ?? null;
  const mathId = subjects.find(s => s.slug === "math")?.id ?? null;

  const sciTopics = await db.listCurriculumTopics("science");
  const sciTopic = sciTopics.find(t => /earth|moon|sun|orbit|season|planet/i.test(t.title)) || null;
  const mathTopics = await db.listCurriculumTopics("math");
  const mathTopic = mathTopics.find(t => /angle|polygon|triangle/i.test(t.title)) || null;

  // 1. Mark Spectrum Math (690009) complete
  try {
    await db.updateBlock(690009, {
      status: "complete",
      completedAt: new Date(),
      grade: "A",
      notes: "Done after Grandma's 45m recap lesson.",
    });
    console.log("spectrum 690009 → complete");
  } catch (e) { console.warn("spectrum complete fail", e?.message || e); }

  const blocks = await db.listBlocksForPlan(plan.id);
  let nextSort = (blocks[blocks.length - 1]?.sortOrder ?? blocks.length - 1) + 1;

  // 2. Grandma's Lesson — already happened, mark complete
  const grandmaId = await db.createBlock({
    planId: plan.id,
    blockType: "custom",
    subjectId: sciId,
    title: "👵 Grandma's Lesson — recap of today's topics (45 min)",
    description:
      "Grandma walked through everything today: planets, day & night, axial tilt, the seasons, degrees, full circles (360°), and triangles (180°). Reagan participated and listened. ✅ Marked complete.",
    durationMin: 45,
    startTime: "11:45",
    sortOrder: nextSort++,
    status: "complete",
    curriculumTopicId: sciTopic?.id ?? null,
  });
  try {
    await db.updateBlock(grandmaId, { completedAt: new Date(), notes: "Grandma led 45m recap on all of today's topics." });
  } catch {}
  console.log("grandma block", grandmaId);

  // 3. Build a Compass + Degrees Video
  const compassId = await db.createBlock({
    planId: plan.id,
    blockType: "adventure",
    subjectId: mathId,
    title: "🧭 Build Your Own Compass + Degrees Video",
    description:
      `Watch & build! Video: ${COMPASS_VIDEO}\n\n` +
      "🛠️ DIY Compass (10 min):\n" +
      "• 1 sewing needle (or straightened paperclip)\n" +
      "• 1 magnet (any kind — fridge magnet works)\n" +
      "• Small piece of cork OR a leaf OR a scrap of paper\n" +
      "• Bowl of water\n\n" +
      "Steps: Rub the needle 30 times in ONE direction across the magnet. Stick the needle through the cork/leaf/paper. Float it on the water. The needle will SPIN and point NORTH! 🧲➡️N\n\n" +
      "📐 Now talk degrees, planet-style:\n" +
      "• A PLANET'S orbit = a full **360°** trip around the Sun.\n" +
      "• Spin your compass HALFWAY = **180°** (a triangle's 3 angles add up to this!).\n" +
      "• Quarter turn = **90°** (a square's corner).\n" +
      "• Other shapes: square = 360° all together, pentagon = 540°, hexagon = 720°.\n" +
      "Rule: every shape's angles add up to (sides − 2) × 180.",
    durationMin: 30,
    startTime: "12:30",
    sortOrder: nextSort++,
    status: "not_started",
    curriculumTopicId: mathTopic?.id ?? null,
  });
  console.log("compass block", compassId);

  // 4. Planets Recap rewatch
  const recapId = await db.createBlock({
    planId: plan.id,
    blockType: "custom",
    subjectId: sciId,
    title: "🎬 Planets Recap — rewatch Earth's Movements video",
    description:
      `Cozy end-of-day recap. Rewatch: ${VIDEO_URL}\n\n` +
      "This time, see how much MORE you understand. Pause it whenever you want and say out loud:\n" +
      "• \"That's rotation — that's why we have day & night.\"\n" +
      "• \"That's translation/orbit — that's why we have a year.\"\n" +
      "• \"That's the tilt — that's why we have seasons.\"\n" +
      "Bonus: tell Mom or Dad ONE new thing you learned today that you didn't know yesterday.",
    durationMin: 15,
    startTime: "13:00",
    sortOrder: nextSort++,
    status: "not_started",
    curriculumTopicId: sciTopic?.id ?? null,
  });
  console.log("recap block", recapId);

  // Library entries
  for (const r of [
    {
      title: "🧭 Build Your Own Compass — STEM video (Generation Genius / kids STEM)",
      type: "video",
      subjectSlug: "math",
      topic: "Degrees & Compass",
      sourceUrl: COMPASS_VIDEO,
      dateFor: TODAY,
      status: "pending",
      recommendedUse: 5,
      notes: "Pair with the DIY needle+magnet+water build.",
    },
    {
      title: "🎬 Planets Recap — Earth's Movements (rewatch)",
      type: "video",
      subjectSlug: "science",
      topic: "Planets / Day-Night / Seasons recap",
      sourceUrl: VIDEO_URL,
      dateFor: TODAY,
      status: "pending",
      recommendedUse: 4,
      notes: "End-of-day pause-and-narrate recap.",
    },
  ]) {
    try {
      const row = await db.addAssignmentLibrary(r);
      console.log("lib +", row?.id, r.title);
    } catch (e) { console.warn("lib fail", e?.message || e); }
  }

  console.log("DONE");
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
