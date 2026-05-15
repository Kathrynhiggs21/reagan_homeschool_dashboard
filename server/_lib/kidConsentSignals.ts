/**
 * Push 204 (2026-05-14, Wave-15) — Kid consent signals helper.
 *
 * HOUSE RULE: the dashboard NEVER imposes breaks on Reagan.
 *  It only honors the ones she asks for. Reagan taps either
 *  "I want to keep going" or "I'm done" on any in-app task,
 *  and this helper turns the tap history into a deterministic
 *  recommendation the UI surfaces (calmly, dry tone, never punitive).
 *
 * Voice rules baked in (per Reagan's "Kiwi voice is creepy" feedback):
 *  - kidLine never uses "buddy", "friend", "yay", "great job!", exclamations.
 *  - Recommendations are framed as options Reagan can accept or skip.
 *  - Mom/Grandma never see this — kid-side only.
 */

export type ConsentSignal = "keep_going" | "im_done" | "switch_subject";

export interface ConsentTap {
  signal: ConsentSignal;
  isoTimestamp: string;
  subject?: string;
}

export interface ConsentInput {
  taps: ConsentTap[];
  currentIsoTimestamp: string;
  sessionStartedAtIso: string;
}

export type ConsentRecommendation =
  | "keep_going"
  | "offer_break"
  | "offer_switch"
  | "wrap_up";

export interface ConsentDecision {
  recommendation: ConsentRecommendation;
  kidLine: string;
  reason: string;
  sessionMinutes: number;
}

const KID_LINES: Record<ConsentRecommendation, string> = {
  keep_going: "Okay. Keep going.",
  offer_break:
    "You've been at this a while. A short break is fine if you want one.",
  offer_switch: "Switch to something else if you want.",
  wrap_up: "Got it. Done for now.",
};

function minutesBetween(a: string, b: string): number {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (Number.isNaN(ta) || Number.isNaN(tb)) return 0;
  return Math.max(0, Math.floor((tb - ta) / 60000));
}

export function decideKidConsent(input: ConsentInput): ConsentDecision {
  const sessionMinutes = minutesBetween(
    input.sessionStartedAtIso,
    input.currentIsoTimestamp,
  );
  const taps = input.taps;
  const last = taps.length > 0 ? taps[taps.length - 1] : null;

  if (last && last.signal === "im_done") {
    return {
      recommendation: "wrap_up",
      kidLine: KID_LINES.wrap_up,
      reason: "kid tapped im_done",
      sessionMinutes,
    };
  }

  if (last && last.signal === "switch_subject") {
    return {
      recommendation: "offer_switch",
      kidLine: KID_LINES.offer_switch,
      reason: "kid tapped switch_subject",
      sessionMinutes,
    };
  }

  if (sessionMinutes >= 45) {
    const last2 = taps.slice(-2);
    if (last2.some((t) => t.signal === "keep_going")) {
      return {
        recommendation: "offer_break",
        kidLine: KID_LINES.offer_break,
        reason: `session ${sessionMinutes}min >= 45 with recent keep_going`,
        sessionMinutes,
      };
    }
  }

  if (sessionMinutes >= 25) {
    const last3 = taps.slice(-3);
    if (!last3.some((t) => t.signal === "keep_going")) {
      return {
        recommendation: "offer_break",
        kidLine: KID_LINES.offer_break,
        reason: `session ${sessionMinutes}min >= 25 with no keep_going in last 3`,
        sessionMinutes,
      };
    }
  }

  return {
    recommendation: "keep_going",
    kidLine: KID_LINES.keep_going,
    reason: taps.length === 0 ? "no taps yet" : "kid in flow",
    sessionMinutes,
  };
}

export const __FOR_TEST__ = { KID_LINES, minutesBetween };
