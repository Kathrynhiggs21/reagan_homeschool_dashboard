// Rewrite May 4 2026 plan: planets video + degrees + walk-around-the-sun.
// Run via tsx-equivalent ESM import path; uses the project's own db helpers so
// it shares the running server's TiDB connection settings.
import "dotenv/config";
import * as db from "../server/db.ts";

const TODAY = "2026-05-04";
const VIDEO_URL = "https://youtu.be/fajsyiKRfxI";

async function findPlanetsAssignment() {
  const rows = await db.listAssignmentsLibrary({ q: "planet", limit: 50 });
  return rows.find(r => /planet/i.test(r.title)) || null;
}

async function findEarthMoonTopic() {
  const all = await db.listCurriculumTopics("science");
  return all.find(t => /earth|moon|sky|space|sun|orbit|season|planet/i.test(t.title)) || null;
}

async function findAngleTopic() {
  const all = await db.listCurriculumTopics("math");
  return all.find(t => /angle|polygon|triangle/i.test(t.title)) || null;
}

async function main() {
  const plan = await db.ensurePlanForDate(TODAY, "full", { allowWeekendAutoBuild: true });
  if (!plan) throw new Error("could not ensure plan for " + TODAY);
  console.log("plan", plan.id);

  const planets = await findPlanetsAssignment();
  console.log("planets assignment", planets?.id, planets?.title);

  const sciTopic = await findEarthMoonTopic();
  const mathTopic = await findAngleTopic();
  console.log("topic sci", sciTopic?.id, sciTopic?.code, sciTopic?.title);
  console.log("topic math", mathTopic?.id, mathTopic?.code, mathTopic?.title);

  // Wipe today's existing blocks
  const existing = await db.listBlocksForPlan(plan.id);
  for (const b of existing) {
    try { await db.deleteBlock(b.id); console.log("deleted block", b.id, b.title); }
    catch (e) { console.warn("del fail", b.id, e?.message || e); }
  }

  const subjects = await db.listSubjects();
  const sciId = subjects.find(s => s.slug === "science")?.id ?? null;
  const mathId = subjects.find(s => s.slug === "math")?.id ?? null;

  // 7-block plan (planets + walk-around-the-sun + degrees + color)
  const blocks = [
    {
      blockType: "morning_warmup",
      title: "Morning Warm-Up — What do you already know about the planets?",
      description: "Quick chat: name as many planets as you can in order. Bonus: which one spins the fastest? Which one is closest to the sun?",
      durationMin: 10,
      startTime: "09:00",
      subjectId: sciId,
      curriculumTopicId: sciTopic?.id ?? null,
    },
    {
      blockType: "custom",
      title: "🎬 Watch — Earth's Movements: Rotation & Translation",
      description: `Watch this short video together: ${VIDEO_URL}\n\nWhile you watch, listen for two important words:\n• ROTATION = Earth spinning on its axis (gives us day & night)\n• TRANSLATION (orbit) = Earth circling the Sun (gives us a YEAR and the seasons)`,
      durationMin: 15,
      startTime: "09:10",
      subjectId: sciId,
      curriculumTopicId: sciTopic?.id ?? null,
    },
    {
      blockType: "adventure",
      title: "🌞 Walk Around the Sun — Be the Earth!",
      description:
        "Easy hands-on activity (10 min, indoor or outdoor):\n\n" +
        "1. Put a lamp or flashlight in the middle of the room. That's the SUN. ☀️\n" +
        "2. You are the EARTH. Hold a small ball (or your fist) tilted slightly to one side — that's the AXIS TILT.\n" +
        "3. Spin slowly in place — every full spin = ONE DAY. The side facing the lamp is daytime, the side facing away is night.\n" +
        "4. Now WALK slowly around the lamp. One full lap = ONE YEAR.\n" +
        "5. Stop at 4 spots around the lamp — those are the 4 SEASONS. Whichever side of you (north or south) is leaning toward the lamp = SUMMER on that half.\n\n" +
        "🔭 Talk about it: Why do we have seasons? Why is it summer here when it's winter in Australia?",
      durationMin: 20,
      startTime: "09:25",
      subjectId: sciId,
      curriculumTopicId: sciTopic?.id ?? null,
    },
    {
      blockType: "math",
      title: "📐 Degrees Mini-Lesson — What IS a degree?",
      description:
        "A DEGREE (°) is a tiny slice of a turn. Imagine cutting a pizza into 360 equal slices — each slice is 1 degree. We use degrees to measure how much something has TURNED.\n\n" +
        "• A full turn (all the way around) = 360°\n" +
        "• A half turn = 180°\n" +
        "• A quarter turn = 90° (a square corner!)\n\n" +
        "Why 360? Ancient Babylonians counted in 60s, and 360 splits nicely into halves, thirds, quarters, fifths, sixths… super handy for splitting up a circle.\n\n" +
        "🌍 Connect it: When the Earth spins ONE day, it turns 360°. When the Earth orbits the Sun for ONE year, it travels 360° around the Sun.",
      durationMin: 15,
      startTime: "09:45",
      subjectId: mathId,
      curriculumTopicId: mathTopic?.id ?? null,
    },
    {
      blockType: "adventure",
      title: "🧭 Body Compass — Outdoor Degrees Activity",
      description:
        "Go outside (or stand in a big room) — bring this list:\n\n" +
        "1. Face NORTH. Call this 0°.\n" +
        "2. Turn RIGHT a quarter turn. You're facing EAST = 90°.\n" +
        "3. Turn RIGHT again. Facing SOUTH = 180° (HALF a circle!).\n" +
        "4. Turn RIGHT again. Facing WEST = 270°.\n" +
        "5. Turn RIGHT one more time → back to NORTH = 360° (a FULL circle 🔄).\n\n" +
        "🎯 Bonus challenge: Have an adult call out a degree (\"45°!\" \"135°!\") and turn to face it. Then try drawing a TRIANGLE on the ground with chalk and check that its 3 corners add up to 180°.",
      durationMin: 15,
      startTime: "10:00",
      subjectId: mathId,
      curriculumTopicId: mathTopic?.id ?? null,
    },
    {
      blockType: "custom",
      title: "🎨 Color the Planets — Reminder",
      description:
        "Pull out your Solar System coloring sheet (or grab one here: https://www.nasa.gov/sites/default/files/atoms/files/solar_system_coloring_book.pdf ).\n\n" +
        "Color each planet with at least one fact next to it (size, day length, fun feature). Mercury → tiny & gray. Venus → yellow & cloudy. Earth → blue + green + white clouds. Mars → red dust. Jupiter → striped, big red spot! Saturn → rings! Uranus → tilted on its side. Neptune → deep blue & windy.",
      durationMin: 20,
      startTime: "10:15",
      subjectId: sciId,
      curriculumTopicId: sciTopic?.id ?? null,
    },
    {
      blockType: "custom",
      title: "📝 Reflection — One thing I learned today",
      description:
        "Tell an adult (or write 1–2 sentences):\n• What's the difference between rotation and orbit?\n• Why do we have seasons?\n• How many degrees in a full turn? In a triangle?\n• Which planet do you want to learn more about next time?",
      durationMin: 10,
      startTime: "10:35",
      subjectId: sciId,
      curriculumTopicId: sciTopic?.id ?? null,
    },
  ];

  const created = [];
  let order = 0;
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
    created.push(id);
    console.log("created", id, b.title);
  }

  // Pin the saved Planets assignment to today (so it appears in the day's library list)
  if (planets) {
    try {
      await db.updateAssignmentLibrary(planets.id, { dateFor: TODAY, status: "in_progress" });
      console.log("pinned Planets assignment to today");
    } catch (e) { console.warn("pin Planets failed", e?.message || e); }
  }

  // Add quick library rows for today's video + activity + coloring sheet so they show on the day
  const libraryRows = [
    {
      title: "🎬 Earth's Movements — Rotation & Translation (video)",
      type: "video",
      subjectSlug: "science",
      topic: "Planets / Earth Rotation & Orbit",
      sourceUrl: VIDEO_URL,
      dateFor: TODAY,
      status: "pending",
      recommendedUse: 5,
      notes: "Anchor video for today's planets lesson.",
    },
    {
      title: "🌞 Walk Around the Sun — hands-on day/night/year/seasons activity",
      type: "activity",
      subjectSlug: "science",
      topic: "Planets / Seasons / Axial Tilt",
      dateFor: TODAY,
      status: "pending",
      recommendedUse: 5,
      notes: "Lamp + Reagan as Earth. See block instructions.",
    },
    {
      title: "🧭 Body Compass — outdoor degrees activity (0°/90°/180°/270°/360°)",
      type: "activity",
      subjectSlug: "math",
      topic: "Angles & Degrees",
      dateFor: TODAY,
      status: "pending",
      recommendedUse: 4,
      notes: "Outdoor or big-room version. Triangle bonus.",
    },
    {
      title: "🎨 Solar System Coloring Sheet (NASA printable)",
      type: "printable",
      subjectSlug: "science",
      topic: "Planets — coloring",
      sourceUrl: "https://www.nasa.gov/sites/default/files/atoms/files/solar_system_coloring_book.pdf",
      dateFor: TODAY,
      status: "pending",
      recommendedUse: 3,
      notes: "Reminder block — color the planets with one fact each.",
    },
  ];
  for (const r of libraryRows) {
    try {
      const row = await db.addAssignmentLibrary(r);
      console.log("library +", row?.id, r.title);
    } catch (e) { console.warn("add lib failed", e?.message || e); }
  }

  console.log("\nDONE. plan", plan.id, "blocks", created.length);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
