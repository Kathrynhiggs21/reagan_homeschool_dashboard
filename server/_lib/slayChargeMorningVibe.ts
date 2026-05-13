/**
 * Push 118 (2026-05-13) — Slay Charge ⚡ morning-vibe block.
 *
 * Replaces the old "Soft start / Morning Warmup" block. The new product
 * intent (per Reagan's mom, 2026-05-13):
 *   - Title: "Slay Charge ⚡"
 *   - Tween-sarcastic, slow-becoming-slay energy
 *   - 5-minute daily mood-setter, NOT an academic assignment
 *   - Daily pick from a tiny curated pool (free, no AI cost):
 *       70% kid-safe joke, 30% short funny/view clip
 *   - "🔄 give me another" → re-picks deterministically from the same pool
 *   - Never appears on assignments checklist
 *   - Never appears on Analytics → Recent Submissions
 *   - Never counts toward curriculum coverage
 *
 * Internal block-type rename: morning_warmup → morning_vibe.
 * Legacy "morning_warmup" type is still recognized as the same kind of
 * block so old rows keep working without a destructive DB migration.
 *
 * Pure module — no DB, no I/O.
 */

export const SLAY_CHARGE_TITLE = "Slay Charge ⚡";
export const SLAY_CHARGE_TYPE = "morning_vibe" as const;
export const SLAY_CHARGE_LEGACY_TYPE = "morning_warmup" as const;
export const SLAY_CHARGE_DEFAULT_MINUTES = 5;

export type MorningVibeBlockType = "morning_vibe" | "morning_warmup";

/**
 * The single source of truth for "is this block the daily Slay Charge
 * morning-vibe block?" Used by Recent Submissions, the assignments
 * checklist, the coverage strip, and any other surface that needs to
 * skip this block.
 */
export function isMorningVibeBlock(input: {
  type?: string | null;
  blockType?: string | null;
  title?: string | null;
}): boolean {
  const t = String(input?.type ?? input?.blockType ?? "").toLowerCase();
  if (t === "morning_vibe" || t === "morning_warmup") return true;
  const title = String(input?.title ?? "").trim().toLowerCase();
  if (title === SLAY_CHARGE_TITLE.toLowerCase()) return true;
  // Legacy seed titles we want to retire — still treated as morning-vibe.
  if (title === "soft start" || title === "slow morning") return true;
  return false;
}

export type SlayChargePickKind = "joke" | "clip";

export interface SlayChargePoolItem {
  id: string;
  kind: SlayChargePickKind;
  text: string;
  /** Optional URL — only present for clips. */
  url?: string;
}

/**
 * Curated pool — kid-safe (5th grade), tween-coded, sarcastic-but-warm.
 * Free of charge, no API call. Adults can edit/extend later via Settings.
 */
