#!/usr/bin/env node
/**
 * Seeds the Skill Ladder with Ohio 5th-grade standards (ELA + Math + Science)
 * mapped to Indian Hill 5th-grade scope. Each skill is paired with:
 *   - kid-friendly description (Reagan-readable)
 *   - story / visual / hands-on hooks (multi-modal teaching)
 *   - Khan Academy + IXL deep-link
 *
 * Standards are the published Ohio Learning Standards for Grade 5 (revised 2023
 * for ELA, 2024 for Math). IH uses Lucy Calkins for ELA writing units, Ready
 * Math (Curriculum Associates) for Math, and Mystery Science / Amplify Science
 * units. We cover the spine — IH-specific module names get layered on top in
 * Phase 8 from Wells' 4th-quarter PDF + AJ's weekly updates.
 *
 * Re-running the seed is idempotent: each skill is keyed by skillCode.
 */
import mysql from "mysql2/promise";

const url = new URL(process.env.DATABASE_URL);
const conn = await mysql.createConnection({
  host: url.hostname, port: parseInt(url.port || "4000"),
  user: url.username, password: decodeURIComponent(url.password),
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: false },
});

const SKILLS = [
  /* ============================ MATH (Ohio 5.x) ============================ */
  // Operations & Algebraic Thinking
  { subjectSlug: "math", strand: "Operations & Algebraic Thinking", skillCode: "OH.5.OA.1",
    title: "Use parentheses and brackets in number expressions",
    kidFriendly: "Solve math problems that have parentheses ( ) and brackets [ ]. The stuff inside goes first.",
    gradeLevel: "5", ladderOrder: 100, estMinutes: 15,
    khanUrl: "https://www.khanacademy.org/math/cc-fifth-grade-math/cc-5th-arithmetic-operations/cc-5th-order-of-operations/v/order-of-operations-1",
    ixlUrl: "https://www.ixl.com/math/grade-5/evaluate-numerical-expressions",
    storyHook: "Imagine you're packing snacks for a hike. The order you pack them in matters — same with math!",
    visualHook: "Color the parts inside ( ) one color and outside another. Always do the colored-inside part first.",
    handsOnHook: "Write a 3-step recipe with parentheses. Have Mom or your tutor try to make it in the wrong order on purpose."
  },
  { subjectSlug: "math", strand: "Operations & Algebraic Thinking", skillCode: "OH.5.OA.2",
    title: "Write and read math expressions in words",
    kidFriendly: "Translate between word problems and math sentences. 'Add 8 and 7, then double it' = 2 × (8+7).",
    gradeLevel: "5", ladderOrder: 110, estMinutes: 15,
    khanUrl: "https://www.khanacademy.org/math/cc-fifth-grade-math/cc-5th-arithmetic-operations/cc-5th-order-of-operations/v/translating-expressions-with-parentheses",
    ixlUrl: "https://www.ixl.com/math/grade-5/write-numerical-expressions-from-words",
  },
  // Number & Operations in Base Ten
  { subjectSlug: "math", strand: "Number & Operations in Base Ten", skillCode: "OH.5.NBT.1",
    title: "Place value: 10 times more, 1/10 of",
    kidFriendly: "A digit in one place is worth 10× as much as the place to its right (and 1/10 as much as the place to its left).",
    gradeLevel: "5", ladderOrder: 200, estMinutes: 15,
    khanUrl: "https://www.khanacademy.org/math/cc-fifth-grade-math/cc-5th-place-value-decimals",
    ixlUrl: "https://www.ixl.com/math/grade-5/place-values-in-whole-numbers-and-decimals",
    storyHook: "Money is base-ten — a dime is 10× a penny, a dollar is 10× a dime. Same pattern with decimals.",
  },
  { subjectSlug: "math", strand: "Number & Operations in Base Ten", skillCode: "OH.5.NBT.5",
    title: "Multiply multi-digit whole numbers (standard algorithm)",
    kidFriendly: "Multiply big numbers like 247 × 36 using the stack-and-carry method.",
    gradeLevel: "5", ladderOrder: 210, estMinutes: 20,
    khanUrl: "https://www.khanacademy.org/math/cc-fifth-grade-math/cc-5th-multiplication-division",
    ixlUrl: "https://www.ixl.com/math/grade-5/multiply-by-2-digit-numbers-complete-the-missing-steps",
  },
  { subjectSlug: "math", strand: "Number & Operations in Base Ten", skillCode: "OH.5.NBT.6",
    title: "Divide up to 4-digit by 2-digit numbers",
    kidFriendly: "Long division — break a big number into equal groups.",
    gradeLevel: "5", ladderOrder: 220, estMinutes: 20,
    khanUrl: "https://www.khanacademy.org/math/cc-fifth-grade-math/cc-5th-multiplication-division/cc-5th-division-2-digit-divisors",
    ixlUrl: "https://www.ixl.com/math/grade-5/divide-numbers-ending-in-zeros-by-2-digit-numbers",
  },
  { subjectSlug: "math", strand: "Number & Operations in Base Ten", skillCode: "OH.5.NBT.7",
    title: "Add, subtract, multiply, divide decimals to hundredths",
    kidFriendly: "Decimals work just like whole numbers — line up the decimal points and follow the same rules.",
    gradeLevel: "5", ladderOrder: 230, estMinutes: 20,
    khanUrl: "https://www.khanacademy.org/math/cc-fifth-grade-math/cc-5th-arithmetic-operations",
    ixlUrl: "https://www.ixl.com/math/grade-5/add-and-subtract-decimal-numbers",
    handsOnHook: "Use grocery receipts. Add up the prices yourself, then check against the total.",
  },
  // Number & Operations — Fractions
  { subjectSlug: "math", strand: "Number & Operations — Fractions", skillCode: "OH.5.NF.1",
    title: "Add and subtract fractions with unlike denominators",
    kidFriendly: "When the bottom numbers are different, give them a common denominator first.",
    gradeLevel: "5", ladderOrder: 300, estMinutes: 20,
    khanUrl: "https://www.khanacademy.org/math/cc-fifth-grade-math/cc-5th-fractions-add-sub",
    ixlUrl: "https://www.ixl.com/math/grade-5/add-and-subtract-fractions-with-unlike-denominators",
    visualHook: "Fold a paper into different parts to see why 1/2 + 1/3 isn't 2/5.",
  },
  { subjectSlug: "math", strand: "Number & Operations — Fractions", skillCode: "OH.5.NF.4",
    title: "Multiply fractions and whole numbers by fractions",
    kidFriendly: "Of means times. 1/2 of 8 = 1/2 × 8 = 4.",
    gradeLevel: "5", ladderOrder: 310, estMinutes: 20,
    khanUrl: "https://www.khanacademy.org/math/cc-fifth-grade-math/cc-5th-fractions-multi-div",
    ixlUrl: "https://www.ixl.com/math/grade-5/multiply-fractions",
  },
  { subjectSlug: "math", strand: "Number & Operations — Fractions", skillCode: "OH.5.NF.7",
    title: "Divide unit fractions and whole numbers",
    kidFriendly: "How many 1/4-cups in 3 cups? Division of fractions answers questions like that.",
    gradeLevel: "5", ladderOrder: 320, estMinutes: 20,
    khanUrl: "https://www.khanacademy.org/math/cc-fifth-grade-math/cc-5th-fractions-multi-div",
    ixlUrl: "https://www.ixl.com/math/grade-5/divide-by-fractions-using-models",
    handsOnHook: "Bake! Pick a recipe, then halve it. Track what changes.",
  },
  // Measurement & Data
  { subjectSlug: "math", strand: "Measurement & Data", skillCode: "OH.5.MD.1",
    title: "Convert measurements within the same system",
    kidFriendly: "Switch between feet/yards, ml/L, g/kg using multiplication or division.",
    gradeLevel: "5", ladderOrder: 400, estMinutes: 15,
    khanUrl: "https://www.khanacademy.org/math/cc-fifth-grade-math/cc-5th-measurement-topic/cc-5th-unit-conversion",
    ixlUrl: "https://www.ixl.com/math/grade-5/convert-customary-units-of-length",
  },
  { subjectSlug: "math", strand: "Measurement & Data", skillCode: "OH.5.MD.5",
    title: "Volume of rectangular prisms (V = l × w × h)",
    kidFriendly: "Volume is how much fits inside a 3-D box. Multiply length × width × height.",
    gradeLevel: "5", ladderOrder: 410, estMinutes: 15,
    khanUrl: "https://www.khanacademy.org/math/cc-fifth-grade-math/cc-5th-volume",
    ixlUrl: "https://www.ixl.com/math/grade-5/volume-of-rectangular-prisms-made-of-unit-cubes",
    handsOnHook: "Measure your fish-tank or duckling brooder — calculate its volume in cubic inches.",
  },
  // Geometry
  { subjectSlug: "math", strand: "Geometry", skillCode: "OH.5.G.1",
    title: "Coordinate plane: plot ordered pairs (x, y)",
    kidFriendly: "Two number lines crossed at zero. The first number is left/right, the second is up/down.",
    gradeLevel: "5", ladderOrder: 500, estMinutes: 15,
    khanUrl: "https://www.khanacademy.org/math/cc-fifth-grade-math/5th-coordinate-plane",
    ixlUrl: "https://www.ixl.com/math/grade-5/coordinate-planes-as-maps",
  },
  { subjectSlug: "math", strand: "Geometry", skillCode: "OH.5.G.3",
    title: "Classify 2-D shapes by attributes (hierarchy)",
    kidFriendly: "Squares are rectangles, rectangles are parallelograms, etc. Sort shapes by their properties.",
    gradeLevel: "5", ladderOrder: 510, estMinutes: 15,
    khanUrl: "https://www.khanacademy.org/math/cc-fifth-grade-math/properties-of-shapes",
    ixlUrl: "https://www.ixl.com/math/grade-5/classify-quadrilaterals",
  },

  /* ============================ ELA (Ohio 5.x) ============================ */
  // Reading: Literature
  { subjectSlug: "ela", strand: "Reading: Literature", skillCode: "OH.5.RL.1",
    title: "Quote accurately from a text to support inferences",
    kidFriendly: "When you say what you think a story is about, point to the exact words that gave you that idea.",
    gradeLevel: "5", ladderOrder: 100, estMinutes: 15,
    khanUrl: "https://www.khanacademy.org/ela/cc-5th-reading-vocab",
    ixlUrl: "https://www.ixl.com/ela/grade-5/use-textual-evidence-to-support-an-analysis",
  },
  { subjectSlug: "ela", strand: "Reading: Literature", skillCode: "OH.5.RL.2",
    title: "Determine theme; summarize the text",
    kidFriendly: "Find the big idea or lesson of a story, and tell it back in a few sentences.",
    gradeLevel: "5", ladderOrder: 110, estMinutes: 15,
    khanUrl: "https://www.khanacademy.org/ela/cc-5th-reading-vocab/cc-5th-fictional-prose",
    ixlUrl: "https://www.ixl.com/ela/grade-5/determine-the-theme-of-a-story",
    storyHook: "Theme is the message — like the moral of an Aesop fable. Summary is what happened in order.",
  },
  { subjectSlug: "ela", strand: "Reading: Literature", skillCode: "OH.5.RL.3",
    title: "Compare two characters, settings, or events",
    kidFriendly: "Pick two parts of a story and tell what's the same and what's different.",
    gradeLevel: "5", ladderOrder: 120, estMinutes: 15,
    khanUrl: "https://www.khanacademy.org/ela/cc-5th-reading-vocab/cc-5th-fictional-prose",
    ixlUrl: "https://www.ixl.com/ela/grade-5/compare-and-contrast-characters",
  },
  { subjectSlug: "ela", strand: "Reading: Literature", skillCode: "OH.5.RL.6",
    title: "Describe how the narrator's point of view shapes the story",
    kidFriendly: "First-person 'I'? Third-person 'they'? Whose eyes are we seeing through?",
    gradeLevel: "5", ladderOrder: 130, estMinutes: 15,
    khanUrl: "https://www.khanacademy.org/ela/cc-5th-reading-vocab/cc-5th-fictional-prose",
    ixlUrl: "https://www.ixl.com/ela/grade-5/identify-the-narrative-point-of-view",
  },
  // Reading: Informational
  { subjectSlug: "ela", strand: "Reading: Informational", skillCode: "OH.5.RI.2",
    title: "Determine main ideas in informational text",
    kidFriendly: "What's the article really about? What two or three big points does it make?",
    gradeLevel: "5", ladderOrder: 200, estMinutes: 15,
    khanUrl: "https://www.khanacademy.org/ela/cc-5th-reading-vocab/cc-5th-informational-text",
    ixlUrl: "https://www.ixl.com/ela/grade-5/determine-the-main-idea-of-a-passage",
  },
  { subjectSlug: "ela", strand: "Reading: Informational", skillCode: "OH.5.RI.5",
    title: "Compare structures (chronological, problem/solution, cause/effect, etc.)",
    kidFriendly: "How is the article organized? In time order? Problem-then-solution? Compare-and-contrast?",
    gradeLevel: "5", ladderOrder: 210, estMinutes: 15,
    khanUrl: "https://www.khanacademy.org/ela/cc-5th-reading-vocab/cc-5th-informational-text",
    ixlUrl: "https://www.ixl.com/ela/grade-5/identify-text-structures",
  },
  { subjectSlug: "ela", strand: "Reading: Informational", skillCode: "OH.5.RI.8",
    title: "Identify how an author supports points with reasons + evidence",
    kidFriendly: "When a writer makes a claim, what facts or examples back it up?",
    gradeLevel: "5", ladderOrder: 220, estMinutes: 15,
    khanUrl: "https://www.khanacademy.org/ela/cc-5th-reading-vocab/cc-5th-informational-text",
    ixlUrl: "https://www.ixl.com/ela/grade-5/identify-supporting-details-in-informational-texts",
  },
  // Writing
  { subjectSlug: "ela", strand: "Writing", skillCode: "OH.5.W.1",
    title: "Write opinion pieces with reasons and evidence",
    kidFriendly: "Pick a side, give 3 good reasons, back each with proof. End by restating your opinion.",
    gradeLevel: "5", ladderOrder: 300, estMinutes: 25,
    khanUrl: "https://www.khanacademy.org/ela/cc-5th-reading-vocab",
    ixlUrl: "https://www.ixl.com/ela/grade-5/identify-supporting-details-in-an-opinion-passage",
    handsOnHook: "Write a one-page persuasive letter to Mom about why your animals deserve a treat.",
  },
  { subjectSlug: "ela", strand: "Writing", skillCode: "OH.5.W.2",
    title: "Write informative/explanatory texts with grouped facts",
    kidFriendly: "Pick a topic you know about (birds!) and explain it clearly with facts grouped by subtopic.",
    gradeLevel: "5", ladderOrder: 310, estMinutes: 25,
    ixlUrl: "https://www.ixl.com/ela/grade-5/use-organizational-strategies-to-structure-text",
  },
  { subjectSlug: "ela", strand: "Writing", skillCode: "OH.5.W.3",
    title: "Write narratives with dialogue, pacing, description",
    kidFriendly: "Tell a story with characters that talk, action that builds, and description that paints a picture.",
    gradeLevel: "5", ladderOrder: 320, estMinutes: 25,
    ixlUrl: "https://www.ixl.com/ela/grade-5/use-the-correct-frequently-confused-word",
  },
  // Language
  { subjectSlug: "ela", strand: "Language", skillCode: "OH.5.L.1",
    title: "Use conjunctions, prepositions, interjections correctly",
    kidFriendly: "Words like 'and', 'but', 'because', 'on', 'wow!' — know what each does in a sentence.",
    gradeLevel: "5", ladderOrder: 400, estMinutes: 15,
    ixlUrl: "https://www.ixl.com/ela/grade-5/identify-prepositions",
  },
  { subjectSlug: "ela", strand: "Language", skillCode: "OH.5.L.2",
    title: "Punctuate items in a series; use commas with introductory words",
    kidFriendly: "Commas separate things in a list, set off 'Yes,' or 'However,' at the start of a sentence.",
    gradeLevel: "5", ladderOrder: 410, estMinutes: 10,
    ixlUrl: "https://www.ixl.com/ela/grade-5/commas-with-series-dates-and-places",
  },
  { subjectSlug: "ela", strand: "Language", skillCode: "OH.5.L.4",
    title: "Use context clues + Greek/Latin roots to figure out words",
    kidFriendly: "Don't know a word? Look at the words around it, or break it into root + prefix + suffix.",
    gradeLevel: "5", ladderOrder: 420, estMinutes: 15,
    khanUrl: "https://www.khanacademy.org/ela/cc-5th-reading-vocab/cc-5th-vocabulary",
    ixlUrl: "https://www.ixl.com/ela/grade-5/use-context-to-identify-the-meaning-of-a-word",
  },

  /* ============================ SCIENCE (Ohio 5.x) ============================ */
  { subjectSlug: "science", strand: "Earth & Space Science", skillCode: "OH.5.ESS.1",
    title: "The solar system: sun, planets, moons",
    kidFriendly: "Our sun is a star. 8 planets orbit it. Earth has 1 moon; some planets have many.",
    gradeLevel: "5", ladderOrder: 100, estMinutes: 15,
    khanUrl: "https://www.khanacademy.org/science/cosmology-and-astronomy/solar-system-formation",
    storyHook: "If the sun were a basketball, Earth would be a peppercorn 80 ft away. The solar system is mostly empty.",
  },
  { subjectSlug: "science", strand: "Earth & Space Science", skillCode: "OH.5.ESS.2",
    title: "Cycles in the solar system (day/night, seasons, moon phases)",
    kidFriendly: "Earth spins once a day, tilts as it orbits the sun (seasons), and the moon's lit half changes shape from our view (phases).",
    gradeLevel: "5", ladderOrder: 110, estMinutes: 15,
  },
  { subjectSlug: "science", strand: "Life Science", skillCode: "OH.5.LS.1",
    title: "Energy flow in food webs",
    kidFriendly: "Plants make food from sunlight (producers). Animals eat plants (or other animals). Energy moves up the chain.",
    gradeLevel: "5", ladderOrder: 200, estMinutes: 15,
    khanUrl: "https://www.khanacademy.org/science/biology/ecology",
    handsOnHook: "Map a food web for your backyard — your ducklings, the bugs they eat, the plants the bugs eat.",
  },
  { subjectSlug: "science", strand: "Life Science", skillCode: "OH.5.LS.2",
    title: "Animal/plant adaptations to environment",
    kidFriendly: "Living things change over time so they fit where they live — like a parakeet's feet for gripping branches.",
    gradeLevel: "5", ladderOrder: 210, estMinutes: 15,
  },
  { subjectSlug: "science", strand: "Physical Science", skillCode: "OH.5.PS.1",
    title: "Light and sound as energy that travels in waves",
    kidFriendly: "Light and sound both move in waves — we see things when light bounces; we hear when air vibrates.",
    gradeLevel: "5", ladderOrder: 300, estMinutes: 15,
    khanUrl: "https://www.khanacademy.org/science/physics/mechanical-waves-and-sound",
  },
  { subjectSlug: "science", strand: "Physical Science", skillCode: "OH.5.PS.2",
    title: "Matter and its changes (states, mixtures, conservation)",
    kidFriendly: "Solid, liquid, gas. When you mix or heat or freeze stuff, the matter changes form — but it doesn't disappear.",
    gradeLevel: "5", ladderOrder: 310, estMinutes: 15,
    khanUrl: "https://www.khanacademy.org/science/middle-school-physics/states-of-matter",
  },

  /* ============================ SOCIAL STUDIES (Ohio 5.x) ============================ */
  { subjectSlug: "ss", strand: "History", skillCode: "OH.5.SS.1",
    title: "Early civilizations of the Western Hemisphere",
    kidFriendly: "Indigenous peoples built complex societies in the Americas long before European arrival — Maya, Aztec, Inca, Mississippian.",
    gradeLevel: "5", ladderOrder: 100, estMinutes: 15,
  },
  { subjectSlug: "ss", strand: "Geography", skillCode: "OH.5.SS.2",
    title: "Map the Western Hemisphere; latitude/longitude basics",
    kidFriendly: "Find places using lines that go around the Earth (latitude = sideways, longitude = up/down).",
    gradeLevel: "5", ladderOrder: 110, estMinutes: 15,
    ixlUrl: "https://www.ixl.com/social-studies/grade-5/use-lines-of-latitude-and-longitude",
  },
  { subjectSlug: "ss", strand: "Government", skillCode: "OH.5.SS.3",
    title: "Roles and responsibilities of citizens",
    kidFriendly: "Being a citizen means having rights AND responsibilities — voting, helping others, following fair laws.",
    gradeLevel: "5", ladderOrder: 120, estMinutes: 15,
  },
  { subjectSlug: "ss", strand: "Economics", skillCode: "OH.5.SS.4",
    title: "Productive resources and trade",
    kidFriendly: "People make stuff using natural, human, and capital resources — then trade what they make for what they need.",
    gradeLevel: "5", ladderOrder: 130, estMinutes: 15,
  },
];

