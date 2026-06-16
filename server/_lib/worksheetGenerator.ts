/**
 * 2026-06-16 — Full worksheet content generator.
 *
 * Produces REAL, workable 5th-grade worksheet content (problems, passages,
 * prompts) for a given block so a tapped block opens a fill-in-online
 * worksheet + matching printable PDF — never a stub or a bare link.
 *
 * Two layers:
 *  1. `buildDeterministicWorksheet` — always returns full, topic-appropriate
 *     content (no network). Keyword-mapped to the block's subject/title.
 *  2. `generateWorksheet` — tries the LLM for richer, tailored content with a
 *     strict JSON schema; falls back to the deterministic builder on timeout,
 *     error, or unusable output. Guarantees a usable worksheet every time.
 *
 * The non-academic guard (`isNonAcademicBlock`) lets callers skip lunch /
 * breaks / appointments (e.g. the Ali visit) so those never try to open work.
 */
import { invokeLLM } from "../_core/llm";
import {
  type WorksheetContent,
  type WorksheetSection,
  isUsableWorksheet,
} from "@shared/worksheetTypes";

export type WorksheetSeed = {
  blockTitle: string;
  subjectSlug?: string | null;
  /** free-text topic/description hint from the block */
  topicHint?: string | null;
  /** owned-book page reference if any (e.g. "Spectrum Science Grade 5 pg 42-43") */
  bookRef?: string | null;
};

/* -------------------------------------------------------------------------- */
/*  Non-academic guard                                                        */
/* -------------------------------------------------------------------------- */
const NON_ACADEMIC = /\b(lunch|snack|break|recess|free\s*play|free\s*time|rest|nap|brain\s*break|playtime|appointment|visit|ali\b|outing|drive|travel|nap|wake|wake[-\s]?up|bedtime|dinner|breakfast|chores?|clean\s*up)\b/i;

/** True when a block is a break / meal / appointment and should NOT open work. */
export function isNonAcademicBlock(opts: { title?: string | null; blockType?: string | null }): boolean {
  const t = (opts.title ?? "").trim();
  if (opts.blockType === "appointment") return true;
  if (!t) return false;
  return NON_ACADEMIC.test(t);
}

/* -------------------------------------------------------------------------- */
/*  Subject keyword → bucket                                                  */
/* -------------------------------------------------------------------------- */
type Bucket = "math" | "ela" | "reading" | "science" | "social" | "writing" | "generic";

function bucketFor(seed: WorksheetSeed): Bucket {
  const s = (seed.subjectSlug ?? "").toLowerCase();
  const t = `${seed.blockTitle} ${seed.topicHint ?? ""}`.toLowerCase();
  const hit = (re: RegExp) => re.test(s) || re.test(t);
  if (hit(/\bmath|measure|convert|conversion|volume|fraction|decimal|geometry|multipl|divi|number\b/)) return "math";
  if (hit(/\bscience|spectrum|earth|planet|matter|energy|ecosystem|cells?|weather|water\s*cycle\b/)) return "science";
  if (hit(/\bhaiku|poetry|poem|writing|write|essay|compose|narrative\b/)) return "writing";
  if (hit(/\bread\s*aloud|reading|tuck|michael|novel|chapter|story\b/)) return "reading";
  if (hit(/\bela|language|grammar|180\s*days|vocab|spelling|sentence\b/)) return "ela";
  if (hit(/\bsocial|history|geography|civics|map\b/)) return "social";
  return "generic";
}

