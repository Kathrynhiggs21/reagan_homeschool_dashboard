/**
 * dayBuilder.ts (Slice 2)
 *
 * Produces a *varied* daily template for the auto-builder, instead of the old
 * fixed 6-block list. Each weekday picks a different "shape" + different
 * leading subject + pulls real next-page-spans from Reagan's owned books.
 *
 * The result is consumed by autoBuildBlocksForPlan in server/db.ts. We keep
 * the same { title, description, slug, type, minutes } shape so the existing
 * insert loop doesn't need to change.
 *
 * Variation rules (intentionally simple + deterministic):
 *  - Mon  → math-led, 6 blocks, 9:00 start
 *  - Tue  → ELA-led, 5 blocks, 8:45 start
 *  - Wed  → therapy day (handled upstream)
 *  - Thu  → science-adventure-led, 6 blocks, 9:15 start
 *  - Fri  → choice-led + wrap-up, 4 blocks, 9:30 start
 *
 * If a subject has a real book with a `nextPageSpan`, that book's pages
 * appear in the block's description ("Spectrum Math 5 p.142–143").
 */
import { listBooks, nextPageSpanForBook } from "../db";

export type BuilderBlock = {
  title: string;
  description: string;
  slug?: string;
  type: string;
  minutes: number;
};

type BookHint = {
  id: number;
  title: string;
  subjectSlug: string | null;
  type: string;
  nextSpan: { from: number; to: number } | null;
};

async function loadBookHints(): Promise<BookHint[]> {
  let rows: any[] = [];
  try { rows = await listBooks(); } catch { return []; }
  const out: BookHint[] = [];
  for (const b of rows) {
    if (b.status === "shelved" || b.status === "done") continue;
    let nextSpan: { from: number; to: number } | null = null;
    if (b.type === "workbook" || b.type === "reference") {
      try { nextSpan = await nextPageSpanForBook(b.id, b.defaultDailyPageSpan || 2); }
      catch { nextSpan = null; }
    }
    out.push({
      id: b.id,
      title: String(b.title || ""),
      subjectSlug: b.subjectSlug || null,
      type: b.type || "workbook",
      nextSpan,
    });
  }
  return out;
}

function bookLine(hints: BookHint[], subjectSlug: string): string | null {
  // Prefer a workbook with a span; fall back to any matching subject.
  const direct = hints.find(h => h.subjectSlug === subjectSlug && h.nextSpan);
  if (direct && direct.nextSpan) {
    return `${direct.title} p.${direct.nextSpan.from}${direct.nextSpan.from !== direct.nextSpan.to ? `–${direct.nextSpan.to}` : ""}`;
  }
  const any = hints.find(h => h.subjectSlug === subjectSlug);
  if (any) return any.title;
  return null;
}

function readingLine(hints: BookHint[]): string | null {
  // Reading: prefer a "chapter" type book (Tuck Everlasting / Michael's World).
  const chap = hints.find(h => h.type === "chapter" || (h.subjectSlug === "ela" && h.type !== "workbook"));
  if (!chap) return null;
  if (chap.nextSpan) return `${chap.title} p.${chap.nextSpan.from}${chap.nextSpan.from !== chap.nextSpan.to ? `–${chap.nextSpan.to}` : ""}`;
  return chap.title;
}

/**
 * Build a varied template for the given weekday-of-week (0=Sun ... 6=Sat).
 * Caller is responsible for handling weekends + therapy day separately.
 */
