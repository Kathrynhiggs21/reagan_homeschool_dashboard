/**
 * 6th-Grade Skill Ladder Seed
 * 2026-05-30 — Curated Ohio-aligned skills for 6th-grade preview /
 * Summer-mode "stretch" content. Seeds skillLadder with gradeLevel="6"
 * rows that the auto-attach engine can pull when summer mode is on
 * AND the kid has hit the 5th-grade ready bar.
 *
 * Standards reference:
 *   - Math: Ohio's Learning Standards for Mathematics (2017), Grade 6
 *   - ELA: Ohio's Learning Standards for English Language Arts (2017), Grade 6
 *   - Science: Ohio's Learning Standards for Science (2018), Grade 6
 *   - SS:  Ohio's Learning Standards for Social Studies (2018), Grade 6
 *
 * Every row uses ladderOrder >= 6000 so they sort cleanly AFTER the
 * 5th-grade rows. Re-runnable: callers pass a `lookupExisting` callback
 * that returns the set of skillCodes already present in the table; the
 * seeder skips those.
 */

export interface SixthGradeLadderRow {
  subjectSlug: "math" | "ela" | "science" | "ss";
  strand: string;
  skillCode: string;
  title: string;
  kidFriendly: string;
  ladderOrder: number;
  estMinutes: number;
}

