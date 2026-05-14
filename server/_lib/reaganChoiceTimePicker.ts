/**
 * Push 164 (2026-05-14) — Reagan choice-time picker.
 *
 * Mom's rule: "shipping with the dashboard site like AI editing etc."
 * Plus: "Reagan should get to pick something fun once a day, but not the
 * same thing 3 days in a row, and never something that needs Mom's car
 * when Mom isn't home."
 *
 * Goal: a pure helper that, given Reagan's typed-pool of choice-time
 * options + a recent-history list + simple context flags (mom available,
 * weather is wet, mood band), returns 3 picks she can choose from. No
 * randomness from Math.random — uses a seeded ISO-day picker so refresh
 * shows the same 3 picks for the day.
 *
 * Pure: no DB, no LLM, no clock dependency.
 */

export type ChoiceLocation = "indoor" | "outdoor" | "either";
export type ChoiceEnergy = "low" | "medium" | "high";

export interface ChoiceOption {
  id: string;
  /** Kid-readable label, e.g. "Watch a bird video" */
  label: string;
  /** Where this happens. */
  location: ChoiceLocation;
  /** How much energy it takes. */
  energy: ChoiceEnergy;
  /** Minutes typically spent. */
  durationMin: number;
  /** Free tags ("art", "screen", "outside", "calm", "build"). */
  tags?: ReadonlyArray<string>;
  /** If true, Mom must be present (e.g., baking, paint). */
  needsAdult?: boolean;
  /** If true, requires getting in the car. */
  needsCar?: boolean;
}

export interface ChoiceTimePickInput {
  schoolDayISO: string; // YYYY-MM-DD
  studentName: string;
  pool: ReadonlyArray<ChoiceOption>;
  /** IDs picked in the last 7 days, newest first. */
  recentlyPickedIds?: ReadonlyArray<string>;
  /** Number of days in a row the same id was picked. Caps at 7. */
  pickedYesterdayId?: string | null;
  pickedDayBeforeId?: string | null;
  /** Context flags driving filters. */
  weatherIsWet?: boolean;
  momIsHome?: boolean;
  carIsAvailable?: boolean;
  /** Reagan's mood band right now ("great" / "okay" / "tired" / "frustrated"). */
  moodBand?: "great" | "okay" | "tired" | "frustrated";
  /** How many minutes of choice time the schedule has. */
  availableMinutes: number;
  /** How many picks to return (1..5). Defaults to 3. */
  pickCount?: number;
}

export interface ChoiceTimePickResult {
  schoolDayISO: string;
  picks: ChoiceOption[];
  /** Plain-English headline for Reagan ("Pick what to do for the next 20 min"). */
  headline: string;
  /** Plain-English Mom-readable note about what was filtered out. */
  filteredReason: string | null;
}

function hashSeed(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function shuffleDeterministic<T>(items: ReadonlyArray<T>, seed: number): T[] {
  const arr = items.slice();
  let s = seed || 1;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr;
}

function clampInt(n: unknown, min: number, max: number, def: number): number {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.floor(n) : def;
  return Math.max(min, Math.min(max, v));
}

export function pickReaganChoiceTime(input: ChoiceTimePickInput): ChoiceTimePickResult {
  if (!input || typeof input !== "object") throw new Error("pickReaganChoiceTime: input required");
  if (typeof input.schoolDayISO !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.schoolDayISO)) {
    throw new Error("pickReaganChoiceTime: schoolDayISO must be YYYY-MM-DD");
  }
  if (!Array.isArray(input.pool)) throw new Error("pickReaganChoiceTime: pool must be an array");
  const pickCount = clampInt(input.pickCount, 1, 5, 3);
  const availableMinutes = Math.max(0, Math.floor(input.availableMinutes ?? 0));

  const filteredOutReasons: string[] = [];

  let pool = input.pool.filter((opt) => {
    if (!opt || typeof opt !== "object") return false;
    if (opt.durationMin > availableMinutes) {
      return false;
    }
    return true;
  });
  if (pool.length < input.pool.length) {
    filteredOutReasons.push(`hid options too long for ${availableMinutes} min`);
  }

  if (input.weatherIsWet) {
    const before = pool.length;
    pool = pool.filter((o) => o.location !== "outdoor");
    if (pool.length < before) filteredOutReasons.push("hid outdoor options (wet weather)");
  }
  if (input.momIsHome === false) {
    const before = pool.length;
    pool = pool.filter((o) => !o.needsAdult);
    if (pool.length < before) filteredOutReasons.push("hid options that need Mom present");
  }
  if (input.carIsAvailable === false) {
    const before = pool.length;
    pool = pool.filter((o) => !o.needsCar);
    if (pool.length < before) filteredOutReasons.push("hid options that need the car");
  }

  // Mood-aware filter: tired/frustrated → drop high-energy options.
  if (input.moodBand === "tired" || input.moodBand === "frustrated") {
    const before = pool.length;
    pool = pool.filter((o) => o.energy !== "high");
    if (pool.length < before) filteredOutReasons.push(`hid high-energy options (mood: ${input.moodBand})`);
  }

  // 3-days-in-a-row block: if Reagan picked X yesterday AND the day before,
  // remove X from today's choices.
  if (input.pickedYesterdayId && input.pickedDayBeforeId &&
      input.pickedYesterdayId === input.pickedDayBeforeId) {
    const id = input.pickedYesterdayId;
    const before = pool.length;
    pool = pool.filter((o) => o.id !== id);
    if (pool.length < before) filteredOutReasons.push("blocked the same pick 3 days in a row");
  }

  // Soft-suppress recent picks (last 5 days): rank-down rather than remove.
  const recent = new Set(input.recentlyPickedIds ?? []);
  const seed = hashSeed(`${input.schoolDayISO}|${input.studentName}|cti-pool-${pool.length}`);
  const shuffled = shuffleDeterministic(pool, seed);
  const fresh = shuffled.filter((o) => !recent.has(o.id));
  const recentTail = shuffled.filter((o) => recent.has(o.id));
  const ordered = [...fresh, ...recentTail];

  // Variety: try not to return 3 picks of the same location.
  const picks: ChoiceOption[] = [];
  for (const o of ordered) {
    if (picks.length >= pickCount) break;
    const samesLocCount = picks.filter((p) => p.location === o.location).length;
    if (samesLocCount >= 2 && picks.length >= 1 && o.location !== "either") continue;
    picks.push(o);
  }
  // Top up if variety rule starved us.
  if (picks.length < pickCount) {
    for (const o of ordered) {
      if (picks.length >= pickCount) break;
      if (!picks.find((p) => p.id === o.id)) picks.push(o);
    }
  }

  const headline = picks.length === 0
    ? `${input.studentName}, no choice-time options fit right now.`
    : `${input.studentName}, pick what to do for the next ${availableMinutes} min:`;

  const filteredReason = filteredOutReasons.length === 0
    ? null
    : `Filtered: ${filteredOutReasons.join("; ")}.`;

  return {
    schoolDayISO: input.schoolDayISO,
    picks,
    headline,
    filteredReason,
  };
}
