/**
 * Overnight push 2026-05-14 — Kiwi mood / behavior tracker (pure helper).
 *
 * Mom asked for "auto Reagan's mood and behavior from kiwi etc, all
 * automated". Kiwi already collects two signal streams every block:
 *   - mic activity: idle / quiet-talk / loud-or-distressed
 *   - on-task activity: page-flip events, app-tool usage, blank periods
 *
 * This helper turns those streams into a single mood band + a one-sentence
 * suggested adjustment (kid + Grandma readable). The output drives:
 *   - Today page mood chip (green / yellow / red)
 *   - Self-rebalancing day timeline (low mood => shorter next block)
 *   - Nightly email "how the day felt" line
 *
 * Pure: no DB, no IO, deterministic.
 */

export type MoodBand = "great" | "okay" | "tired" | "frustrated";

export interface KiwiBlockSignals {
  blockSortOrder: number;
  blockTitle: string;
  subjectName?: string | null;
  /** 0..1 fraction of block time mic registered focused work (quiet typing,
   *  reading aloud, calm talk). Higher is better. */
  micFocusFraction: number;
  /** 0..1 fraction of block time mic registered loud / distressed signals. */
  micDistressFraction: number;
  /** Number of distinct on-task events (page flips, app launches, submits). */
  onTaskEvents: number;
  /** Minutes the block was scheduled for. */
  scheduledMinutes: number;
  /** Minutes the block has actually been running (>= 0). */
  elapsedMinutes: number;
  /** True if Reagan tagged the block as "really_hard" or "tricky" on submit. */
  kidFlaggedHard?: boolean;
}

export interface KiwiMoodReading {
  band: MoodBand;
  /** Big number 0..100 for the chip. */
  score: number;
  /** Plain-English headline for the chip ("Reagan looks focused"). */
  headline: string;
  /** Plain-English suggestion for Mom + Kiwi to act on; never empty. */
  suggestion: string;
  /**
   * Suggested adjustment (consumed by self-rebalancing helper):
   *   - none: keep going
   *   - shorten_next: cut next block by 25%
   *   - swap_to_movement: insert a 5-min stretch / outdoor block
   *   - end_block_now: wrap current block early
   */
  suggestedAdjustment: "none" | "shorten_next" | "swap_to_movement" | "end_block_now";
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function readKiwiMoodForBlock(s: KiwiBlockSignals): KiwiMoodReading {
  const focus = clamp01(s.micFocusFraction);
  const distress = clamp01(s.micDistressFraction);
  const elapsedRatio =
    s.scheduledMinutes > 0
      ? Math.max(0, s.elapsedMinutes) / s.scheduledMinutes
      : 0;
  const eventsPerMin = s.elapsedMinutes > 0 ? s.onTaskEvents / s.elapsedMinutes : 0;

  // Base score: weighted blend of focus, distress (inverted), events.
  let score =
    focus * 60 +
    (1 - distress) * 25 +
    Math.min(1, eventsPerMin / 1.5) * 15;
  // If she's still in the first 25% of the block we trust signals less.
  if (elapsedRatio < 0.25) score = Math.max(score, 60);
  // Frustration penalty: distress + kid-flagged-hard compound.
  if (distress >= 0.4) score -= 20;
  if (s.kidFlaggedHard) score -= 15;
  // Long over-run penalty (block running > 1.5x scheduled).
  if (elapsedRatio > 1.5) score -= 10;
  score = Math.max(0, Math.min(100, Math.round(score)));

  // Band assignment.
  let band: MoodBand;
  if (distress >= 0.5 || score < 40) band = "frustrated";
  else if (score < 60) band = "tired";
  else if (score < 80) band = "okay";
  else band = "great";

  // Headline (kid + Grandma readable).
  const subj = s.subjectName ? ` in ${s.subjectName}` : "";
  let headline: string;
  switch (band) {
    case "great":
      headline = `Reagan looks focused${subj}.`;
      break;
    case "okay":
      headline = `Reagan is working${subj}.`;
      break;
    case "tired":
      headline = `Reagan is slowing down${subj}.`;
      break;
    case "frustrated":
      headline = `Reagan sounds frustrated${subj}.`;
      break;
  }

  // Suggested adjustment + matching suggestion sentence.
  let suggestedAdjustment: KiwiMoodReading["suggestedAdjustment"];
  let suggestion: string;
  if (band === "frustrated") {
    if (elapsedRatio >= 0.5) {
      suggestedAdjustment = "end_block_now";
      suggestion = "Wrap this one up and move on — she's done enough here.";
    } else {
      suggestedAdjustment = "swap_to_movement";
      suggestion = "Try a 5-minute stretch or walk before going back to it.";
    }
  } else if (band === "tired") {
    suggestedAdjustment = "shorten_next";
    suggestion = "Make the next block a little shorter so she can rest sooner.";
  } else if (band === "okay") {
    suggestedAdjustment = "none";
    suggestion = "Keep the day as planned — she's settling into a rhythm.";
  } else {
    suggestedAdjustment = "none";
    suggestion = "Let her keep going — she's in a good groove.";
  }

  return { band, score, headline, suggestion, suggestedAdjustment };
}

/**
 * Roll several block readings into a single day-level mood for the Today
 * page header chip + nightly email "how the day felt" line.
 */
export interface KiwiDayMood {
  band: MoodBand;
  score: number;
  headline: string;
  suggestion: string;
}

export function rollUpDayMood(readings: KiwiMoodReading[]): KiwiDayMood {
  if (readings.length === 0) {
    return {
      band: "okay",
      score: 60,
      headline: "No mood signals yet today.",
      suggestion: "Kiwi will start watching once the first block begins.",
    };
  }
  const avg = Math.round(
    readings.reduce((s, r) => s + r.score, 0) / readings.length,
  );
  let band: MoodBand;
  if (avg < 40) band = "frustrated";
  else if (avg < 60) band = "tired";
  else if (avg < 80) band = "okay";
  else band = "great";

  // Pull the most recent block's headline + suggestion so it stays current.
  const latest = readings[readings.length - 1];
  const headlineMap: Record<MoodBand, string> = {
    great: "Reagan is having a focused day.",
    okay: "Reagan is having a steady day.",
    tired: "Reagan is running out of steam.",
    frustrated: "Reagan is having a hard day — go gentle.",
  };
  return {
    band,
    score: avg,
    headline: headlineMap[band],
    suggestion: latest.suggestion,
  };
}