export async function buildVariedWeekdayTemplate(dow: number): Promise<BuilderBlock[]> {
  const hints = await loadBookHints();
  const mathLine = bookLine(hints, "math");
  const elaLine = bookLine(hints, "ela");
  const sciLine = bookLine(hints, "science");
  const readLine = readingLine(hints);

  // Monday — math-led, 6 blocks
  if (dow === 1) {
    return [
      { title: "Soft start", description: "Time with the parakeets and ducklings. Just be.", slug: "animal-care", type: "morning_warmup", minutes: 20 },
      { title: "Math focus", description: mathLine ? `Today: ${mathLine}. A few problems to wake up your math brain.` : "A few problems to wake up your math brain. You've got this.", slug: "math", type: "math", minutes: 35 },
      { title: "Reading", description: readLine ? `Today: ${readLine}. One chapter, snug-in time.` : "Read a chapter, journal one thing.", slug: "ela", type: "read_aloud", minutes: 25 },
      { title: "Brain break", description: "Move, stretch, snack, sit-spot. Your call.", slug: undefined, type: "custom", minutes: 15 },
      { title: "Science adventure", description: sciLine ? `Today: ${sciLine}. Animals, creek, weather — pick your path.` : "Pick your science path.", slug: "science", type: "adventure", minutes: 30 },
      { title: "Cozy wrap-up", description: "What did today teach you? Anything to log? Or just done.", slug: undefined, type: "catch_up", minutes: 15 },
    ];
  }

  // Tuesday — ELA-led, 5 blocks
  if (dow === 2) {
    return [
      { title: "Soft start", description: "A few minutes with the ducklings before we begin.", slug: "animal-care", type: "morning_warmup", minutes: 15 },
      { title: "Language focus", description: elaLine ? `Today: ${elaLine}.` : "180 Days of Language — today's day.", slug: "ela", type: "read_aloud", minutes: 30 },
      { title: "Math practice", description: mathLine ? `Today: ${mathLine}.` : "A short math practice set.", slug: "math", type: "math", minutes: 25 },
      { title: "Choice block", description: "What you want today. Art, makeup, drawing, anything.", slug: "choice", type: "choice", minutes: 30 },
      { title: "Reading", description: readLine ? `Today: ${readLine}.` : "One chapter, snug-in time.", slug: "ela", type: "read_aloud", minutes: 25 },
    ];
  }

  // Thursday — science adventure-led, 6 blocks
  if (dow === 4) {
    return [
      { title: "Soft start", description: "Animal time.", slug: "animal-care", type: "morning_warmup", minutes: 15 },
      { title: "Math warm-up", description: mathLine ? `Today: ${mathLine}.` : "A short warm-up set.", slug: "math", type: "math", minutes: 25 },
      { title: "Big adventure", description: sciLine ? `Today: ${sciLine}. Outdoors counts double.` : "Outdoors counts double.", slug: "science", type: "adventure", minutes: 45 },
      { title: "Lunch", description: "Eat something good.", slug: undefined, type: "custom", minutes: 30 },
      { title: "Reading", description: readLine ? `Today: ${readLine}.` : "Read a chapter.", slug: "ela", type: "read_aloud", minutes: 25 },
      { title: "Wrap-up + choice", description: "Drawing, music, or a sit-spot.", slug: "choice", type: "choice", minutes: 25 },
    ];
  }

  // Friday — choice-led + wrap-up, 4 blocks
  if (dow === 5) {
    return [
      { title: "Soft start + reading", description: readLine ? `Today: ${readLine}. Curl up.` : "Read a chapter to start gentle.", slug: "ela", type: "read_aloud", minutes: 30 },
      { title: "Math finish-strong", description: mathLine ? `Today: ${mathLine}.` : "Catch-up on this week's math.", slug: "math", type: "math", minutes: 25 },
      { title: "Choice + adventure", description: sciLine ? `Today: ${sciLine}. Whatever feels best — make + observe.` : "Whatever feels best — make + observe.", slug: "choice", type: "choice", minutes: 45 },
      { title: "Week wrap-up", description: "What did this week teach you? One sentence + one coin.", slug: undefined, type: "catch_up", minutes: 15 },
    ];
  }

  // Wednesday-fallback (therapy is handled upstream; if we get here it's a
  // generic mid-week day) and any other dow defaults — light shape.
  return [
    { title: "Soft start", description: "Time with the parakeets and ducklings. Just be.", slug: "animal-care", type: "morning_warmup", minutes: 25 },
    { title: "Math warm-up", description: mathLine ? `Today: ${mathLine}.` : "A few problems to wake up your math brain.", slug: "math", type: "math", minutes: 30 },
    { title: "Choice block", description: "What you want today. Art, makeup, drawing, anything.", slug: "choice", type: "choice", minutes: 30 },
    { title: "Brain break", description: "Move, stretch, snack, sit-spot. Your call.", slug: undefined, type: "custom", minutes: 15 },
    { title: "Reading + writing", description: readLine ? `Today: ${readLine}. Voice-to-text totally fine.` : "Read a chapter, journal one thing.", slug: "ela", type: "read_aloud", minutes: 30 },
    { title: "Lunch", description: "Eat something good.", slug: undefined, type: "custom", minutes: 30 },
    { title: "Science adventure", description: sciLine ? `Today: ${sciLine}.` : "Animals, creek, weather — pick your path.", slug: "science", type: "adventure", minutes: 35 },
    { title: "Cozy wrap-up", description: "What did today teach you? Anything to log? Or just done.", slug: undefined, type: "catch_up", minutes: 15 },
  ];
}
