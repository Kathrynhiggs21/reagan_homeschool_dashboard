/**
 * Seed the 2-week 5th-grade curriculum pilot — Days 3 through 10.
 *
 * Days 1 (6/17, Ali + measurement) and 2 (6/18, metric/volume/haiku) already
 * exist in the DB and are left untouched.
 *
 * School days (Mon–Fri, weekends skipped):
 *   Day 3  Fri 6/19  Fractions intro + ELA grammar
 *   Day 4  Mon 6/22  Decimals intro + Reading (Tuck Everlasting ch 1–3)
 *   Day 5  Tue 6/23  Multiply/divide decimals + Writing (narrative)
 *   Day 6  Wed 6/24  Geometry area/perimeter + Science (Spectrum Gr 5)
 *   Day 7  Thu 6/25  Fractions review + Social Studies (US geography)
 *   Day 8  Fri 6/26  Mixed math review + ELA vocabulary
 *   Day 9  Mon 6/29  Division w/ remainders + Reading (Tuck ch 4–6)
 *   Day 10 Tue 6/30  Cumulative review + free-choice block
 *
 * Idempotent: if a day already has a block whose title matches one we are
 * about to insert, we skip that block (so re-running is safe).
 *
 * Run from project root:  node scripts/seed-two-week-curriculum.mjs
 */
import { getDb } from "../server/db.ts";
import { dailyPlans, scheduleBlocks, bookAssignments } from "../drizzle/schema.ts";
import { eq, and, inArray } from "drizzle-orm";

/**
 * scheduleBlocks.blockType is an enum:
 *   morning_warmup | math | adventure | read_aloud | choice | catch_up |
 *   appointment | custom | review
 * Our planning vocabulary (ela/science/social) maps onto it; the REAL subject
 * is carried by subjectId, so the worksheet engine + analytics still route
 * correctly. ELA/reading -> read_aloud, science/social -> custom (academic,
 * opens a worksheet), generic enrichment -> adventure/choice.
 */
const BLOCK_TYPE_ENUM = new Set([
  "morning_warmup", "math", "adventure", "read_aloud",
  "choice", "catch_up", "appointment", "custom", "review",
]);
function mapBlockType(t) {
  if (BLOCK_TYPE_ENUM.has(t)) return t;
  if (t === "ela") return "read_aloud";
  if (t === "science" || t === "social") return "custom";
  return "custom";
}

const SUBJ = { math: 30012, ela: 30013, science: 30014, social: 60001 };
const BOOK = {
  tuck: 390001,
  fdp: 390006, // Fractions, Decimals, and Percents
  natgeo: 390007,
  michael: 780001,
  spectrumScience: 780002,
  language180: 780003,
};

