/**
 * Push 181 (2026-05-14, Wave-14) — Roblox reward earn-time helper.
 *
 * KID + GRANDMA RULE: kid-readable, never punitive, never timed-out.
 *  - Reagan earns Roblox minutes for completing on-curriculum work.
 *  - Earn-rate is fixed and deterministic — no surprise math, no
 *    "you lost minutes" language. Mom + Grandma can override (see
 *    Push 182's family fairness helper) but this layer just COMPUTES.
 *
 * Rules (locked with Mom):
 *  - 1 completed worksheet = 5 minutes, capped at 4 worksheets/day = 20.
 *  - 1 finished book chapter = 3 minutes, capped at 5 chapters/day = 15.
 *  - 1 outdoor block (>= 20 min) = 5 minutes, capped at 2/day = 10.
 *  - 1 mood-band "great" full day = +5 bonus, awarded once.
 *  - Daily hard cap = 45 minutes (school days), 60 minutes weekends.
 *  - Bank rolls forward unused minutes up to a 90-minute ceiling.
 *  - NEVER auto-deducted by missed work — only Mom can spend / clear.
 */

export interface RobloxEarnInput {
  isoDate: string; // YYYY-MM-DD
  isWeekend?: boolean;
  worksheetCompletedToday?: number;
  chaptersFinishedToday?: number;
  outdoorBlocksToday?: Array<{ durationMin: number }>;
  moodBandFullDay?: "great" | "okay" | "tired" | "frustrated" | null;
  greatBandBonusAlreadyAwarded?: boolean;
  bankCarriedFromYesterdayMin?: number;
}

export interface RobloxEarnLine {
  source:
    | "worksheet"
    | "chapter"
    | "outdoor"
    | "great_day_bonus"
    | "carry_in";
  earnedMin: number;
  reasonKid: string; // kid-readable
}

export interface RobloxEarnResult {
  isoDate: string;
  lines: RobloxEarnLine[];
  earnedTodayMin: number; // pre-cap subtotal (worksheet+chapter+outdoor+bonus)
  capAppliedMin: number; // post-cap day total (excludes carry-in)
  carryInMin: number;
  bankAfterMin: number; // post-cap + carry-in, capped at 90
  bankCeilingMin: 90;
  dailyCapMin: 45 | 60;
  kidLine: string; // one short, friendly sentence
  adultLine: string; // one short adult-side log line
}

const CHAPTER_PER = 3;
const WORKSHEET_PER = 5;
const OUTDOOR_PER = 5;
const GREAT_BONUS = 5;
const WORKSHEET_CAP_COUNT = 4;
const CHAPTER_CAP_COUNT = 5;
const OUTDOOR_CAP_COUNT = 2;
const OUTDOOR_MIN_DURATION = 20;
const BANK_CEILING = 90 as const;

export function computeRobloxEarn(input: RobloxEarnInput): RobloxEarnResult {
  const isWeekend = !!input.isWeekend;
  const dailyCapMin: 45 | 60 = isWeekend ? 60 : 45;

  const lines: RobloxEarnLine[] = [];

  const wsCount = Math.max(0, Math.min(
    WORKSHEET_CAP_COUNT,
    input.worksheetCompletedToday ?? 0,
  ));
  if (wsCount > 0) {
    lines.push({
      source: "worksheet",
      earnedMin: wsCount * WORKSHEET_PER,
      reasonKid: `${wsCount} worksheet${wsCount === 1 ? "" : "s"} done`,
    });
  }

  const chCount = Math.max(0, Math.min(
    CHAPTER_CAP_COUNT,
    input.chaptersFinishedToday ?? 0,
  ));
  if (chCount > 0) {
    lines.push({
      source: "chapter",
      earnedMin: chCount * CHAPTER_PER,
      reasonKid: `${chCount} chapter${chCount === 1 ? "" : "s"} read`,
    });
  }

  const outBlocks = (input.outdoorBlocksToday ?? []).filter(
    (b) => b.durationMin >= OUTDOOR_MIN_DURATION,
  );
  const outCount = Math.min(OUTDOOR_CAP_COUNT, outBlocks.length);
  if (outCount > 0) {
    lines.push({
      source: "outdoor",
      earnedMin: outCount * OUTDOOR_PER,
      reasonKid: `${outCount} outdoor block${outCount === 1 ? "" : "s"}`,
    });
  }

  if (
    input.moodBandFullDay === "great" &&
    !input.greatBandBonusAlreadyAwarded
  ) {
    lines.push({
      source: "great_day_bonus",
      earnedMin: GREAT_BONUS,
      reasonKid: "great mood all day",
    });
  }

  const earnedTodayMin = lines.reduce((s, l) => s + l.earnedMin, 0);
  const capAppliedMin = Math.min(dailyCapMin, earnedTodayMin);

  const carryInMin = Math.max(0, input.bankCarriedFromYesterdayMin ?? 0);
  if (carryInMin > 0) {
    lines.unshift({
      source: "carry_in",
      earnedMin: carryInMin,
      reasonKid: "minutes from yesterday",
    });
  }

  const bankAfterMin = Math.min(BANK_CEILING, capAppliedMin + carryInMin);

  const totalToday = capAppliedMin;
  let kidLine: string;
  if (totalToday <= 0 && carryInMin <= 0) {
    kidLine = "No Roblox minutes earned yet today.";
  } else if (totalToday <= 0) {
    kidLine = `${bankAfterMin} Roblox minutes saved up.`;
  } else {
    kidLine = `You earned ${totalToday} Roblox minutes today.`;
  }
  const adultLine =
    `Roblox earn ${input.isoDate}: today ${capAppliedMin}m (cap ${dailyCapMin}m) + carry ${carryInMin}m -> bank ${bankAfterMin}m (ceiling ${BANK_CEILING}m).`;

  return {
    isoDate: input.isoDate,
    lines,
    earnedTodayMin,
    capAppliedMin,
    carryInMin,
    bankAfterMin,
    bankCeilingMin: BANK_CEILING,
    dailyCapMin,
    kidLine,
    adultLine,
  };
}
