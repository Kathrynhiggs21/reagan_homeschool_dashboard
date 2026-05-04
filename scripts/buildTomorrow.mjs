import "dotenv/config";
import * as db from "../server/db.ts";

const TOMORROW = "2026-05-05";
const FLASHCARDS_URL = "/manus-storage/shape_flashcards_081b30a9.pdf";
const PG148_IMG = "/manus-storage/spectrum_g5_pg148_pretest_ch8_49d81c6d.jpg";
const PROTRACTOR_PDF = "https://www.commoncoresheets.com/determining-angles-with-protractors/106/download";
const VIDEO_RECAP = "https://youtu.be/fajsyiKRfxI";

async function main() {
  const plan = await db.ensurePlanForDate(TOMORROW, "full", { allowWeekendAutoBuild: true });
  if (!plan) throw new Error("no plan");
  console.log("plan", plan.id);

  const subjects = await db.listSubjects();
  const sciId = subjects.find(s => s.slug === "science")?.id ?? null;
  const mathId = subjects.find(s => s.slug === "math")?.id ?? null;

  const mathTopics = await db.listCurriculumTopics("math");
  const angleTopic = mathTopics.find(t => /angle|polygon|triangle/i.test(t.title)) || null;

  // Wipe whatever's there
  const existing = await db.listBlocksForPlan(plan.id);
  for (const b of existing) {
    try { await db.deleteBlock(b.id); } catch {}
  }
  console.log("wiped", existing.length, "blocks");

  const blocks = [
    {
      blockType: "morning_warmup",
      title: "☀️ Warm-Up — Degrees Recap",
      description:
        "Quick chat (no writing): What's a degree? How many degrees in a full circle? Half? Quarter? What's a triangle's angles add up to?\n\nGoal answers: full = 360°, half = 180°, quarter = 90°, triangle = 180°.",
      durationMin: 10,
      startTime: "09:00",
      subjectId: mathId,
      curriculumTopicId: angleTopic?.id ?? null,
    },
    {
      blockType: "math",
      title: "🃏 Shape Flashcards (1 → 8 sides) — Print & Study",
      description:
        `Print this PDF (1 page fronts + 1 page backs, double-sided): ${FLASHCARDS_URL}\n\n` +
        "Cut along the boxes. You now have 8 flashcards:\n" +
        "1. Circle (∞ sides, 360°)\n" +
        "2. Triangle (3 sides, 180°)\n" +
        "3. Square (4 sides, 360°)\n" +
        "4. Pentagon (5 sides, 540°)\n" +
        "5. Hexagon (6 sides, 720°)\n" +
        "6. Heptagon (7 sides, 900°)\n" +
        "7. Octagon (8 sides, 1080°)\n" +
        "8. Nonagon (9 sides, 1260°)\n\n" +
        "🎮 Game: An adult holds up the SHAPE side. You say the NAME, the SIDES, and the ANGLE SUM. Check by flipping the card.",
      durationMin: 20,
      startTime: "09:10",
      subjectId: mathId,
      curriculumTopicId: angleTopic?.id ?? null,
    },
    {
      blockType: "math",
      title: "📄 Spectrum pg 148 review (Pretest Ch 8) — use with flashcards",
      description:
        `Reagan already wrote on this page yesterday. Look at it now WITH the flashcards in hand: ${PG148_IMG}\n\n` +
        "Together review:\n" +
        "• Q1 Circle the regular polygons — check each shape against your flashcards.\n" +
        "• Q6–9 Identify polygons — does each name match the card's name?\n" +
        "• Q10–13 Measure angles — were the obtuse / acute / right labels right? Use the protractor to recheck.\n\n" +
        "Anything you'd answer differently today? Star those problems.",
      durationMin: 15,
      startTime: "09:30",
      subjectId: mathId,
      curriculumTopicId: angleTopic?.id ?? null,
    },
    {
      blockType: "adventure",
      title: "🍕 Pizza-Wheel Angle Spinner",
      description:
        "🛠 Build (5 min): Take a paper plate. Use a marker to divide it into 8 equal SLICES like a pizza. Label each slice line: 0° / 45° / 90° / 135° / 180° / 225° / 270° / 315° (back to 360°). Color each slice a different color. Make a paper-clip arrow that pivots from a pencil-tip in the center.\n\n" +
        "🎯 Play (10 min): Spin the arrow. Wherever it lands, call out the angle. SECOND spin → ADD the two angles. If the total goes past 360°, subtract 360 (you went all the way around!).\n\n" +
        "📐 Bonus: Spin 3 times — make a triangle on paper using those 3 angles. Do they add up to about 180°?",
      durationMin: 20,
      startTime: "09:45",
      subjectId: mathId,
      curriculumTopicId: angleTopic?.id ?? null,
    },
    {
      blockType: "math",
      title: "📐 Protractor Worksheet — Determine the Angles",
      description:
        `Print this worksheet (10 problems + answer key): ${PROTRACTOR_PDF}\n\n` +
        "Use a real protractor. For each angle:\n" +
        "1. Line up the protractor's center dot with the angle's vertex.\n" +
        "2. Line up 0° with one ray.\n" +
        "3. Read the other ray — that's the angle!\n" +
        "4. Write the measure AND label it: acute (<90°), right (=90°), obtuse (>90° and <180°), or straight (=180°).",
      durationMin: 25,
      startTime: "10:05",
      subjectId: mathId,
      curriculumTopicId: angleTopic?.id ?? null,
    },
    {
      blockType: "custom",
      title: "🥪 Lunch with Mom",
      description: "Take a real break. Tell Mom which shape on your flashcards is your new favorite, and why.",
      durationMin: 30,
      startTime: "10:30",
      subjectId: null,
      curriculumTopicId: null,
    },
    {
      blockType: "math",
      title: "📘 Spectrum Math Grade 5 — pg 149 to 151 (Chapter 8)",
      description:
        "Open your printed Spectrum Math Grade 5 workbook to pages 149, 150, and 151. (You finished pg 146–148 yesterday — these are the next pages of Chapter 8 on shapes & angles, which fits today's lesson.)\n\n" +
        "Work through each problem. Stuck? Circle and skip — we'll revisit together. Submit photos of finished pages from this block.",
      durationMin: 30,
      startTime: "11:00",
      subjectId: mathId,
      curriculumTopicId: angleTopic?.id ?? null,
    },
    {
      blockType: "custom",
      title: "🎬 Quick Recap — Earth Rotation video (cool-down rewatch)",
      description: `Optional cozy rewatch from yesterday: ${VIDEO_RECAP}\n\nOnly if you want — short 4-min video.`,
      durationMin: 10,
      startTime: "11:30",
      subjectId: sciId,
      curriculumTopicId: null,
    },
    {
      blockType: "custom",
      title: "📝 Reflection — One thing I learned today",
      description:
        "Tell an adult or write 1–2 sentences:\n• Which shape has the most degrees? Why?\n• What was your favorite spinner result?\n• What angle is hardest to eyeball?",
      durationMin: 10,
      startTime: "11:40",
      subjectId: null,
      curriculumTopicId: null,
    },
  ];

  let order = 0;
  const ids = [];
  for (const b of blocks) {
    const id = await db.createBlock({
      planId: plan.id,
      blockType: b.blockType,
      subjectId: b.subjectId,
      title: b.title,
      description: b.description,
      durationMin: b.durationMin,
      startTime: b.startTime,
      sortOrder: order++,
      status: "not_started",
      curriculumTopicId: b.curriculumTopicId,
    });
    ids.push(id);
    console.log("created", id, b.title);
  }

  // Library entries for tomorrow
  const libs = [
    {
      title: "🃏 Shape Flashcards (1→8 sides) — print PDF",
      type: "printable",
      subjectSlug: "math",
      topic: "Shapes & Angles",
      sourceUrl: FLASHCARDS_URL,
      fileLink: FLASHCARDS_URL,
      dateFor: TOMORROW,
      status: "pending",
      recommendedUse: 5,
      notes: "Print double-sided, cut, study. 8 cards: circle through nonagon.",
    },
    {
      title: "📄 Spectrum Math G5 pg 148 (Pretest Ch 8) — Reagan's completed page",
      type: "printable",
      subjectSlug: "math",
      topic: "Shapes & Angles — review",
      sourceUrl: PG148_IMG,
      fileLink: PG148_IMG,
      dateFor: TOMORROW,
      status: "pending",
      recommendedUse: 4,
      notes: "Use with flashcards as warm-up review.",
    },
    {
      title: "🍕 Pizza-Wheel Angle Spinner — DIY paper plate activity",
      type: "activity",
      subjectSlug: "math",
      topic: "Angles & Degrees",
      dateFor: TOMORROW,
      status: "pending",
      recommendedUse: 5,
      notes: "Paper plate + paperclip arrow. 8 slices = 45° each.",
    },
    {
      title: "📐 Protractor Worksheet — Determining Angles (Common Core Sheets)",
      type: "printable",
      subjectSlug: "math",
      topic: "Angles & Degrees",
      sourceUrl: PROTRACTOR_PDF,
      fileLink: PROTRACTOR_PDF,
      dateFor: TOMORROW,
      status: "pending",
      recommendedUse: 5,
      notes: "10 problems + answer key.",
    },
    {
      title: "📘 Spectrum Math G5 — pg 149–151 (Chapter 8 continued)",
      type: "printable",
      subjectSlug: "math",
      topic: "Spectrum Math Grade 5 (printed workbook)",
      dateFor: TOMORROW,
      status: "pending",
      recommendedUse: 4,
      notes: "Printed workbook. Submit page photos when done.",
    },
  ];
  for (const r of libs) {
    try {
      const row = await db.addAssignmentLibrary(r);
      console.log("lib +", row?.id, r.title);
    } catch (e) { console.warn("lib fail", e?.message || e); }
  }

  console.log("\nDONE. Tomorrow plan", plan.id, "blocks", ids.length);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