/* -------------------------------------------------------------------------- */
/*  Deterministic builders (always full content)                             */
/* -------------------------------------------------------------------------- */
function mathConversionWorksheet(seed: WorksheetSeed): WorksheetSection[] {
  return [
    {
      heading: "Warm-up — say it, then write it",
      instructions: "Fill in the blank. Use your cheat-sheet if you need it.",
      items: [
        { id: "q1", kind: "short", prompt: "1 foot = ______ inches", answer: "12" },
        { id: "q2", kind: "short", prompt: "1 yard = ______ feet", answer: "3" },
        { id: "q3", kind: "short", prompt: "1 gallon = ______ quarts", answer: "4" },
        { id: "q4", kind: "short", prompt: "1 pound = ______ ounces", answer: "16" },
      ],
    },
    {
      heading: "Convert these",
      instructions: "Multiply when you go to a smaller unit; divide when you go to a bigger unit.",
      items: [
        { id: "q5", kind: "short", prompt: "4 feet = ______ inches", answer: "48" },
        { id: "q6", kind: "short", prompt: "3 gallons = ______ quarts", answer: "12" },
        { id: "q7", kind: "short", prompt: "2 pounds = ______ ounces", answer: "32" },
        { id: "q8", kind: "short", prompt: "24 inches = ______ feet", answer: "2" },
        { id: "q9", kind: "short", prompt: "8 quarts = ______ gallons", answer: "2" },
      ],
    },
    {
      heading: "Word problem",
      instructions: "Show your thinking, then write the answer.",
      items: [
        {
          id: "q10",
          kind: "long",
          lines: 3,
          prompt: "A recipe needs 2 quarts of water. You only have a 1-cup measuring cup. How many cups do you need? (Hint: 1 quart = 4 cups.)",
          answer: "8 cups (2 quarts × 4 cups = 8)",
        },
      ],
    },
  ];
}

function mathVolumeWorksheet(): WorksheetSection[] {
  return [
    {
      heading: "What is volume?",
      instructions: "Volume = how much space fills a solid. We count unit cubes, or use length × width × height.",
      items: [
        { id: "q1", kind: "short", prompt: "A box is 2 cm × 3 cm × 4 cm. Volume = ______ cubic cm", answer: "24" },
        { id: "q2", kind: "short", prompt: "A cube has sides of 5 cm. Volume = ______ cubic cm", answer: "125" },
        { id: "q3", kind: "short", prompt: "A box is 1 cm × 1 cm × 10 cm. Volume = ______ cubic cm", answer: "10" },
      ],
    },
    {
      heading: "Try a few",
      items: [
        { id: "q4", kind: "short", prompt: "3 × 3 × 3 = ______", answer: "27" },
        { id: "q5", kind: "short", prompt: "2 × 5 × 6 = ______", answer: "60" },
        { id: "q6", kind: "long", lines: 3, prompt: "1 mL of water fills 1 cubic cm. How many mL fit in a 2 × 2 × 2 cm box? Explain.", answer: "8 mL — volume is 8 cubic cm and 1 cm³ holds 1 mL." },
      ],
    },
  ];
}

function metricWorksheet(): WorksheetSection[] {
  return [
    {
      heading: "The base-10 ladder",
      instructions: "Each step is ×10 or ÷10. milli → centi → (base) → kilo.",
      items: [
        { id: "q1", kind: "short", prompt: "1 meter = ______ centimeters", answer: "100" },
        { id: "q2", kind: "short", prompt: "1 kilometer = ______ meters", answer: "1000" },
        { id: "q3", kind: "short", prompt: "1 liter = ______ milliliters", answer: "1000" },
        { id: "q4", kind: "short", prompt: "1 kilogram = ______ grams", answer: "1000" },
        { id: "q5", kind: "short", prompt: "250 cm = ______ meters", answer: "2.5" },
      ],
    },
    {
      heading: "Think it through",
      items: [
        { id: "q6", kind: "long", lines: 3, prompt: "Why is the metric system easier to convert than inches and feet? Use the words 'ten' and 'ladder'.", answer: "Every step is a power of ten, so you just move the decimal point." },
      ],
    },
  ];
}

