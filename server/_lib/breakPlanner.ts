/**
 * Push 170 (2026-05-15 overnight Wave-10) — Break planner helper.
 *
 * Mom's rule: when Reagan needs a recharge, suggest a tiny break —
 * never timed, never "you have 5 minutes." Pure helper picks one
 * suggestion deterministically per ISO+name from a typed pool,
 * weighted by mood, weather, and time-of-day. Adult can hard-veto
 * outdoor (rain, dark, hot, cold, no-adult).
 *
 * Pure helper: no DB, no LLM, no clock dependency.
 *
 *   pickReaganBreak(input) -> { suggestion, kidLine, candidatePool }
 */

export type BreakKind =
  | "outdoor"
  | "art"
  | "snack"
  | "stretch"
  | "music"
  | "petting"
  | "water"
  | "free-play";

export type MoodBand = "great" | "okay" | "tired" | "frustrated";
export type WeatherBand = "sunny-cool" | "sunny-warm" | "cloudy" | "rainy" | "cold" | "hot" | "unknown";

export interface ReaganBreakInput {
  iso: string; // YYYY-MM-DD (deterministic per day)
  name: string; // "Reagan"
  mood: MoodBand;
  weather: WeatherBand;
  hourOfDay: number; // 0..23
  adultPresent: boolean;
  recentBreakKinds?: BreakKind[]; // last few to avoid repeating
  pets?: ("dog" | "cat" | "bird")[];
  /** Hard veto from Mom: never suggest these today. */
  vetoKinds?: BreakKind[];
}

export interface BreakSuggestion {
  kind: BreakKind;
  title: string;
  kidLine: string;
  reason: string;
  outdoor: boolean;
}

export interface ReaganBreakResult {
  iso: string;
  suggestion: BreakSuggestion | null;
  candidatePool: BreakKind[];
  /** Why this kind was picked vs others (debug / adult log). */
  pickReason: string;
}

const POOL: Record<BreakKind, { title: string; kidLine: string; outdoor: boolean }> = {
  outdoor: { title: "Quick outdoor minute", kidLine: "Step outside and look up — what do you see?", outdoor: true },
  art: { title: "Tiny art moment", kidLine: "Doodle one thing that's making you happy.", outdoor: false },
  snack: { title: "Snack + water", kidLine: "Grab a snack and a sip of water.", outdoor: false },
  stretch: { title: "Big stretch", kidLine: "Reach up like you're picking apples, then twist side to side.", outdoor: false },
  music: { title: "One song dance", kidLine: "Pick one song and just move.", outdoor: false },
  petting: { title: "Pet check-in", kidLine: "Go give a pet some love.", outdoor: false },
  water: { title: "Water reset", kidLine: "Splash some cool water on your hands and face.", outdoor: false },
  "free-play": { title: "Free play moment", kidLine: "Play whatever you want — anything goes.", outdoor: false },
};

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

function isWeatherOutdoorOK(w: WeatherBand): boolean {
  return w === "sunny-cool" || w === "sunny-warm" || w === "cloudy" || w === "unknown";
}

export function pickReaganBreak(input: ReaganBreakInput): ReaganBreakResult {
  if (!input || typeof input !== "object") throw new Error("pickReaganBreak: input required");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.iso)) throw new Error("pickReaganBreak: iso must be YYYY-MM-DD");
  if (!input.name) throw new Error("pickReaganBreak: name required");
  if (typeof input.hourOfDay !== "number" || input.hourOfDay < 0 || input.hourOfDay > 23) {
    throw new Error("pickReaganBreak: hourOfDay must be 0..23");
  }

  const veto = new Set<BreakKind>(input.vetoKinds ?? []);
  const recent = new Set<BreakKind>(input.recentBreakKinds ?? []);
  const pets = input.pets ?? [];

  // Build pool — start with all kinds, drop hard-vetoed and infeasible.
  const candidates: BreakKind[] = [];
  for (const kind of Object.keys(POOL) as BreakKind[]) {
    if (veto.has(kind)) continue;
    if (kind === "outdoor") {
      if (!input.adultPresent) continue;
      if (!isWeatherOutdoorOK(input.weather)) continue;
      if (input.hourOfDay < 7 || input.hourOfDay > 19) continue;
    }
    if (kind === "petting" && pets.length === 0) continue;
    candidates.push(kind);
  }

  if (candidates.length === 0) {
    return {
      iso: input.iso,
      suggestion: null,
      candidatePool: [],
      pickReason: "No safe options after applying vetoes/weather/adult-presence.",
    };
  }

  // Mood weighting: tired → snack/water/stretch; frustrated → music/art/outdoor;
  // great → outdoor/free-play/music; okay → broad.
  const moodWeights: Record<MoodBand, Partial<Record<BreakKind, number>>> = {
    great: { outdoor: 3, "free-play": 3, music: 2, art: 2 },
    okay: { stretch: 2, art: 2, snack: 2, outdoor: 2, music: 2 },
    tired: { snack: 3, water: 3, stretch: 2, petting: 2 },
    frustrated: { music: 3, art: 3, outdoor: 3, petting: 2, water: 2 },
  };
  const weights: Record<BreakKind, number> = {
    outdoor: 1, art: 1, snack: 1, stretch: 1, music: 1, petting: 1, water: 1, "free-play": 1,
  };
  const moodMap = moodWeights[input.mood] ?? {};
  for (const k of Object.keys(moodMap) as BreakKind[]) {
    weights[k] += moodMap[k]!;
  }
  // Avoid recent kinds.
  Array.from(recent).forEach((k: BreakKind) => {
    weights[k] = Math.max(0, weights[k] - 4);
  });

  // Deterministic pick.
  const ordered = candidates.slice().sort((a, b) => {
    const wd = weights[b] - weights[a];
    if (wd !== 0) return wd;
    return a.localeCompare(b);
  });
  const topWeight = weights[ordered[0]];
  const top = ordered.filter((k) => weights[k] === topWeight);
  const seed = `${input.iso}|${input.name}|${input.mood}|${input.weather}|${input.hourOfDay}`;
  const idx = hash(seed) % Math.max(1, top.length);
  const pick = top[idx];

  const meta = POOL[pick];
  const sug: BreakSuggestion = {
    kind: pick,
    title: meta.title,
    kidLine: meta.kidLine,
    reason: `mood=${input.mood}, weather=${input.weather}, weight=${topWeight}`,
    outdoor: meta.outdoor,
  };
  return {
    iso: input.iso,
    suggestion: sug,
    candidatePool: candidates,
    pickReason: `Picked ${pick} from ${top.length} top-weight (=${topWeight}) candidates.`,
  };
}