export const SIXTH_GRADE_LADDER_ROWS: SixthGradeLadderRow[] = [
  // ───── MATH (Grade 6) ────────────────────────────────────────────
  { subjectSlug: "math", strand: "Ratios & Proportional Relationships", skillCode: "OH.6.RP.1", title: "Understand the concept of a ratio", kidFriendly: "Compare two amounts using a ratio (like 3:4 or 'for every 2 cups').", ladderOrder: 6010, estMinutes: 15 },
  { subjectSlug: "math", strand: "Ratios & Proportional Relationships", skillCode: "OH.6.RP.3", title: "Use ratio reasoning to solve problems", kidFriendly: "Use ratio tables, tape diagrams, and unit rates to solve real problems.", ladderOrder: 6020, estMinutes: 20 },
  { subjectSlug: "math", strand: "The Number System", skillCode: "OH.6.NS.1", title: "Divide fractions by fractions", kidFriendly: "Solve word problems using fraction division (1¾ ÷ ½).", ladderOrder: 6030, estMinutes: 20 },
  { subjectSlug: "math", strand: "The Number System", skillCode: "OH.6.NS.5", title: "Use positive and negative numbers", kidFriendly: "Use negative numbers for things like temperature, elevation, and money.", ladderOrder: 6040, estMinutes: 15 },
  { subjectSlug: "math", strand: "Expressions & Equations", skillCode: "OH.6.EE.2", title: "Write & evaluate expressions with variables", kidFriendly: "Use letters to stand for numbers in expressions like 3x + 5.", ladderOrder: 6050, estMinutes: 20 },
  { subjectSlug: "math", strand: "Expressions & Equations", skillCode: "OH.6.EE.7", title: "Solve one-step equations", kidFriendly: "Solve x + 7 = 12 or 3x = 24 by undoing the operation.", ladderOrder: 6060, estMinutes: 20 },
  { subjectSlug: "math", strand: "Geometry", skillCode: "OH.6.G.1", title: "Area of triangles and quadrilaterals", kidFriendly: "Find the area of triangles, special quadrilaterals, and polygons.", ladderOrder: 6070, estMinutes: 20 },
  { subjectSlug: "math", strand: "Statistics & Probability", skillCode: "OH.6.SP.5", title: "Summarize numerical data sets", kidFriendly: "Find the mean, median, range, and describe a data set's shape.", ladderOrder: 6080, estMinutes: 20 },

  // ───── ELA (Grade 6) ─────────────────────────────────────────────
  { subjectSlug: "ela", strand: "Reading: Literature", skillCode: "OH.6.RL.1", title: "Cite textual evidence", kidFriendly: "Back up what you say about a story by quoting from it.", ladderOrder: 6110, estMinutes: 15 },
  { subjectSlug: "ela", strand: "Reading: Literature", skillCode: "OH.6.RL.2", title: "Determine theme + summarize", kidFriendly: "Find the big idea (theme) of a story and write a tight summary.", ladderOrder: 6120, estMinutes: 20 },
  { subjectSlug: "ela", strand: "Reading: Informational", skillCode: "OH.6.RI.5", title: "Analyze text structure", kidFriendly: "Notice how an article is organized — cause/effect, compare/contrast, etc.", ladderOrder: 6130, estMinutes: 15 },
  { subjectSlug: "ela", strand: "Writing", skillCode: "OH.6.W.1", title: "Write arguments with reasons & evidence", kidFriendly: "Pick a side, give 3 reasons, back each one with evidence.", ladderOrder: 6140, estMinutes: 30 },
  { subjectSlug: "ela", strand: "Writing", skillCode: "OH.6.W.2", title: "Write informative texts", kidFriendly: "Explain a topic clearly — intro, body paragraphs, conclusion.", ladderOrder: 6150, estMinutes: 30 },
  { subjectSlug: "ela", strand: "Language", skillCode: "OH.6.L.4", title: "Use context to figure out word meaning", kidFriendly: "Use the surrounding sentence to guess what an unfamiliar word means.", ladderOrder: 6160, estMinutes: 15 },

  // ───── SCIENCE (Grade 6) ─────────────────────────────────────────
  { subjectSlug: "science", strand: "Earth & Space Science", skillCode: "OH.6.ESS.1", title: "Minerals, rocks, and the rock cycle", kidFriendly: "Identify minerals + how rocks change between igneous, sedimentary, and metamorphic.", ladderOrder: 6210, estMinutes: 20 },
  { subjectSlug: "science", strand: "Life Science", skillCode: "OH.6.LS.1", title: "Cells: the basic unit of life", kidFriendly: "Cells make up everything alive — plant cells vs animal cells.", ladderOrder: 6220, estMinutes: 20 },
  { subjectSlug: "science", strand: "Life Science", skillCode: "OH.6.LS.3", title: "Classification of living things", kidFriendly: "Group living things by shared traits (kingdom → species).", ladderOrder: 6230, estMinutes: 20 },
  { subjectSlug: "science", strand: "Physical Science", skillCode: "OH.6.PS.1", title: "Energy + its forms", kidFriendly: "Energy can change form: kinetic, potential, thermal, light, sound.", ladderOrder: 6240, estMinutes: 20 },

  // ───── SOCIAL STUDIES (Grade 6) ─────────────────────────────────
  { subjectSlug: "ss", strand: "World Geography", skillCode: "OH.6.SS.1", title: "Use maps + geographic tools", kidFriendly: "Read maps, globes, and charts to learn about places.", ladderOrder: 6310, estMinutes: 15 },
  { subjectSlug: "ss", strand: "World History", skillCode: "OH.6.SS.2", title: "Early river valley civilizations", kidFriendly: "Mesopotamia, Egypt, Indus Valley, China — how rivers shaped these civilizations.", ladderOrder: 6320, estMinutes: 25 },
  { subjectSlug: "ss", strand: "Government", skillCode: "OH.6.SS.4", title: "Compare types of government", kidFriendly: "Democracy, monarchy, dictatorship — how leaders are chosen.", ladderOrder: 6330, estMinutes: 20 },
  { subjectSlug: "ss", strand: "Economics", skillCode: "OH.6.SS.5", title: "Resources, trade, and scarcity", kidFriendly: "Why countries trade — they have what others need, and want what others have.", ladderOrder: 6340, estMinutes: 20 },
];

export interface SeedDeps {
  /** Returns the set of skillCodes that already exist in the ladder table. */
  lookupExisting: () => Promise<Set<string>>;
  /** Inserts a single ladder row. Implementation supplies gradeLevel="6". */
  insertRow: (row: SixthGradeLadderRow) => Promise<void>;
}

export interface SeedSummary {
  inserted: number;
  skipped: number;
  total: number;
  insertedCodes: string[];
}

/** Pure runner: idempotent. Tests inject `deps`; production wires drizzle. */
export async function seedSixthGradeLadder(
  deps: SeedDeps,
): Promise<SeedSummary> {
  const existing = await deps.lookupExisting();
  const insertedCodes: string[] = [];
  let inserted = 0;
  let skipped = 0;
  for (const row of SIXTH_GRADE_LADDER_ROWS) {
    if (existing.has(row.skillCode)) {
      skipped += 1;
      continue;
    }
    await deps.insertRow(row);
    inserted += 1;
    insertedCodes.push(row.skillCode);
  }
  return {
    inserted,
    skipped,
    total: SIXTH_GRADE_LADDER_ROWS.length,
    insertedCodes,
  };
}
