/**
 * v3.31 (2026-06-03) — Deterministic, no-LLM fallback worksheet generator.
 *
 * The safety net behind `synthesizeLessonForBlock`. When the LLM is
 * unavailable, rejects the schema, or returns an empty practice array, a
 * content block used to print as a bare title + blank Notes lines: no real
 * questions, no answer key. Katy's hard requirement is that the printed
 * packet is NEVER pedagogically empty — Reagan must be able to do real,
 * grade-5-appropriate work fully offline.
 *
 * This module produces 3-5 practice items WITH a full answer key for the
 * block's subject, using ONLY pure arithmetic / string templates. No DB, no
 * network, no LLM. It can never throw and never returns an empty set.
 *
 * Determinism: items are seeded from `dateStr` + `blockId` so the same block
 * on the same day always yields the same worksheet (stable across the nightly
 * email and a later "Print Daily" click), while different days vary. This
 * mirrors the determinism the agenda assembler already relies on elsewhere.
 *
 * The returned shape is the same `LessonPayload` the PDF builder consumes, so
 * the fallback is a drop-in for a synthesized lesson.
 */

import type { AgendaPdfBlock } from "./agendaPdf";

type LessonPayload = NonNullable<AgendaPdfBlock["lesson"]>;

export type FallbackSubject =
  | "math"
  | "ela"
  | "reading"
  | "writing"
  | "science"
  | "social-studies"
  | "spelling"
  | "general";

export interface FallbackInput {
  blockId: number;
  blockTitle: string;
  subjectSlug?: string | null;
  durationMin?: number | null;
  dateStr: string;
  /** Optional Ohio Learning Standard code, e.g. "5.NBT.5". */
  standardCode?: string | null;
}

/** Small deterministic PRNG (mulberry32) seeded from a string. */
function seedFrom(s: string): number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalizeSubject(slug?: string | null): FallbackSubject {
  const s = String(slug ?? "").toLowerCase();
  if (s.includes("math")) return "math";
  if (s.includes("spell")) return "spelling";
  if (s.includes("read")) return "reading";
  if (s.includes("writ")) return "writing";
  if (s.includes("ela") || s.includes("language") || s.includes("english"))
    return "ela";
  if (s.includes("sci")) return "science";
  if (s.includes("social") || s.includes("history") || s.includes("geo"))
    return "social-studies";
  return "general";
}

/** How many items to produce given the time budget (clamped 3-5). */
function itemCount(durationMin?: number | null): number {
  const d = typeof durationMin === "number" && durationMin > 0 ? durationMin : 30;
  if (d <= 20) return 3;
  if (d >= 45) return 5;
  return 4;
}

type QA = { q: string; a: string };

function mathItems(rand: () => number, n: number): QA[] {
  const out: QA[] = [];
  const kinds = ["mul", "add", "sub", "frac", "decimal", "order"];
  for (let i = 0; i < n; i++) {
    const kind = kinds[Math.floor(rand() * kinds.length)];
    if (kind === "mul") {
      const a = 12 + Math.floor(rand() * 88); // 12-99
      const b = 2 + Math.floor(rand() * 8); // 2-9
      out.push({ q: `Multiply: ${a} × ${b} =`, a: String(a * b) });
    } else if (kind === "add") {
      const a = 1000 + Math.floor(rand() * 9000);
      const b = 1000 + Math.floor(rand() * 9000);
      out.push({ q: `Add: ${a} + ${b} =`, a: String(a + b) });
    } else if (kind === "sub") {
      const a = 5000 + Math.floor(rand() * 4000);
      const b = 1000 + Math.floor(rand() * (a - 1000));
      out.push({ q: `Subtract: ${a} − ${b} =`, a: String(a - b) });
    } else if (kind === "frac") {
      const d = 4 + Math.floor(rand() * 6); // 4-9
      const n1 = 1 + Math.floor(rand() * (d - 1));
      const n2 = 1 + Math.floor(rand() * (d - 1));
      const sum = n1 + n2;
      out.push({
        q: `Add the fractions (same denominator): ${n1}/${d} + ${n2}/${d} =`,
        a: `${sum}/${d}` + (sum > d ? ` (or ${Math.floor(sum / d)} ${sum % d}/${d})` : ""),
      });
    } else if (kind === "decimal") {
      const a = (Math.floor(rand() * 900) + 100) / 100; // x.xx
      const b = (Math.floor(rand() * 900) + 100) / 100;
      out.push({
        q: `Add the decimals: ${a.toFixed(2)} + ${b.toFixed(2)} =`,
        a: (a + b).toFixed(2),
      });
    } else {
      const a = 2 + Math.floor(rand() * 8);
      const b = 2 + Math.floor(rand() * 8);
      const c = 2 + Math.floor(rand() * 8);
      out.push({
        q: `Order of operations: ${a} + ${b} × ${c} =`,
        a: String(a + b * c),
      });
    }
  }
  return out;
}

