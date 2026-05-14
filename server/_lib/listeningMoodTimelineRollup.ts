/**
 * Push 173 (2026-05-15 Wave-11) — Listening-summary mood-timeline rollup.
 *
 * COMPLEMENTS (does not replace) the existing `moodTimelineStrip.ts`,
 * which renders the green/yellow/red ZONE strip from manual moodLogs.
 * This file is for the **richer** kid-mood timeline driven by Kiwi's
 * `listeningSummaries` rows: per-hour dominantMood + behavior-tag
 * frequencies + chunk count, suitable for the Reagan-readable expanded
 * mood card on the Today page.
 *
 * STRICT RULES (enforced by vitest):
 *   - Hours with 0 chunks are EMITTED but flagged `empty: true` so the
 *     UI can hide them (no grey-box placeholder).
 *   - moodEstimate values outside the kid-safe enum are DROPPED silently
 *     (do not crash on stray rows).
 *   - Reagan-only filter: chunks where `reaganVoicePresent === false` are
 *     EXCLUDED from the rollup (room noise / adult-only chatter / TV
 *     does not contribute to her mood timeline).
 *   - Output is always 24 hours long.
 *   - Deterministic — same input ⇒ same output.
 *   - Kid line is Reagan-readable: "you" only, never adult names, never
 *     clinical words.
 */

export type Mood =
  | "calm"
  | "engaged"
  | "frustrated"
  | "tired"
  | "silly"
  | "upset"
  | "excited";

const KID_SAFE_MOODS: Mood[] = [
  "calm",
  "engaged",
  "frustrated",
  "tired",
  "silly",
  "upset",
  "excited",
];

export interface ListeningChunk {
  /** ISO timestamp of the chunk midpoint. */
  atISO: string;
  reaganVoicePresent: boolean;
  moodEstimate: Mood | string;
  behaviorTags: string[];
}

export interface MoodHourCell {
  hour: number; // 0..23
  empty: boolean;
  chunkCount: number;
  dominantMood: Mood | null;
  topBehaviorTags: string[]; // up to 3, in dominance order
  /** Kid-readable one-liner; null when empty. */
  kidLine: string | null;
}

export interface MoodTimelineRollupInput {
  dateISO: string; // 'YYYY-MM-DD'
  chunks: ListeningChunk[];
}

const MOOD_LINES: Record<Mood, string> = {
  calm: "You were calm.",
  engaged: "You were really into it.",
  frustrated: "It was a little tricky.",
  tired: "You were tired.",
  silly: "You were having fun.",
  upset: "It was a hard moment.",
  excited: "You were excited.",
};

export function rollupListeningMoodTimeline(
  input: MoodTimelineRollupInput,
): MoodHourCell[] {
  const buckets: Map<number, ListeningChunk[]> = new Map();
  for (let h = 0; h < 24; h++) buckets.set(h, []);

  for (const c of input.chunks) {
    if (!c.reaganVoicePresent) continue;
    if (!isKidSafeMood(c.moodEstimate)) continue;
    const d = new Date(c.atISO);
    if (Number.isNaN(d.getTime())) continue;
    if (
      input.dateISO &&
      d.toISOString().slice(0, 10) !== input.dateISO
    )
      continue;
    const h = d.getUTCHours();
    buckets.get(h)!.push(c);
  }

  const cells: MoodHourCell[] = [];
  for (let h = 0; h < 24; h++) {
    const chunks = buckets.get(h)!;
    if (chunks.length === 0) {
      cells.push({
        hour: h,
        empty: true,
        chunkCount: 0,
        dominantMood: null,
        topBehaviorTags: [],
        kidLine: null,
      });
      continue;
    }
    const moodCounts = new Map<Mood, number>();
    for (const c of chunks) {
      const m = c.moodEstimate as Mood;
      moodCounts.set(m, (moodCounts.get(m) ?? 0) + 1);
    }
    const dominantMood = pickDominant(moodCounts);

    const tagCounts = new Map<string, { count: number; lastIdx: number }>();
    chunks.forEach((c, idx) => {
      for (const t of c.behaviorTags ?? []) {
        const prev = tagCounts.get(t);
        if (prev) {
          prev.count += 1;
          prev.lastIdx = idx;
        } else {
          tagCounts.set(t, { count: 1, lastIdx: idx });
        }
      }
    });
    const topBehaviorTags = Array.from(tagCounts.entries())
      .sort(
        (a, b) => b[1].count - a[1].count || b[1].lastIdx - a[1].lastIdx,
      )
      .slice(0, 3)
      .map(([t]) => t);

    cells.push({
      hour: h,
      empty: false,
      chunkCount: chunks.length,
      dominantMood,
      topBehaviorTags,
      kidLine: dominantMood ? MOOD_LINES[dominantMood] : null,
    });
  }
  return cells;
}

function isKidSafeMood(m: string | Mood): m is Mood {
  return (KID_SAFE_MOODS as string[]).includes(m as string);
}

function pickDominant(counts: Map<Mood, number>): Mood | null {
  let best: Mood | null = null;
  let bestCount = 0;
  for (const m of KID_SAFE_MOODS) {
    const c = counts.get(m) ?? 0;
    if (c > bestCount) {
      best = m;
      bestCount = c;
    }
  }
  return best;
}
