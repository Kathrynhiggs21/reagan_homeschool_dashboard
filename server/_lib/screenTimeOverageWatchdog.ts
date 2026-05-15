/**
 * Wave-15 / Push 197 — screenTimeOverageWatchdog
 *
 * PURE deterministic helper. Watches today's screen-time vs the
 * active per-day cap. Never blocks Reagan, never punitive.
 *
 * Tiers fire AT MOST once per local YYYY-MM-DD per tier.
 * Always-allowed minutes (reading, coding, art) NEVER count.
 */

export interface AppMinutesSample {
  appKey: string;
  appName: string;
  minutes: number;
}

export type OverageTier = "cap_reached" | "plus_30" | "plus_60";

export interface OverageNotifyHistoryEntry {
  isoDate: string;
  tier: OverageTier;
}

export interface WatchdogInput {
  todaySamples: AppMinutesSample[];
  capMinutes: number;
  alwaysAllowedAppKeys: string[];
  isoDateLocal: string;
  history: OverageNotifyHistoryEntry[];
}

export interface WatchdogDecision {
  shouldNotify: boolean;
  tier: OverageTier | null;
  countedMinutes: number;
  capMinutes: number;
  kidHeadline: string | null;
  adultHeadline: string | null;
  notifyPayload: {
    category: "screen_time_overage";
    title: string;
    content: string;
  } | null;
  suppressedReason: string | null;
}

function tierForMinutes(counted: number, cap: number): OverageTier | null {
  if (counted >= cap + 60) return "plus_60";
  if (counted >= cap + 30) return "plus_30";
  if (counted >= cap) return "cap_reached";
  return null;
}

function tierAlreadyFiredToday(
  history: OverageNotifyHistoryEntry[],
  isoDateLocal: string,
  tier: OverageTier,
): boolean {
  return history.some((h) => h.isoDate === isoDateLocal && h.tier === tier);
}

const ADULT_TEXT: Record<OverageTier, { title: string; content: string }> = {
  cap_reached: {
    title: "Reagan reached today's screen-time cap",
    content:
      "Heads-up — Reagan's at the cap for today. No action needed; she's still doing reading + art + outdoor time which don't count. Just a soft data point.",
  },
  plus_30: {
    title: "Reagan is 30 min over today's cap",
    content:
      "Reagan's about 30 minutes past the cap today. Could be a longer focus block on something good — totally up to you whether to redirect.",
  },
  plus_60: {
    title: "Reagan is 60+ min over today's cap",
    content:
      "Reagan's at least an hour past the cap today. Worth a quick check-in next time you walk by — no rush.",
  },
};

const KID_TEXT: Record<OverageTier, string> = {
  cap_reached: "You hit today's screen goal.",
  plus_30: "That's a big screen day so far. Step away whenever you want.",
  plus_60: "Long screen day. Worth a real break.",
};

export function decideScreenTimeOverage(input: WatchdogInput): WatchdogDecision {
  const allowed = new Set(input.alwaysAllowedAppKeys);
  let counted = 0;
  for (const s of input.todaySamples) {
    if (allowed.has(s.appKey)) continue;
    if (Number.isFinite(s.minutes) && s.minutes > 0) counted += s.minutes;
  }

  const cap = input.capMinutes > 0 ? input.capMinutes : 0;
  const tier = tierForMinutes(counted, cap);

  if (tier === null) {
    return {
      shouldNotify: false,
      tier: null,
      countedMinutes: counted,
      capMinutes: cap,
      kidHeadline: null,
      adultHeadline: null,
      notifyPayload: null,
      suppressedReason: "under cap",
    };
  }

  if (tierAlreadyFiredToday(input.history, input.isoDateLocal, tier)) {
    return {
      shouldNotify: false,
      tier,
      countedMinutes: counted,
      capMinutes: cap,
      kidHeadline: KID_TEXT[tier],
      adultHeadline: ADULT_TEXT[tier].title,
      notifyPayload: null,
      suppressedReason: `tier ${tier} already notified today`,
    };
  }

  return {
    shouldNotify: true,
    tier,
    countedMinutes: counted,
    capMinutes: cap,
    kidHeadline: KID_TEXT[tier],
    adultHeadline: ADULT_TEXT[tier].title,
    notifyPayload: {
      category: "screen_time_overage",
      title: ADULT_TEXT[tier].title,
      content: `${ADULT_TEXT[tier].content} (counted ${Math.round(counted)} min vs cap ${cap} min)`,
    },
    suppressedReason: null,
  };
}

export const __FOR_TEST__ = {
  tierForMinutes,
  tierAlreadyFiredToday,
  ADULT_TEXT,
  KID_TEXT,
};
