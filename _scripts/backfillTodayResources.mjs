/**
 * Backfill 2026-05-01 schedule blocks with openable resources by inserting
 * matching rows into assignments_library (one per block, pinned by blockId)
 * and into daily_printables for the worksheet so "Pick a printable to track"
 * works.
 */
import mysql from "mysql2/promise";

const DATE = "2026-05-01";
const c = await mysql.createConnection({
  uri: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
  connectTimeout: 10000,
});

// 1. Find today's blocks
const [planRows] = await c.execute(
  "SELECT id FROM dailyPlans WHERE date = ?",
  [DATE],
);
if (!planRows.length) {
  console.error("No plan for", DATE);
  process.exit(1);
}
const planId = planRows[0].id;

const [blocks] = await c.execute(
  "SELECT id, title, sortOrder FROM scheduleBlocks WHERE planId = ? ORDER BY sortOrder ASC",
  [planId],
);
console.log("Blocks for", DATE, ":", blocks.map(b => `${b.id}:${b.title}`).join("  |  "));

// 2. Wipe any prior backfill for today (idempotent)
await c.execute(
  "DELETE FROM assignments_library WHERE date_for = ? AND from_source = ?",
  [DATE, "Today AI plan"],
);
await c.execute("DELETE FROM daily_printables WHERE for_date = ?", [DATE]);

// 3. Insert library rows pinned to each block
const RES = {
  // Block 1: planets video
  video: {
    title: "🎬 The Planets — Pancake Manor (3 min, kid-safe)",
    subjectSlug: "science",
    type: "video",
    topic: "Solar system: planets in order",
    sourceUrl: "https://www.youtube.com/watch?v=tNlhqPz5-Kw",
    fileLink: null,
    notes:
      "Watch this 3-min planet song first. After it, name all 8 planets in order. " +
      "Backups if she wants another: The Planet Song (KLT) https://www.youtube.com/watch?v=mQrIgH97v94 · " +
      "NASA Solar System for Kids playlist https://www.youtube.com/playlist?list=PLiuUQ9asub3TDPzGOi_L2hYlGnYwWUAVU",
  },
  // Block 2: planets-to-scale collage
  collage: {
    title: "🪐 Planets-to-scale collage — reference image",
    subjectSlug: "science",
    type: "project",
    topic: "Compare planet sizes",
    sourceUrl: "https://wildabouthere.com",
    fileLink: "/manus-storage/planet-collage_b5136bff.jpg",
    notes:
      "Tap the image to see the finished example + the diameter chart. " +
      "Materials: ruler, compass or circle template, dark paper (black/navy), markers/colored pencils, scissors. " +
      "Diameters (Earth = 2 cm / 1 in): Mercury 0.8 · Venus 1.9 · Earth 2 · Mars 1 · Jupiter 22 · Saturn 18.2 · Uranus 8 · Neptune 7.7 cm. " +
      "Talk-about-it: 1) smallest? 2) why does Saturn need a ring? 3) can you fit 11 Earths across Jupiter?",
  },
  // Block 3: weight on planets PDF (Manus FULL version)
  worksheetFull: {
    title: "⚖️ Weight on Planets — full worksheet (Manus version)",
    subjectSlug: "science",
    type: "worksheet",
    topic: "Gravity / multiplication",
    sourceUrl: null,
    fileLink: "/manus-storage/weight-on-planets-FULL_cd6b6226.pdf",
    notes:
      "Full unwatermarked worksheet (Manus rebuild) covering all 8 planets — every blank fillable. " +
      "Setup: ask Reagan her weight in lbs, then multiply by each planet's gravity factor. " +
      "Bonus: where would she weigh most? least? Why does Saturn (huge!) only weigh a little more than Earth?",
  },
  worksheetOriginal: {
    title: "⚖️ Weight on Planets — original (preview, parts watermarked)",
    subjectSlug: "science",
    type: "worksheet",
    topic: "Gravity / multiplication (alt)",
    sourceUrl: "https://www.superteacherworksheets.com",
    fileLink: "/manus-storage/weight-on-planets_b8b2184a.pdf",
    notes:
      "Original PDF you uploaded. Only the visible problems work because it's the Super Teacher Worksheets free preview — " +
      "use the Manus FULL version above as the main copy.",
  },
  // Block 4: math angles + triangles
  mathHub: {
    title: "📐 Math: angles & triangles — Tipsy Top resource hub",
    subjectSlug: "math",
    type: "lesson_plan",
    topic: "Circles → angles → triangles",
    sourceUrl: "https://www.mathsisfun.com/angles.html",
    fileLink: null,
    notes:
      "Mini-lesson flow: 1) Draw a big circle = 360°. Half = 180°. Quarter = 90°. Eighth = 45°. " +
      "2) Mark angle types on the circle with a protractor. 3) Acute < 90, Right = 90, Obtuse 90-180, Straight = 180, Reflex > 180. " +
      "4) Triangles: angles always add to 180°. By sides: equilateral / isosceles / scalene. By angles: acute / right / obtuse. " +
      "5) Try together: if a triangle has 60° + 60°, what's the third? (60 — equilateral!) " +
      "Tipsy-Top resources — open these links if she wants to see/hear the lesson: " +
      "Math Antics — Angle Basics https://www.youtube.com/watch?v=NVuMULQjb3o · " +
      "Khan Kids — Triangle types https://www.khanacademy.org/math/cc-fourth-grade-math/imp-geometry/imp-triangles/v/triangle-types · " +
      "Math is Fun — Angles https://www.mathsisfun.com/angles.html · " +
      "Math is Fun — Triangles https://www.mathsisfun.com/triangle.html",
  },
};

