/**
 * Q4 standards seeder — push 29 (2026-05-13).
 *
 * Idempotent insert into `curriculumTopics` for the 5th-grade Q4
 * standards in `server/_knowledge/q4_standards.txt`. Run on demand
 * via the `curriculum.seedQ4Standards` mutation (familyAdmin only)
 * or programmatically in tests.
 *
 * Spec items closed:
 *   - "Seed any missing curriculum_topics rows from Q4 standards
 *      (5.OA.1-3, 5.G.1-4, RL/RF/RI/W/SL/L 5.x) — idempotent"
 *   - "Q4 standards from `5thGrade-4thQuarterStandards.docx` are
 *      imported into `curriculumTopics` if not already present
 *      (idempotent seeder)"
 *   - "Q4 ELA standards (RL/RF/RI/W/SL/L 5.x) imported as their own
 *      topics"
 */

import * as fs from "node:fs";
import * as path from "node:path";

export interface Q4Standard {
  subject: "Math" | "ELA" | "Science";
  code: string;       // e.g. "5.OA.1", "1.RL.5.1"
  title: string;
  standardRef: string; // ohio standard ref (same as code for these)
}

const STANDARDS_FILE = path.join(__dirname, "..", "_knowledge", "q4_standards.txt");

let cachedStandards: Q4Standard[] | null = null;

/**
 * Parse the Q4 knowledge file into structured standards.
 * Lines look like:
 *   5.OA.1: Use parentheses in numerical expressions, ...
 *   1.RL.5.1  Quote accurately from a text when ...
 *
 * Section headers ("Math Standards:", "ELA Standards:", "Science
 * Standards:") switch the active subject.
 */
export function parseQ4Standards(text: string): Q4Standard[] {
  const out: Q4Standard[] = [];
  let subject: Q4Standard["subject"] = "Math";
  // Match either "5.OA.1: ..." (math) or "1.RL.5.1  ..." (ELA).
  const mathLine = /^(5\.[A-Z]+\.\d+[a-z]?)\s*:\s*(.+)$/;
  const elaLine = /^(\d+\.(?:RL|RF|RI|W|SL|L)\.5\.\d+[a-z]?)\s+(.+)$/;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (/^Math Standards/i.test(line)) { subject = "Math"; continue; }
    if (/^ELA Standards/i.test(line))  { subject = "ELA"; continue; }
    if (/^Science Standards/i.test(line)) { subject = "Science"; continue; }
    // Skip section sub-headers
    if (/^(Reading|Writing|Nature of)/.test(line)) continue;

    let m = line.match(mathLine);
    if (m) {
      out.push({ subject: "Math", code: m[1], title: m[2].trim(), standardRef: m[1] });
      continue;
    }
    m = line.match(elaLine);
    if (m) {
      // Some ELA lines smush two standards on one row separated by tabs;
      // grab the first cleanly and let the second land on the next row.
      out.push({ subject: "ELA", code: m[1], title: m[2].trim().split(/\t/)[0].trim(), standardRef: m[1] });
      continue;
    }
  }
  return out;
}

export function loadQ4Standards(): Q4Standard[] {
  if (cachedStandards) return cachedStandards;
  if (!fs.existsSync(STANDARDS_FILE)) {
    cachedStandards = [];
    return cachedStandards;
  }
  const txt = fs.readFileSync(STANDARDS_FILE, "utf-8");
  cachedStandards = parseQ4Standards(txt);
  return cachedStandards;
}

/**
 * Idempotent seeder: inserts any standard from the knowledge file
 * that isn't already present (keyed on subject+code). Returns the
 * number of rows actually inserted.
 *
 * Safe to call repeatedly. Never modifies existing rows (preserves
 * status/notes/khanUrl/ixlUrl/lastCovered* etc.).
 */
export async function seedQ4StandardsIfMissing(deps: {
  listExisting: () => Promise<Array<{ subject: string; code: string }>>;
  insert: (rows: Array<{ subject: string; code: string; title: string; standardRef: string; quarter: string; ord: number }>) => Promise<void>;
}): Promise<{ inserted: number; total: number }> {
  const standards = loadQ4Standards();
  const existing = await deps.listExisting();
  const existingKeys = new Set(existing.map((r) => `${r.subject}::${r.code}`));
  const toInsert = standards
    .filter((s) => !existingKeys.has(`${s.subject}::${s.code}`))
    .map((s, i) => ({
      subject: s.subject,
      code: s.code,
      title: s.title,
      standardRef: s.standardRef,
      quarter: "Q4",
      ord: i,
    }));
  if (toInsert.length > 0) {
    await deps.insert(toInsert);
  }
  return { inserted: toInsert.length, total: standards.length };
}