function readingItems(_title: string, n: number): QA[] {
  const bank: QA[] = [
    {
      q: "Read for 15 minutes, then write the main idea of what you read in one sentence.",
      a: "Answers vary — adult checks that the sentence names the topic + what the author says about it.",
    },
    {
      q: "Find one word you did not know. Write the word and what you think it means from context.",
      a: "Answers vary — adult confirms the guessed meaning is reasonable for the sentence.",
    },
    {
      q: "Who is the most important character or person, and what do they want? (1-2 sentences)",
      a: "Answers vary — adult checks the character is named and a goal/motivation is given.",
    },
    {
      q: "Write one question you still have after reading.",
      a: "Answers vary — any genuine question about the text is correct.",
    },
    {
      q: "Make a prediction: what do you think happens next, and why?",
      a: "Answers vary — adult checks the prediction is supported by a 'because'.",
    },
  ];
  return bank.slice(0, n);
}

function writingItems(n: number): QA[] {
  const bank: QA[] = [
    {
      q: "Write a topic sentence for a paragraph about today's lesson.",
      a: "Answers vary — adult checks it states one clear main idea.",
    },
    {
      q: "Add two detail sentences that support your topic sentence.",
      a: "Answers vary — adult checks each detail relates to the topic sentence.",
    },
    {
      q: "Circle one sentence above and underline its subject once and its verb twice.",
      a: "Adult checks the subject (who/what) and the action verb are correctly marked.",
    },
    {
      q: "Rewrite this sentence with a stronger verb: 'The dog went across the yard.'",
      a: "Sample: 'The dog dashed/sprinted/trotted across the yard.' Any vivid verb is correct.",
    },
    {
      q: "Write a closing sentence that restates your main idea in new words.",
      a: "Answers vary — adult checks it echoes the topic sentence without copying it.",
    },
  ];
  return bank.slice(0, n);
}

function spellingItems(rand: () => number, n: number): QA[] {
  const words = [
    "necessary",
    "separate",
    "beginning",
    "embarrass",
    "rhythm",
    "definitely",
    "occurrence",
    "privilege",
    "conscience",
    "weird",
  ];
  const out: QA[] = [];
  const used = new Set<number>();
  for (let i = 0; i < n; i++) {
    let idx = Math.floor(rand() * words.length);
    let guard = 0;
    while (used.has(idx) && guard++ < words.length) idx = (idx + 1) % words.length;
    used.add(idx);
    const w = words[idx];
    out.push({
      q: `Write the word that means a clue / put it in a sentence (scrambled: ${scramble(w, rand)})`,
      a: w,
    });
  }
  return out;
}
function scramble(w: string, rand: () => number): string {
  const arr = w.split("");
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join("");
}

function scienceItems(n: number): QA[] {
  const bank: QA[] = [
    {
      q: "Observe something in nature (a plant, the sky, an animal). Draw it and label 3 parts.",
      a: "Answers vary — adult checks 3 reasonable labels are present.",
    },
    {
      q: "Write one question you could investigate about what you observed.",
      a: "Answers vary — any testable/observable question is correct.",
    },
    {
      q: "Name one thing living things need to survive, and explain why.",
      a: "Accept: food, water, air, shelter, sunlight (for plants) — with a 'because' reason.",
    },
    {
      q: "What is one way matter can change (solid/liquid/gas)? Give an example.",
      a: "Accept melting, freezing, evaporating, condensing — with a real-world example.",
    },
    {
      q: "Predict what happens to a puddle on a sunny day, and explain why.",
      a: "It evaporates (turns to water vapor) because the sun's heat adds energy.",
    },
  ];
  return bank.slice(0, n);
}