export const SLAY_CHARGE_POOL: ReadonlyArray<SlayChargePoolItem> = [
  // ---- Jokes (70%-ish of weight) -------------------------------------
  { id: "j1", kind: "joke", text: "Why did the math book look sad? It had too many problems." },
  { id: "j2", kind: "joke", text: "What do you call a fake noodle? An im-pasta." },
  { id: "j3", kind: "joke", text: "Why don't scientists trust atoms? Because they make up everything." },
  { id: "j4", kind: "joke", text: "What did the zero say to the eight? Nice belt." },
  { id: "j5", kind: "joke", text: "Why was 6 afraid of 7? Because 7 8 9. (Iconic.)" },
  { id: "j6", kind: "joke", text: "What's a duck's favorite snack? Cheese and quackers." },
  { id: "j7", kind: "joke", text: "Why did the bicycle fall over? It was two-tired." },
  { id: "j8", kind: "joke", text: "How do you organize a space party? You planet." },
  { id: "j9", kind: "joke", text: "Why did the cookie cry? Because its mom was a wafer so long." },
  { id: "j10", kind: "joke", text: "What do you call cheese that isn't yours? Nacho cheese." },
  { id: "j11", kind: "joke", text: "Why are fish so smart? Because they live in schools." },
  { id: "j12", kind: "joke", text: "What's brown and sticky? A stick. (Sorry.)" },
  { id: "j13", kind: "joke", text: "Why did the scarecrow win an award? He was outstanding in his field." },
  { id: "j14", kind: "joke", text: "Did you hear about the kidnapping at school? It's fine — they woke up." },
  { id: "j15", kind: "joke", text: "Why did the picture go to jail? It was framed." },
  { id: "j16", kind: "joke", text: "What do you call a sleeping bull? A bulldozer." },
  { id: "j17", kind: "joke", text: "Why don't eggs tell jokes? They'd crack each other up." },
  { id: "j18", kind: "joke", text: "What kind of music do mummies like? Wrap." },
  { id: "j19", kind: "joke", text: "Why did the student eat his homework? The teacher said it was a piece of cake." },
  { id: "j20", kind: "joke", text: "How do you make a tissue dance? Put a little boogie in it." },
  { id: "j21", kind: "joke", text: "Why do birds fly south for the winter? Because it's too far to walk." },
  { id: "j22", kind: "joke", text: "What did one wall say to the other? Meet you at the corner." },
  { id: "j23", kind: "joke", text: "Why was the math book so popular? It had problems everyone could relate to." },
  { id: "j24", kind: "joke", text: "What do you call a dinosaur that crashes his car? Tyrannosaurus wrecks." },
  { id: "j25", kind: "joke", text: "Why did the banana go to the doctor? It wasn't peeling well." },
  { id: "j26", kind: "joke", text: "What do you get when you cross a snowman and a vampire? Frostbite." },
  { id: "j27", kind: "joke", text: "Why don't skeletons fight? They don't have the guts." },
  { id: "j28", kind: "joke", text: "What did the buffalo say to his son? Bye, son." },
  // ---- Clips / view things (30%-ish of weight) -----------------------
  // URLs are placeholders — adults curate later. We keep them in the
  // pool so the picker has variety from day one.
  { id: "c1", kind: "clip", text: "Tiny duckling on a slide (15s).", url: "https://youtube.com/watch?v=duckling-slide" },
  { id: "c2", kind: "clip", text: "Parakeet learns to high-five (30s).", url: "https://youtube.com/watch?v=parakeet-high-five" },
  { id: "c3", kind: "clip", text: "Dog tries to share its toy (12s).", url: "https://youtube.com/watch?v=dog-share-toy" },
  { id: "c4", kind: "clip", text: "Otter pup learning to swim (45s).", url: "https://youtube.com/watch?v=otter-pup-swim" },
  { id: "c5", kind: "clip", text: "Goat in pajamas (10s).", url: "https://youtube.com/watch?v=goat-pajamas" },
  { id: "c6", kind: "clip", text: "Cat vs. cucumber (be nice, cats) (8s).", url: "https://youtube.com/watch?v=cat-cucumber" },
  { id: "c7", kind: "clip", text: "Hamster on a tiny treadmill (20s).", url: "https://youtube.com/watch?v=hamster-treadmill" },
  { id: "c8", kind: "clip", text: "Penguin slides on belly down a hill (15s).", url: "https://youtube.com/watch?v=penguin-slide" },
  { id: "c9", kind: "clip", text: "Owl head-bobs to a beat (12s).", url: "https://youtube.com/watch?v=owl-headbob" },
  { id: "c10", kind: "clip", text: "Capybara with friends in a hot spring (40s).", url: "https://youtube.com/watch?v=capybara-spring" },
  { id: "c11", kind: "clip", text: "Bunny dramatically falls asleep (8s).", url: "https://youtube.com/watch?v=bunny-asleep" },
  { id: "c12", kind: "clip", text: "Fox doing the zoomies in snow (18s).", url: "https://youtube.com/watch?v=fox-zoomies" },
];

/**
 * Deterministic daily hash — same dateIso + offset → same pick.
 * djb2 keeps it dependency-free and stable across runs.
 */
function hashCode(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h * 33) ^ input.charCodeAt(i)) >>> 0;
  }
  return h >>> 0;
}

export interface PickInput {
  /** YYYY-MM-DD in the family timezone. */
  dateIso: string;
  /** How many "give me another" taps have been used today (0 = first pick). */
  rerollIndex?: number;
}

export interface PickResult {
  ok: true;
  item: SlayChargePoolItem;
  /** Total pool size (informational — used by the UI for "1 of N"). */
  poolSize: number;
}

export interface PickRejected {
  ok: false;
  rejectReason: "missing-date" | "bad-date" | "empty-pool";
}

export function pickSlayChargeForDay(input: PickInput): PickResult | PickRejected {
  const date = typeof input?.dateIso === "string" ? input.dateIso.trim() : "";
  if (date.length === 0) {
    return { ok: false, rejectReason: "missing-date" };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, rejectReason: "bad-date" };
  }
  if (SLAY_CHARGE_POOL.length === 0) {
    return { ok: false, rejectReason: "empty-pool" };
  }
  const reroll =
    Number.isFinite(input?.rerollIndex) && (input!.rerollIndex as number) > 0
      ? Math.floor(input!.rerollIndex as number)
      : 0;
  // Combine date + reroll into a deterministic offset.
  const h = hashCode(`${date}|${reroll}`);
  const idx = h % SLAY_CHARGE_POOL.length;
  return {
    ok: true,
    item: SLAY_CHARGE_POOL[idx],
    poolSize: SLAY_CHARGE_POOL.length,
  };
}

/**
 * Drop morning-vibe rows from a submissions list. Used by the Recent
 * Submissions rail and any assignments-checklist consumer. Pure.
 */
export function dropMorningVibeRows<
  T extends {
    blockType?: string | null;
    type?: string | null;
    title?: string | null;
    blockTitle?: string | null;
  },
>(rows: ReadonlyArray<T>): T[] {
  if (!Array.isArray(rows)) return [];
  return rows.filter(
    (r) =>
      !isMorningVibeBlock({
        type: r?.blockType ?? r?.type ?? null,
        title: r?.title ?? r?.blockTitle ?? null,
      }),
  );
}
