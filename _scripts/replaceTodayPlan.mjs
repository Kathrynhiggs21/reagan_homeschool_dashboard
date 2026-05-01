import mysql from "mysql2/promise";

/**
 * Reagan — May 1, 2026 — afternoon-only plan (~2 hrs)
 * Per parent request: replace today's 8 default blocks with a focused
 * science + math afternoon built around the planet collage activity, the
 * Weight-on-Planets worksheet, and a circle/triangle/angles math block.
 */

const PLAN_ID = 120001;
const MATH = 30012;
const SCIENCE = 30014;

const PLANET_COLLAGE_URL = "/manus-storage/planet-collage_b5136bff.jpg";
const WORKSHEET_PREVIEW_URL = "/manus-storage/weight-on-planets_b8b2184a.pdf";
const WORKSHEET_FULL_URL = "/manus-storage/weight-on-planets-FULL_cd6b6226.pdf";
const VIDEO_URL = "https://www.youtube.com/watch?v=tNlhqPz5-Kw"; // Pancake Manor — The Planets, ~3 min
const VIDEO_BACKUP = "https://www.youtube.com/watch?v=mQrlgH97v94"; // KLT — The Planet Song
const NASA_KIDS = "https://www.youtube.com/playlist?list=PLiuUQ9asub3TDPzGOi_L2hYJGnYwWUAVU";

const blocks = [
  {
    blockType: "morning_warmup",
    subjectId: SCIENCE,
    title: "🚀 Kickoff: Planets video (under 5 min)",
    durationMin: 5,
    startTime: "13:00",
    description: [
      `**Watch:** [The Planets — Pancake Manor (≈3 min)](${VIDEO_URL})`,
      ``,
      `Backup video if she wants another: [The Planet Song — KLT](${VIDEO_BACKUP})  ·  [NASA: Solar System for Kids](${NASA_KIDS})`,
      ``,
      `**Goal:** name all 8 planets in order from the Sun and notice one cool thing about each (clouds, rings, redness, sideways spin, etc.).`,
    ].join("\n"),
  },
  {
    blockType: "adventure",
    subjectId: SCIENCE,
    title: "🪐 Solar system to scale — collage activity",
    durationMin: 35,
    startTime: "13:05",
    description: [
      `**Activity:** Draw all 8 planets to scale on dark paper, then cut out and arrange into a collage. (Source: wildabouthere.com)`,
      ``,
      `**Reference image (open in the block):** ${PLANET_COLLAGE_URL}`,
      ``,
      `**Materials:** ruler, compass or circle template, dark paper (black/navy), markers or colored pencils, scissors.`,
      ``,
      `**Diameters to use** (Earth = 2 cm / 1 in):`,
      `- Mercury 0.8 cm · Venus 1.9 cm · Earth 2 cm · Mars 1 cm`,
      `- Jupiter 22 cm · Saturn 18.2 cm (+ hand-drawn ring) · Uranus 8 cm · Neptune 7.7 cm`,
      ``,
      `**Talk-about-it questions while she works:**`,
      `1. Which planet is the smallest? Largest? Closest to the Sun?`,
      `2. Why does Saturn need a ring drawn on?`,
      `3. If Jupiter is 11× wider than Earth, can you fit 11 Earths across it?`,
    ].join("\n"),
  },
  {
    blockType: "custom",
    subjectId: SCIENCE,
    title: "⚖️ Weight on Planets worksheet",
    durationMin: 25,
    startTime: "13:40",
    description: [
      `**Worksheet (full, unwatermarked Manus version):** ${WORKSHEET_FULL_URL}`,
      ``,
      `Original you uploaded (Super Teacher Worksheets — preview only, parts watermarked): ${WORKSHEET_PREVIEW_URL}`,
      ``,
      `**Setup:** ask Reagan her weight in lbs. Then for each planet, multiply by the gravity factor on the worksheet.`,
      ``,
      `**Bonus brain-stretch:** where would she weigh the most? The least? Why does Saturn (huge!) only make her weigh a little more than Earth?`,
    ].join("\n"),
  },
  {
    blockType: "math",
    subjectId: MATH,
    title: "📐 Math: circles → angles → triangles",
    durationMin: 35,
    startTime: "14:05",
    description: [
      `**Mini-lesson flow:**`,
      ``,
      `1. **Draw a big circle.** A full turn around the center is **360°**. Half = 180°. Quarter = 90°. Eighth = 45°.`,
      `2. **Mark angles** on the circle with a protractor: 90° (right angle, like the corner of a paper), 180° (straight line), 270° (three-quarter turn).`,
      `3. **Types of angles:**`,
      `   - **Acute** = less than 90° (sharp, like a slice of pizza)`,
      `   - **Right** = exactly 90° (corner of a square)`,
      `   - **Obtuse** = between 90° and 180° (wide open)`,
      `   - **Straight** = exactly 180° (flat line)`,
      `   - **Reflex** = greater than 180° (more than half a turn)`,
      `4. **Triangles & how they connect to circles:**`,
      `   - Every triangle's three angles **always add up to 180°** — half a full circle!`,
      `   - **By sides:** equilateral (3 equal), isosceles (2 equal), scalene (all different)`,
      `   - **By angles:** acute (all < 90°), right (one 90°), obtuse (one > 90°)`,
      `5. **Try together:** if a triangle has angles 60° + 60°, what's the third? (180 − 120 = 60°, so it's equilateral!)`,
      ``,
      `**Tipsy-Top math nudge — short kid resources:**`,
      `- [Math Antics: Angle Basics (≈4 min)](https://www.youtube.com/watch?v=NVuMULQjb3o)`,
      `- [Khan Kids: Triangle types](https://www.khanacademy.org/math/cc-fourth-grade-math/imp-geometry/imp-triangles/v/triangle-types)`,
      `- [Math is Fun — Angles](https://www.mathsisfun.com/angles.html)  ·  [Triangles](https://www.mathsisfun.com/triangle.html)`,
      ``,
      `**Quick check (no pressure):** draw one of each triangle type and label the angles.`,
    ].join("\n"),
  },
];

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL missing"); process.exit(1); }
const c = await mysql.createConnection({ uri: url, ssl: { rejectUnauthorized: true }, connectTimeout: 10000 });