function socialStudiesItems(n: number): QA[] {
  const bank: QA[] = [
    {
      q: "Name your state and its capital. Draw a simple map and mark your city.",
      a: "Ohio; capital is Columbus. Adult checks the map marks the home city.",
    },
    {
      q: "What is one job of a community helper, and how does it help people?",
      a: "Answers vary — adult checks the role and how it serves the community.",
    },
    {
      q: "Write one rule or law and explain why it keeps people safe.",
      a: "Answers vary — adult checks the rule is real and the reason is sensible.",
    },
    {
      q: "What is the difference between a need and a want? Give one example of each.",
      a: "Need = required to live (food/water/shelter); want = nice to have (toy/game).",
    },
  ];
  return bank.slice(0, n);
}

function generalItems(title: string, n: number): QA[] {
  const bank: QA[] = [
    {
      q: `In one sentence, what is the goal of "${title}"?`,
      a: "Answers vary — adult checks it names what the block is about.",
    },
    {
      q: "List 3 things you already know about this topic.",
      a: "Answers vary — any 3 reasonable prior-knowledge items.",
    },
    {
      q: "Write one new thing you want to learn during this block.",
      a: "Answers vary — any genuine learning goal is correct.",
    },
    {
      q: "After the block, write one sentence about what you did or learned.",
      a: "Answers vary — adult checks it reflects the actual activity.",
    },
    {
      q: "Rate how it went (1-5) and write why.",
      a: "Answers vary — any rating with a reason is correct.",
    },
  ];
  return bank.slice(0, n);
}

/**
 * Build a deterministic fallback lesson. NEVER throws, NEVER empty.
 */
export function fallbackWorksheetForBlock(input: FallbackInput): LessonPayload {
  const subject = normalizeSubject(input.subjectSlug);
  const n = itemCount(input.durationMin);
  const rand = mulberry32(seedFrom(`${input.dateStr}|${input.blockId}|${subject}`));

  let items: QA[];
  switch (subject) {
    case "math":
      items = mathItems(rand, n);
      break;
    case "reading":
      items = readingItems(input.blockTitle, n);
      break;
    case "writing":
      items = writingItems(n);
      break;
    case "ela":
      // ELA blends a reading-response item with writing items
      items = [...readingItems(input.blockTitle, 1), ...writingItems(n - 1)];
      break;
    case "spelling":
      items = spellingItems(rand, n);
      break;
    case "science":
      items = scienceItems(n);
      break;
    case "social-studies":
      items = socialStudiesItems(n);
      break;
    default:
      items = generalItems(input.blockTitle, n);
      break;
  }

  // Absolute floor: guarantee at least 3 items even if a bank was short.
  while (items.length < 3) {
    items.push({
      q: "Write one complete sentence about what you worked on.",
      a: "Answers vary — adult checks it is a complete sentence.",
    });
  }

  const standardLine = input.standardCode
    ? `Aligned to Ohio Learning Standard: ${input.standardCode}. `
    : "";
  const instructions =
    `${standardLine}Complete the items below on paper. ` +
    `This is an offline practice set for "${input.blockTitle}" — no screen or login needed. ` +
    `An adult can check answers with the answer key at the bottom.`;

  const answerKey = items.map((it, i) => `${i + 1}. ${it.a}`).join("\n");

  return {
    instructions,
    objectives: [
      `Practice grade-5 ${subject === "general" ? "skills" : subject} for "${input.blockTitle}".`,
      "Complete every item with a full sentence or worked solution.",
    ],
    materials: ["Pencil", "Paper"],
    videos: [],
    worksheets: [
      {
        title: `${input.blockTitle} — Offline Practice`,
        description: input.standardCode
          ? `Aligned to ${input.standardCode}`
          : "Deterministic offline practice (no internet required)",
        questions: items.map((it) => it.q),
      },
    ],
    answerKey,
  };
}