/** One day's plan. Each block: startTime "HH:MM", durationMin, blockType, subjectId, title, description, optional pageRefs. */
const DAYS = [
  {
    date: "2026-06-19",
    label: "Day 3 — Fractions Intro + Grammar",
    blocks: [
      {
        start: "08:30", dur: 40, type: "morning_warmup", subj: SUBJ.math,
        title: "Warm-up: Fraction Picture Match",
        desc: "Quick fraction warm-up. Match each picture (a pizza, a chocolate bar, a measuring cup) to the fraction it shows: 1/2, 1/3, 1/4, 2/3, 3/4. Then write each fraction's numerator and denominator and say what each part means. Goal: wake up the fraction brain before the lesson. Ohio 5.NF.",
      },
      {
        start: "09:15", dur: 45, type: "math", subj: SUBJ.math,
        title: "Adding Fractions with Unlike Denominators — lesson + practice",
        desc: "Today's big idea: you can only add fractions when the pieces are the SAME size. Step 1: find a common denominator (the smallest number both bottoms divide into). Step 2: rename each fraction. Step 3: add the tops, keep the bottom, simplify. Work through 1/2 + 1/3, 2/3 + 1/4, 3/4 + 1/6, then 5 practice problems with answer space. Book backup: Fractions, Decimals, and Percents pg 8–11.",
        pageRefs: [{ book: BOOK.fdp, from: 8, to: 11 }],
      },
      {
        start: "10:00", dur: 45, type: "ela", subj: SUBJ.ela,
        title: "Grammar: Nouns, Verbs & Complete Sentences",
        desc: "180 Days of Language warm-up. Read each sentence, find and label the noun(s) and verb(s), fix the capitalization and punctuation, and rewrite it correctly. Then write 2 of your own complete sentences about something you did this week. Book: 180 Days of Language for 5th Grade pg 12–13.",
        pageRefs: [{ book: BOOK.language180, from: 12, to: 13 }],
      },
      {
        start: "10:45", dur: 30, type: "adventure", subj: SUBJ.math,
        title: "Fun finish: Fraction Snack Lab",
        desc: "Hands-on with Mom: cut a snack (apple, sandwich, or graham crackers) into fourths and thirds. Combine pieces to SHOW 1/2 + 1/4 = 3/4 in real life. Draw what you built and write the matching addition sentence. No timer — just play with the math.",
      },
    ],
  },
  {
    date: "2026-06-22",
    label: "Day 4 — Decimals Intro + Tuck Everlasting ch 1–3",
    blocks: [
      {
        start: "08:30", dur: 40, type: "morning_warmup", subj: SUBJ.math,
        title: "Warm-up: Place Value to the Thousandths",
        desc: "Write each number in a place-value chart: 3.4, 0.27, 5.108, 12.6. Say each digit's place (ones, tenths, hundredths, thousandths) and its value. Then read each decimal out loud the right way ('five and one hundred eight thousandths'). Ohio 5.NBT.",
      },
      {
        start: "09:15", dur: 45, type: "math", subj: SUBJ.math,
        title: "Decimals: Compare, Order & Round — lesson + practice",
        desc: "Big idea: decimals are just fractions of ten. Line up the decimal points, compare digit by digit from the left, and use <, >, =. Then round 4 decimals to the nearest tenth and hundredth. Work the 6 practice problems with answer space. Book backup: Fractions, Decimals, and Percents pg 20–23.",
        pageRefs: [{ book: BOOK.fdp, from: 20, to: 23 }],
      },
      {
        start: "10:00", dur: 45, type: "read_aloud", subj: SUBJ.ela,
        title: "Reading: Tuck Everlasting — Chapters 1–3",
        desc: "Read chapters 1–3 of Tuck Everlasting (pg 1–18). As you read, answer: (1) Who is Winnie Foster and how does she feel about her family? (2) What is the wood and why won't the Tucks let anyone touch the spring? (3) Describe the man in the yellow suit in one sentence. Write your answers in full sentences. Book: Tuck Everlasting pg 1–18.",
        pageRefs: [{ book: BOOK.tuck, from: 1, to: 18 }],
      },
      {
        start: "10:45", dur: 30, type: "adventure", subj: SUBJ.ela,
        title: "Fun finish: Draw the Wood",
        desc: "Draw the wood at the edge of the Foster property the way you pictured it while reading — the giant tree, the spring, the cow path. Label 3 things from the story. This is just for fun and to picture the setting.",
      },
    ],
  },
  {
    date: "2026-06-23",
    label: "Day 5 — Multiply/Divide Decimals + Narrative Writing",
    blocks: [
      {
        start: "08:30", dur: 40, type: "morning_warmup", subj: SUBJ.math,
        title: "Warm-up: Decimal × 10, 100, 1000",
        desc: "Spot the pattern: when you multiply by 10 the decimal point hops RIGHT one place; ÷10 hops LEFT. Solve: 3.5×10, 0.27×100, 48.2÷10, 6÷100. Write the rule in your own words. Ohio 5.NBT.",
      },
      {
        start: "09:15", dur: 45, type: "math", subj: SUBJ.math,
        title: "Multiplying & Dividing Decimals — lesson + practice",
        desc: "Multiply decimals like whole numbers, then count the total decimal places to place the point. Divide by making the divisor a whole number first. Work through 2 worked examples, then 6 practice problems (3 multiply, 3 divide) with answer space. Real-world: figure the cost of 3.5 lbs of apples at $1.20/lb. Book backup: Fractions, Decimals, and Percents pg 24–27.",
        pageRefs: [{ book: BOOK.fdp, from: 24, to: 27 }],
      },
      {
        start: "10:00", dur: 45, type: "ela", subj: SUBJ.ela,
        title: "Writing: Personal Narrative — A Time I Tried Something New",
        desc: "Write a personal narrative (1 page) about a time you tried something new. Plan first: beginning (set the scene), middle (what happened, how you felt), end (what you learned). Use at least 3 sensory details and one line of dialogue. Then reread and circle one sentence you can make stronger. Answer space + lines provided.",
      },
      {
        start: "10:45", dur: 30, type: "adventure", subj: SUBJ.math,
        title: "Fun finish: Grocery Receipt Math",
        desc: "Grab a real (or pretend) grocery receipt. Pick 4 items, estimate the total to the nearest dollar, then add the exact decimals to check. How close was your estimate? Hands-on decimal addition, no timer.",
      },
    ],
  },
  {
    date: "2026-06-24",
    label: "Day 6 — Geometry (Area/Perimeter) + Science",
    blocks: [
      {
        start: "08:30", dur: 40, type: "morning_warmup", subj: SUBJ.math,
        title: "Warm-up: Perimeter vs. Area",
        desc: "Perimeter = the fence around (add all sides). Area = the carpet inside (length × width). For a 6 cm × 4 cm rectangle, find BOTH and label the units (cm vs cm²). Draw one more rectangle of your own and do the same. Ohio 5.MD / 5.G.",
      },
      {
        start: "09:15", dur: 45, type: "math", subj: SUBJ.math,
        title: "Area & Perimeter of Rectangles and Compound Shapes — lesson + practice",
        desc: "Find area and perimeter of rectangles, then break an L-shaped (compound) figure into two rectangles, find each area, and add them. Work 2 examples, then 5 practice figures with answer space. Watch your units: length is units, area is square units. ",
      },
      {
        start: "10:00", dur: 45, type: "adventure", subj: SUBJ.science,
        title: "Science: Matter & Its Properties (Spectrum Science Gr 5)",
        desc: "Read the lesson on properties of matter, then answer the comprehension questions: What are the three states of matter? Give an example of a physical change and a chemical change. Why is mass conserved when ice melts? Write full-sentence answers. Book: Spectrum Science Grade 5 pg 10–13.",
        pageRefs: [{ book: BOOK.spectrumScience, from: 10, to: 13 }],
      },
      {
        start: "10:45", dur: 30, type: "adventure", subj: SUBJ.science,
        title: "Fun finish: Backyard Matter Hunt",
        desc: "Go outside (or around the house) and find one solid, one liquid, and one gas you can prove is there (wind moving leaves counts!). Draw each and write one property of each. Real-world science, no timer.",
      },
    ],
  },
  {
    date: "2026-06-25",
    label: "Day 7 — Fractions Review + Social Studies",
    blocks: [
      {
        start: "08:30", dur: 40, type: "morning_warmup", subj: SUBJ.math,
        title: "Warm-up: Equivalent Fractions Ladder",
        desc: "Build the ladder: write 4 fractions equal to 1/2, then 4 equal to 2/3, by multiplying top and bottom by the same number. Then simplify 6/8, 9/12, and 10/15 back down. Ohio 5.NF.",
      },
      {
        start: "09:15", dur: 45, type: "math", subj: SUBJ.math,
        title: "Fractions Review: Add, Subtract & Compare — mixed practice",
        desc: "Mixed review of this week's fraction work: add and subtract fractions with unlike denominators, compare two fractions, and solve 2 word problems (sharing pizza, measuring ribbon). 8 problems with answer space. Show the common denominator step every time. Book backup: Fractions, Decimals, and Percents pg 12–15.",
        pageRefs: [{ book: BOOK.fdp, from: 12, to: 15 }],
      },
      {
        start: "10:00", dur: 45, type: "custom", subj: SUBJ.social,
        title: "Social Studies: Regions of the United States",
        desc: "Using a US map (in the National Geographic Kids Almanac or online), label the 5 regions: Northeast, Southeast, Midwest, Southwest, West. For each region write one state in it and one thing it's known for (landform, climate, or product). Answer space + a blank map to label. Book: National Geographic Kids Almanac 2026 pg 60–63.",
        pageRefs: [{ book: BOOK.natgeo, from: 60, to: 63 }],
      },
      {
        start: "10:45", dur: 30, type: "adventure", subj: SUBJ.social,
        title: "Fun finish: Design a State Postcard",
        desc: "Pick your favorite US region and draw a postcard 'from' there — show a landmark, an animal, and the weather. Write one sentence on the back about why you'd visit. Just for fun.",
      },
    ],
  },
  {
    date: "2026-06-26",
    label: "Day 8 — Mixed Math Review + ELA Vocabulary",
    blocks: [
      {
        start: "08:30", dur: 40, type: "morning_warmup", subj: SUBJ.math,
        title: "Warm-up: Number of the Day",
        desc: "Today's number is 4.75. Write it as a fraction, round it to the nearest whole, double it, and write a word problem where the answer is 4.75. Stretch your number sense. Ohio 5.NBT / 5.NF.",
      },
      {
        start: "09:15", dur: 45, type: "math", subj: SUBJ.math,
        title: "Mixed Math Review: Fractions, Decimals & Measurement",
        desc: "Two-week checkpoint. 10 mixed problems pulling from everything so far: convert units (cm↔m), add fractions, multiply a decimal, find an area, and one multi-step word problem. Answer space provided. Circle any that felt tricky so we can review them together.",
      },
      {
        start: "10:00", dur: 45, type: "ela", subj: SUBJ.ela,
        title: "ELA: Vocabulary in Context — 8 New Words",
        desc: "Learn 8 grade-5 words (e.g., reluctant, eternal, peculiar, immense, fragile, ancient, glisten, journey). For each: write what you think it means from the sentence clue, then the real definition, then use it in your own sentence. Many of these come straight from Tuck Everlasting. Book backup: 180 Days of Language for 5th Grade pg 20–21.",
        pageRefs: [{ book: BOOK.language180, from: 20, to: 21 }],
      },
      {
        start: "10:45", dur: 30, type: "adventure", subj: SUBJ.ela,
        title: "Fun finish: Vocabulary Charades",
        desc: "Act out 4 of your new vocabulary words for Mom and have her guess. Then draw a quick sketch for your 2 favorite words. Words stick when you move and laugh.",
      },
    ],
  },
  {
    date: "2026-06-29",
    label: "Day 9 — Division with Remainders + Tuck ch 4–6",
    blocks: [
      {
        start: "08:30", dur: 40, type: "morning_warmup", subj: SUBJ.math,
        title: "Warm-up: Division Facts & Estimation",
        desc: "Estimate first, then solve: 84÷4, 96÷6, 125÷5. For each, ask 'about how many?' before the exact answer. Write what the remainder would MEAN if 125 cookies are shared among 5 friends (none!) vs 6 friends. Ohio 5.NBT.",
      },
      {
        start: "09:15", dur: 45, type: "math", subj: SUBJ.math,
        title: "Long Division with Remainders — lesson + practice",
        desc: "Use the steps: Divide, Multiply, Subtract, Bring down, Repeat. Solve 5 problems with 1- and 2-digit divisors, writing the remainder two ways (R and as a fraction). Then 2 word problems where you must decide what to do with the remainder (round up for buses, drop for full boxes). Answer space provided.",
      },
      {
        start: "10:00", dur: 45, type: "read_aloud", subj: SUBJ.ela,
        title: "Reading: Tuck Everlasting — Chapters 4–6",
        desc: "Read chapters 4–6 of Tuck Everlasting (pg 19–36). Answer in full sentences: (1) How did the Tucks become unable to age? (2) Why do they take Winnie with them? (3) Predict: what do you think Winnie will decide about the spring? Book: Tuck Everlasting pg 19–36.",
        pageRefs: [{ book: BOOK.tuck, from: 19, to: 36 }],
      },
      {
        start: "10:45", dur: 30, type: "adventure", subj: SUBJ.math,
        title: "Fun finish: Share-the-Treats Division",
        desc: "Count out a handful of treats or beads. Share them equally among 3, then 4, then 5 'people' (cups). Write the division sentence and the remainder each time. Real-world remainders, no timer.",
      },
    ],
  },
  {
    date: "2026-06-30",
    label: "Day 10 — Cumulative Review + Free Choice",
    blocks: [
      {
        start: "08:30", dur: 40, type: "morning_warmup", subj: SUBJ.math,
        title: "Warm-up: Two-Week Brag Sheet",
        desc: "Look back at everything you learned in 2 weeks: measurement, metric, volume, fractions, decimals, area, division, Tuck Everlasting, matter, US regions. Write down the 3 things you're proudest of learning. No problems to solve — just celebrate the win.",
      },
      {
        start: "09:15", dur: 45, type: "math", subj: SUBJ.math,
        title: "Cumulative Math Review — choose-your-challenge",
        desc: "Final review worksheet with 10 mixed problems across the whole pilot (conversions, fractions, decimals, area, division). Stars mark the 'challenge' problems — try at least 2. Answer space provided. This shows Mom what to keep practicing.",
      },
      {
        start: "10:00", dur: 45, type: "ela", subj: SUBJ.ela,
        title: "ELA: Tuck Everlasting — Write the Ending You Want",
        desc: "You've read 6 chapters. Write a 1-page prediction or alternate ending: what should Winnie do about the spring, and why? Use at least 3 vocabulary words from this week. Plan, draft, and reread. Lines provided.",
      },
      {
        start: "10:45", dur: 30, type: "choice", subj: SUBJ.science,
        title: "Free Choice: Pick Your Own Adventure",
        desc: "Your pick! Choose ONE: (a) a bird-watching walk with the Merlin Bird ID app and log 3 birds, (b) start growing a crystal or a bean seed and draw day 1, or (c) a nature journal page about your favorite thing outside. Reagan chooses — learning that feels like play.",
      },
    ],
  },
];