// 1. Delete existing blocks (cascade-delete bookAssignments first to avoid FK orphans)
const [existing] = await c.execute("SELECT id FROM scheduleBlocks WHERE planId = ?", [PLAN_ID]);
const existingIds = existing.map(r => r.id);
console.log("Deleting existing blocks:", existingIds);
if (existingIds.length) {
  // bookAssignments may reference blocks
  await c.execute(`DELETE FROM bookAssignments WHERE blockId IN (${existingIds.map(() => "?").join(",")})`, existingIds);
  await c.execute(`DELETE FROM scheduleBlocks WHERE id IN (${existingIds.map(() => "?").join(",")})`, existingIds);
}

// 2. Insert new blocks
let sortOrder = 0;
for (const b of blocks) {
  await c.execute(
    `INSERT INTO scheduleBlocks (planId, blockType, subjectId, title, description, durationMin, startTime, sortOrder, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'not_started')`,
    [PLAN_ID, b.blockType, b.subjectId, b.title, b.description, b.durationMin, b.startTime, sortOrder++],
  );
  console.log("Inserted:", b.title);
}

// 3. Mark the plan as a "half day" via notes
await c.execute(
  `UPDATE dailyPlans SET notes = ?, dayType = 'half' WHERE id = ?`,
  [
    "Half day — afternoon only, ~2 hours. Focus: planets video → solar-system collage → weight-on-planets worksheet → circle/angles/triangles math.",
    PLAN_ID,
  ],
);

console.log("DONE — today's plan replaced with 4 afternoon blocks.");
await c.end();
process.exit(0);