function writingHaikuWorksheet(): WorksheetSection[] {
  return [
    {
      heading: "What is a haiku?",
      instructions: "A haiku is a tiny nature poem with 3 lines: 5 syllables, 7 syllables, 5 syllables.",
      items: [
        { id: "q1", kind: "short", prompt: "How many syllables are in line 1? ______", answer: "5" },
        { id: "q2", kind: "short", prompt: "How many syllables are in line 2? ______", answer: "7" },
        { id: "q3", kind: "short", prompt: "How many syllables are in line 3? ______", answer: "5" },
      ],
    },
    {
      heading: "Count the syllables",
      items: [
        { id: "q4", kind: "short", prompt: "Clap it out: 'butterfly' has ______ syllables", answer: "3" },
        { id: "q5", kind: "short", prompt: "Clap it out: 'morning' has ______ syllables", answer: "2" },
      ],
    },
    {
      heading: "Write your own",
      instructions: "Pick something you can see outside. Write 2 haiku. Count on your fingers!",
      items: [
        { id: "q6", kind: "prompt", lines: 4, prompt: "Haiku #1 (5 / 7 / 5):" },
        { id: "q7", kind: "prompt", lines: 4, prompt: "Haiku #2 (5 / 7 / 5):" },
      ],
    },
  ];
}

function readingWorksheet(seed: WorksheetSeed): WorksheetSection[] {
  const ref = seed.bookRef || "your reading book";
  return [
    {
      heading: "Read",
      instructions: `Read today's pages from ${ref}. Then answer in your own words.`,
      items: [
        { id: "q1", kind: "long", lines: 3, prompt: "What happened in today's reading? (2-3 sentences.)" },
        { id: "q2", kind: "long", lines: 3, prompt: "Who was the most important character, and why?" },
        { id: "q3", kind: "short", prompt: "One new or interesting word you read: ______" },
        { id: "q4", kind: "long", lines: 2, prompt: "What do you think will happen next?" },
      ],
    },
  ];
}

function elaWorksheet(seed: WorksheetSeed): WorksheetSection[] {
  const ref = seed.bookRef || "180 Days of Language for 5th Grade";
  return [
    {
      heading: "Language practice",
      instructions: `Complete today's page from ${ref}, then these.`,
      items: [
        { id: "q1", kind: "short", prompt: "Fix the sentence: 'me and her went to the park.'", answer: "She and I went to the park." },
        { id: "q2", kind: "short", prompt: "Add the right end mark: 'Where are we going ___'", answer: "?" },
        { id: "q3", kind: "short", prompt: "Plural of 'leaf' = ______", answer: "leaves" },
        { id: "q4", kind: "long", lines: 2, prompt: "Write a sentence that uses a comma in a list of 3 things." },
      ],
    },
  ];
}

function scienceWorksheet(seed: WorksheetSeed): WorksheetSection[] {
  const ref = seed.bookRef || "Spectrum Science Grade 5";
  return [
    {
      heading: "Read & answer",
      instructions: `Read today's pages from ${ref}. Answer in your own words.`,
      items: [
        { id: "q1", kind: "long", lines: 3, prompt: "What is the main idea of today's science reading?" },
        { id: "q2", kind: "short", prompt: "One vocabulary word and what it means: ______" },
        { id: "q3", kind: "long", lines: 3, prompt: "Draw OR describe one example from real life that matches this idea." },
      ],
    },
    {
      heading: "Try it (hands-on)",
      items: [
        { id: "q4", kind: "long", lines: 3, prompt: "Write down one question you still have. We can test or look it up together." },
      ],
    },
  ];
}

function genericWorksheet(seed: WorksheetSeed): WorksheetSection[] {
  return [
    {
      heading: seed.blockTitle,
      instructions: "Work through these and write what you learned.",
      items: [
        { id: "q1", kind: "long", lines: 3, prompt: `What is today's "${seed.blockTitle}" about? Write 2-3 sentences.` },
        { id: "q2", kind: "long", lines: 3, prompt: "What was the trickiest part, and how did you work through it?" },
        { id: "q3", kind: "short", prompt: "One thing you want to remember: ______" },
      ],
    },
  ];
}