async function insertLib(blockId, r, recommendedUse) {
  await c.execute(
    `INSERT INTO assignments_library
       (title, subject_slug, type, topic, from_source, ih_classroom,
        date_received, date_for, status, recommended_use, source_url, file_link,
        notes, block_id, reagan_clicked, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'Today AI plan', 0,
             ?, ?, 'pending', ?, ?, ?,
             ?, ?, 0, NOW(), NOW())`,
    [
      r.title, r.subjectSlug, r.type, r.topic,
      DATE, DATE, recommendedUse, r.sourceUrl, r.fileLink,
      r.notes, blockId,
    ],
  );
}

// Map block by sortOrder index → resource bundle
for (const b of blocks) {
  if (/Kickoff|Planets video/i.test(b.title)) {
    await insertLib(b.id, RES.video, 5);
  } else if (/collage|to scale/i.test(b.title)) {
    await insertLib(b.id, RES.collage, 5);
  } else if (/Weight on Planets/i.test(b.title)) {
    await insertLib(b.id, RES.worksheetFull, 5);
    await insertLib(b.id, RES.worksheetOriginal, 3);
  } else if (/circle|angle|triangle|Math/i.test(b.title)) {
    await insertLib(b.id, RES.mathHub, 5);
  } else {
    console.warn("Unmatched block:", b.title);
  }
}

// 4. Insert daily_printables for the worksheet so the "Pick a printable to track" surfaces it
await c.execute(
  `INSERT INTO daily_printables
     (for_date, bucket, title, description, subject_slug,
      source, source_url, pdf_key,
      est_minutes, coin_reward, status, created_at, updated_at)
   VALUES
     (?, 'core', ?, ?, 'science', 'Today AI plan', NULL, ?, 25, 5, 'pending', NOW(), NOW()),
     (?, 'core', ?, ?, 'science', 'Today AI plan', ?, ?, 25, 3, 'pending', NOW(), NOW())`,
  [
    DATE,
    "Weight on Planets — full worksheet (Manus)",
    "Use the Manus rebuild — every blank is fillable. Multiply Reagan's weight in lbs by each planet's gravity factor.",
    "/manus-storage/weight-on-planets-FULL_cd6b6226.pdf",
    DATE,
    "Weight on Planets — original watermarked",
    "Original Super Teacher Worksheets preview. Most blanks are obscured; use the Manus full version as primary.",
    "https://www.superteacherworksheets.com",
    "/manus-storage/weight-on-planets_b8b2184a.pdf",
  ],
);

// 5. Verify
const [libCount] = await c.execute(
  "SELECT COUNT(*) AS n FROM assignments_library WHERE date_for = ?",
  [DATE],
);
const [printCount] = await c.execute(
  "SELECT COUNT(*) AS n FROM daily_printables WHERE for_date = ?",
  [DATE],
);
console.log(`Inserted ${libCount[0].n} library rows + ${printCount[0].n} printables for ${DATE}.`);

await c.end();
process.exit(0);
