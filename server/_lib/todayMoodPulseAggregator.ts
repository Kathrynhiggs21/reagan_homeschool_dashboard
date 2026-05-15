/**
 * Wave-15 / Push 203 — todayMoodPulseAggregator
 * PURE deterministic helper. Aggregates a day's mood-pulse samples
 * into one kid-readable summary + an adult-only gentle-check-in flag.
 */

export type Mood = "happy" | "calm" | "focused" | "tired" | "frustrated" | "sad";

export interface MoodSample {
  mood: Mood;
  isoTimestamp: string;
}

export interface MoodPulseSummary {
  count: number;
  dominant: Mood | null;
  latest: Mood | null;
  kidHeadline: string;
  adultGentleCheckIn: boolean;
  adultNote: string;
}

const POSITIVE: Mood[] = ["happy", "calm", "focused"];
const LOW: Mood[] = ["tired", "frustrated", "sad"];

const KID_LINES: Record<Mood, string> = {
  happy:      "Good vibes today. Keep going.",
  calm:       "Steady and calm. That's a strong place.",
  focused:    "Locked in today. Nice.",
  tired:      "A slower day. That's okay too.",
  frustrated: "Some bumps today. That happens.",
  sad:        "A heavy day. We've got you.",
};

function compareIso(a: string, b: string): number {
  if (a === b) return 0;
  const aT = Date.parse(a);
  const bT = Date.parse(b);
  if (Number.isNaN(aT) || Number.isNaN(bT)) return a < b ? -1 : 1;
  return aT - bT;
}

function lastIndexOf(arr: ReadonlyArray<MoodSample>, mood: Mood): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i].mood === mood) return i;
  }
  return -1;
}

export function aggregateMoodPulses(
  samples: ReadonlyArray<MoodSample>,
): MoodPulseSummary {
  if (!samples || samples.length === 0) {
    return {
      count: 0,
      dominant: null,
      latest: null,
      kidHeadline: "No vibe checks yet today. That's fine — tap when you want.",
      adultGentleCheckIn: false,
      adultNote: "",
    };
  }

  const sorted = [...samples].sort((a, b) =>
    compareIso(a.isoTimestamp, b.isoTimestamp),
  );

  const counts = new Map<Mood, number>();
  for (const s of sorted) counts.set(s.mood, (counts.get(s.mood) ?? 0) + 1);

  let dominant: Mood | null = null;
  let bestCount = -1;
  for (const m of Array.from(counts.keys()).sort()) {
    const c = counts.get(m)!;
    if (c > bestCount) {
      bestCount = c;
      dominant = m;
    } else if (c === bestCount) {
      const lastA = lastIndexOf(sorted, dominant!);
      const lastB = lastIndexOf(sorted, m);
      if (lastB > lastA) dominant = m;
    }
  }

  const latest = sorted[sorted.length - 1].mood;
  const kidHeadline = KID_LINES[latest];

  const last4 = sorted.slice(-4);
  const lowInLast4 = new Map<Mood, number>();
  for (const s of last4) {
    if (LOW.includes(s.mood)) {
      lowInLast4.set(s.mood, (lowInLast4.get(s.mood) ?? 0) + 1);
    }
  }
  let flagged: Mood | null = null;
  for (const [m, c] of Array.from(lowInLast4.entries())) {
    if (c >= 2) {
      flagged = m;
      break;
    }
  }

  return {
    count: sorted.length,
    dominant,
    latest,
    kidHeadline,
    adultGentleCheckIn: flagged !== null,
    adultNote: flagged
      ? `Reagan's pulse showed "${flagged}" twice in the last 4 taps. A soft check-in might help.`
      : "",
  };
}

export const __FOR_TEST__ = { POSITIVE, LOW, KID_LINES };
