/**
 * Push 160 (2026-05-14) — Self-rebalance trigger helper.
 *
 * Mom's locked rules:
 *
 *   "easy and simply to understand hub so if changed need to be made
 *    in the site just do it without my approval"
 *   + "automations everywhere"
 *
 * Goal: A pure decider that watches the live day signals and answers
 * ONE question — "should we re-rebalance the timeline RIGHT NOW, or
 * leave the day alone?" — together with the kid+Grandma readable
 * reasons. Returns the typed input the existing
 * `dayTimelineRebalancer` expects, so the caller can pipe straight in.
 *
 * The helper is intentionally conservative: it never re-rebalances on
 * a single tiny signal. A trigger needs at least one of:
 *
 *   1) Start slip ≥ 10 min  (the day is starting late)
 *   2) Cumulative over-run ≥ 15 min across completed/current blocks
 *   3) Mood band = tired OR frustrated (fed by kiwiMoodTracker)
 *   4) Force flag from Mom/Grandma ("rebalance now please")
 *
 * Cooldown: it will not re-fire within 30 min of the previous
 * rebalance unless the force flag is set. This keeps the day from
 * thrashing every minute.
 */

export type MoodBand = "great" | "okay" | "tired" | "frustrated" | "unknown";

export interface DayLiveSignals {
  /** ISO timestamp "now". */
  nowISO: string;
  /** Planned wake-up / start-of-school timestamp ISO. */
  plannedStartISO: string;
  /** Actual first-block-started timestamp ISO, or null if not started yet. */
  actualStartISO: string | null;
  /**
   * Cumulative over-run minutes across blocks already done OR in-progress
   * (positive number means we're behind schedule by that many minutes).
   */
  cumulativeOverrunMin: number;
  /** Latest Kiwi mood reading. Default "unknown" if Kiwi hasn't spoken. */
  moodBand: MoodBand;
  /** ISO timestamp of the previous rebalance, or null if never. */
  lastRebalanceISO: string | null;
  /**
   * Adult force flag: when true, ignore cooldown and always trigger.
   * Wired to a "Re-plan now" button on the Today page.
   */
  forceRebalance?: boolean;
}

export interface RebalanceTriggerDecision {
  /** Final yes/no: should the caller invoke the rebalancer now? */
  shouldRebalance: boolean;
  /** Kid + Grandma readable reason ("Math ran long, shifting reading later."). */
  kidReadableReason: string;
  /** Machine-readable trigger codes for analytics. */
  triggerCodes: ReadonlyArray<
    | "late_start"
    | "over_run"
    | "mood_tired"
    | "mood_frustrated"
    | "force_button"
    | "cooldown_active"
    | "no_signal"
  >;
  /** The shape downstream `dayTimelineRebalancer` expects. */
  rebalancerInput: {
    nowISO: string;
    plannedStartISO: string;
    actualStartISO: string | null;
    cumulativeOverrunMin: number;
    moodBand: MoodBand;
  };
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

const LATE_START_THRESHOLD_MIN = 10;
const OVERRUN_THRESHOLD_MIN = 15;
const COOLDOWN_MIN = 30;

function ensureIso(label: string, v: string | null): void {
  if (v === null) return;
  if (typeof v !== "string" || !ISO_RE.test(v)) {
    throw new Error(`selfRebalanceTrigger: ${label} must be ISO-8601 (got ${JSON.stringify(v)})`);
  }
}

function diffMin(aISO: string, bISO: string): number {
  const a = Date.parse(aISO);
  const b = Date.parse(bISO);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((a - b) / 60000);
}

export function decideSelfRebalance(s: DayLiveSignals): RebalanceTriggerDecision {
  ensureIso("nowISO", s.nowISO);
  ensureIso("plannedStartISO", s.plannedStartISO);
  ensureIso("actualStartISO", s.actualStartISO);
  ensureIso("lastRebalanceISO", s.lastRebalanceISO);

  const overrunMin = Math.max(0, Math.round(s.cumulativeOverrunMin || 0));
  const lateStartMin = s.actualStartISO
    ? Math.max(0, diffMin(s.actualStartISO, s.plannedStartISO))
    : Math.max(0, diffMin(s.nowISO, s.plannedStartISO));

  const codes: RebalanceTriggerDecision["triggerCodes"][number][] = [];
  if (lateStartMin >= LATE_START_THRESHOLD_MIN) codes.push("late_start");
  if (overrunMin >= OVERRUN_THRESHOLD_MIN) codes.push("over_run");
  if (s.moodBand === "tired") codes.push("mood_tired");
  if (s.moodBand === "frustrated") codes.push("mood_frustrated");
  if (s.forceRebalance === true) codes.push("force_button");

  // Cooldown unless force button.
  if (s.lastRebalanceISO && !s.forceRebalance) {
    const since = diffMin(s.nowISO, s.lastRebalanceISO);
    if (since < COOLDOWN_MIN) {
      return {
        shouldRebalance: false,
        kidReadableReason: "We just changed the day a few minutes ago — let's see how it goes.",
        triggerCodes: ["cooldown_active"],
        rebalancerInput: buildRebalancerInput(s),
      };
    }
  }

  if (codes.length === 0) {
    return {
      shouldRebalance: false,
      kidReadableReason: "Day is on track — no changes needed.",
      triggerCodes: ["no_signal"],
      rebalancerInput: buildRebalancerInput(s),
    };
  }

  const reason = buildKidReadableReason(codes, lateStartMin, overrunMin, s.moodBand);
  return {
    shouldRebalance: true,
    kidReadableReason: reason,
    triggerCodes: codes,
    rebalancerInput: buildRebalancerInput(s),
  };
}

function buildRebalancerInput(s: DayLiveSignals) {
  return {
    nowISO: s.nowISO,
    plannedStartISO: s.plannedStartISO,
    actualStartISO: s.actualStartISO,
    cumulativeOverrunMin: Math.max(0, Math.round(s.cumulativeOverrunMin || 0)),
    moodBand: s.moodBand,
  };
}

function buildKidReadableReason(
  codes: ReadonlyArray<string>,
  lateStartMin: number,
  overrunMin: number,
  mood: MoodBand,
): string {
  if (codes.includes("force_button")) {
    return "Mom or Grandma asked to re-plan the day.";
  }
  const parts: string[] = [];
  if (codes.includes("late_start") && lateStartMin > 0) {
    parts.push(`We started ${lateStartMin} min late`);
  }
  if (codes.includes("over_run") && overrunMin > 0) {
    parts.push(`a block ran ${overrunMin} min long`);
  }
  if (codes.includes("mood_tired")) {
    parts.push("Reagan looks tired");
  }
  if (codes.includes("mood_frustrated")) {
    parts.push("Reagan is frustrated");
  }
  if (parts.length === 0) {
    return mood === "tired" || mood === "frustrated"
      ? "Re-planning the day to be gentler."
      : "Re-planning the day.";
  }
  // Capitalize first part, join with commas + "so let's re-plan."
  parts[0] = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  return parts.join(", ") + " — let's re-plan the day.";
}