async function main() {
  const db = getDb();
  let createdBlocks = 0, skippedBlocks = 0, createdPages = 0;
  const report = [];

  for (const day of DAYS) {
    // Ensure a dailyPlans row exists (create directly so we control dayType=full).
    let planRows = await db.select().from(dailyPlans).where(eq(dailyPlans.date, day.date)).limit(1);
    let plan = planRows[0];
    if (!plan) {
      await db.insert(dailyPlans).values({ date: day.date, dayType: "full", status: "planned" });
      planRows = await db.select().from(dailyPlans).where(eq(dailyPlans.date, day.date)).limit(1);
      plan = planRows[0];
    }
    const planId = plan.id;

    // Wipe any PRIOR blocks on this pilot day so the curriculum is the single
    // source of truth (these days previously had auto-generated template
    // blocks like "Michael's World Chapter"). Also clears partial inserts from
    // a failed earlier run, making this script fully re-runnable.
    const prior = await db.select({ id: scheduleBlocks.id })
      .from(scheduleBlocks).where(eq(scheduleBlocks.planId, planId));
    const priorIds = prior.map((b) => b.id);
    if (priorIds.length > 0) {
      await db.delete(bookAssignments).where(inArray(bookAssignments.blockId, priorIds));
      await db.delete(scheduleBlocks).where(eq(scheduleBlocks.planId, planId));
    }
    const existingTitles = new Set();

    let sort = 0;
    let dayCreated = 0;
    for (const blk of day.blocks) {
      if (existingTitles.has(blk.title)) { skippedBlocks++; continue; }
      await db.insert(scheduleBlocks).values({
        planId,
        blockType: mapBlockType(blk.type),
        subjectId: blk.subj ?? null,
        title: blk.title,
        description: blk.desc,
        durationMin: blk.dur,
        startTime: blk.start,
        sortOrder: sort++,
        status: "not_started",
      });
      // Fetch the new block id (by title+plan) to attach page refs.
      const made = await db.select({ id: scheduleBlocks.id })
        .from(scheduleBlocks)
        .where(and(eq(scheduleBlocks.planId, planId), eq(scheduleBlocks.title, blk.title)))
        .limit(1);
      const blockId = made[0]?.id;
      if (blockId && Array.isArray(blk.pageRefs)) {
        for (const pr of blk.pageRefs) {
          await db.insert(bookAssignments).values({
            blockId, bookId: pr.book, fromPage: pr.from, toPage: pr.to, status: "assigned",
          });
          createdPages++;
        }
      }
      createdBlocks++; dayCreated++;
    }
    report.push(`${day.date}  ${day.label}: +${dayCreated} blocks (plan ${planId})`);
  }

  console.log("=== 2-Week Curriculum Seed Report ===");
  report.forEach((r) => console.log(r));
  console.log(`\nTOTAL: created ${createdBlocks} blocks, ${createdPages} page-refs, skipped ${skippedBlocks} (already present).`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