let inserted = 0, updated = 0;
for (const s of SKILLS) {
  const [existing] = await conn.query(
    "SELECT id FROM skillLadder WHERE skillCode = ?",
    [s.skillCode]
  );
  if (existing.length) {
    await conn.query(
      `UPDATE skillLadder SET subjectSlug=?, strand=?, title=?, kidFriendly=?, gradeLevel=?, ladderOrder=?, estMinutes=?, khanUrl=?, ixlUrl=?, watchUrl=?, storyHook=?, visualHook=?, handsOnHook=?, ihAligned=?, active=? WHERE id=?`,
      [s.subjectSlug, s.strand, s.title, s.kidFriendly || null, s.gradeLevel, s.ladderOrder, s.estMinutes, s.khanUrl || null, s.ixlUrl || null, s.watchUrl || null, s.storyHook || null, s.visualHook || null, s.handsOnHook || null, s.ihAligned !== false, s.active !== false, existing[0].id]
    );
    updated++;
  } else {
    await conn.query(
      `INSERT INTO skillLadder (subjectSlug, strand, skillCode, title, kidFriendly, gradeLevel, ladderOrder, estMinutes, khanUrl, ixlUrl, watchUrl, storyHook, visualHook, handsOnHook, ihAligned, active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [s.subjectSlug, s.strand, s.skillCode, s.title, s.kidFriendly || null, s.gradeLevel, s.ladderOrder, s.estMinutes, s.khanUrl || null, s.ixlUrl || null, s.watchUrl || null, s.storyHook || null, s.visualHook || null, s.handsOnHook || null, s.ihAligned !== false, s.active !== false]
    );
    inserted++;
  }
}

console.log(`Skill ladder seeded — inserted: ${inserted}, updated: ${updated}, total in seed: ${SKILLS.length}`);

// Initialize skillProgress rows for any skills that don't yet have one,
// using IEP MAP/Acadience baseline as a soft starting confidence
const [allSkills] = await conn.query("SELECT id, subjectSlug FROM skillLadder");
const [existingProgress] = await conn.query("SELECT skillLadderId FROM skillProgress");
const have = new Set(existingProgress.map(r => r.skillLadderId));

// Soft baseline from IEP: she's working below grade level in reading + math
// fluency/comprehension. We start everything at level 1 (introduced) so the
// ladder isn't blank. Diagnostic Placement Week will refine these.
const subjectBaseline = { math: { level: 1, conf: 35 }, ela: { level: 1, conf: 30 }, science: { level: 2, conf: 55 }, ss: { level: 2, conf: 55 } };

let progressRows = 0;
for (const s of allSkills) {
  if (have.has(s.id)) continue;
  const b = subjectBaseline[s.subjectSlug] || { level: 0, conf: 0 };
  await conn.query(
    "INSERT INTO skillProgress (skillLadderId, level, confidence, evidenceCount, lastModeUsed) VALUES (?,?,?,?,?)",
    [s.id, b.level, b.conf, 0, "practice"]
  );
  progressRows++;
}
console.log(`Initialized ${progressRows} skillProgress rows.`);

await conn.end();