/** Always returns a full, usable worksheet from the block (no network). */
export function buildDeterministicWorksheet(seed: WorksheetSeed): WorksheetContent {
  const bucket = bucketFor(seed);
  const t = `${seed.blockTitle} ${seed.topicHint ?? ""}`.toLowerCase();
  let sections: WorksheetSection[];
  let intro: string;

  if (bucket === "math") {
    if (/volume/.test(t)) { sections = mathVolumeWorksheet(); intro = "Today we explore volume — the space inside a solid."; }
    else if (/metric/.test(t)) { sections = metricWorksheet(); intro = "Today we practice the metric system and its base-10 ladder."; }
    else { sections = mathConversionWorksheet(seed); intro = "Today we practice measurement conversions."; }
  } else if (bucket === "writing") {
    sections = writingHaikuWorksheet(); intro = "Today we learn haiku — tiny nature poems.";
  } else if (bucket === "reading") {
    sections = readingWorksheet(seed); intro = "Today's reading, then some thinking questions.";
  } else if (bucket === "ela") {
    sections = elaWorksheet(seed); intro = "Today's language practice.";
  } else if (bucket === "science") {
    sections = scienceWorksheet(seed); intro = "Today's science reading and a hands-on question.";
  } else {
    sections = genericWorksheet(seed); intro = `Let's work on ${seed.blockTitle}.`;
  }

  return {
    title: seed.blockTitle,
    intro,
    subjectSlug: seed.subjectSlug ?? null,
    bookRef: seed.bookRef ?? null,
    sections,
  };
}

/* -------------------------------------------------------------------------- */
/*  LLM-backed generator with guaranteed fallback                            */
/* -------------------------------------------------------------------------- */
const WORKSHEET_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    intro: { type: "string" },
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          heading: { type: "string" },
          instructions: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                kind: { type: "string", enum: ["short", "long", "mc", "passage", "prompt"] },
                prompt: { type: "string" },
                choices: { type: "array", items: { type: "string" } },
                lines: { type: "integer" },
                answer: { type: "string" },
              },
              required: ["id", "kind", "prompt"],
              additionalProperties: false,
            },
          },
        },
        required: ["items"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "sections"],
  additionalProperties: false,
} as const;

export async function generateWorksheet(
  seed: WorksheetSeed,
  opts: { timeoutMs?: number } = {},
): Promise<{ content: WorksheetContent; source: "llm" | "fallback" }> {
  const fallback = buildDeterministicWorksheet(seed);
  const timeoutMs = opts.timeoutMs ?? 35000;

  try {
    const sys =
      "You are a 5th-grade teacher creating a SHORT, COMPLETE, do-it-now worksheet a 10-year-old works on directly. " +
      "Return 1-3 sections with 4-10 total items. Use REAL problems/questions/prompts (not instructions to go elsewhere, no links, no logins). " +
      "Kinds: 'short' (one-line answer), 'long' (a few lines), 'mc' (give 'choices'), 'passage' (a short text to read, no answer), 'prompt' (writing space via 'lines'). " +
      "For reading/science tied to a physical book, write a passage OR comprehension questions about the topic. Keep it encouraging and age-appropriate. " +
      "Always include an 'answer' for objective items so a parent can check it.";
    const user =
      `Block title: ${seed.blockTitle}\n` +
      `Subject: ${seed.subjectSlug ?? "(general)"}\n` +
      `Topic hint: ${seed.topicHint ?? "(none)"}\n` +
      `Owned book reference: ${seed.bookRef ?? "(none)"}\n` +
      `Make the worksheet now.`;

    const race = await Promise.race([
      invokeLLM({
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        max_tokens: 1800,
        response_format: {
          type: "json_schema",
          json_schema: { name: "worksheet", strict: true, schema: WORKSHEET_SCHEMA as any },
        },
      } as any),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);

    if (!race) return { content: fallback, source: "fallback" };
    const raw = (race as any)?.choices?.[0]?.message?.content;
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (parsed && typeof parsed === "object") {
      const content: WorksheetContent = {
        title: parsed.title || seed.blockTitle,
        intro: parsed.intro,
        subjectSlug: seed.subjectSlug ?? null,
        bookRef: seed.bookRef ?? null,
        sections: Array.isArray(parsed.sections) ? parsed.sections : [],
      };
      if (isUsableWorksheet(content)) return { content, source: "llm" };
    }
    return { content: fallback, source: "fallback" };
  } catch (e) {
    console.warn("[worksheetGenerator] LLM failed, using fallback", e);
    return { content: fallback, source: "fallback" };
  }
}
