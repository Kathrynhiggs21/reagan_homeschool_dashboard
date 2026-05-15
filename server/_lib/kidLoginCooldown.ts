/**
 * Wave-15 / Push 194 — kidLoginCooldown
 *
 * PURE deterministic helper. No I/O. Prevents a kid-side "I can't sign
 * in" loop from spamming notifyOwner to Mom or Grandma when Reagan
 * taps the same broken appLink several times in a row.
 *
 * Safety beats noise — these symptoms ALWAYS pass through cooldown:
 *   - "asks for grown-up"
 *   - "says I'm not allowed"
 * And kidEmail === "reagan.higgs33@ihsd.us" ALWAYS passes through
 * regardless of symptom (the blocked-IHSD case is too important to mute).
 */

export type Symptom =
  | "page won't load"
  | "wrong password"
  | "says I'm not allowed"
  | "blank screen"
  | "asks for grown-up"
  | "other";

export interface KidLoginEvent {
  appKey: string;
  symptom: Symptom;
  isoTimestamp: string;
  escalateToGrownup: boolean;
  kidEmail: string | null;
}

export interface CooldownDecision {
  shouldFireNotify: boolean;
  suppressedReason: string | null;
}

const DEFAULT_COOLDOWN_MS = 15 * 60 * 1000;
const BLOCKED_KID_EMAIL = "reagan.higgs33@ihsd.us";
const ALWAYS_THROUGH_SYMPTOMS: Symptom[] = [
  "asks for grown-up",
  "says I'm not allowed",
];

export interface CooldownInput {
  events: KidLoginEvent[]; // chronological, latest LAST
  nowIso: string;
  cooldownMs?: number;
}

function isAlwaysThrough(ev: KidLoginEvent): boolean {
  if (ALWAYS_THROUGH_SYMPTOMS.includes(ev.symptom)) return true;
  if (ev.kidEmail === BLOCKED_KID_EMAIL) return true;
  return false;
}

export function decideKidLoginCooldown(input: CooldownInput): CooldownDecision {
  const { events, nowIso } = input;
  const cooldownMs = input.cooldownMs ?? DEFAULT_COOLDOWN_MS;

  if (events.length === 0) {
    return { shouldFireNotify: false, suppressedReason: "no events" };
  }
  const latest = events[events.length - 1];

  // Latest event must itself want a notify.
  if (!latest.escalateToGrownup) {
    return {
      shouldFireNotify: false,
      suppressedReason: "latest event not escalating",
    };
  }

  // Safety bypass — always fire.
  if (isAlwaysThrough(latest)) {
    return { shouldFireNotify: true, suppressedReason: null };
  }

  const nowMs = Date.parse(nowIso);
  if (!Number.isFinite(nowMs)) {
    // Defensive — bad clock, don't suppress.
    return { shouldFireNotify: true, suppressedReason: null };
  }

  // Look for an EARLIER event (not the latest itself) for the same
  // appKey that already escalated, within the cooldown window.
  for (let i = events.length - 2; i >= 0; i--) {
    const prev = events[i];
    if (prev.appKey !== latest.appKey) continue;
    if (!prev.escalateToGrownup) continue;
    const prevMs = Date.parse(prev.isoTimestamp);
    if (!Number.isFinite(prevMs)) continue;
    if (nowMs - prevMs < cooldownMs) {
      const minutes = Math.max(1, Math.round((nowMs - prevMs) / 60000));
      return {
        shouldFireNotify: false,
        suppressedReason: `already pinged adult about ${latest.appKey} ${minutes} min ago (cooldown ${Math.round(
          cooldownMs / 60000,
        )} min)`,
      };
    }
    // First in-window match decides; older ones don't matter.
    break;
  }

  return { shouldFireNotify: true, suppressedReason: null };
}

export const __FOR_TEST__ = {
  DEFAULT_COOLDOWN_MS,
  BLOCKED_KID_EMAIL,
  ALWAYS_THROUGH_SYMPTOMS,
  isAlwaysThrough,
};
