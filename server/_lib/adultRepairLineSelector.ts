/**
 * Wave-15 / Push 201 — adultRepairLineSelector
 * PURE deterministic helper. Picks ONE adult-readable line for ops events.
 */

export type RepairContext =
  | "vault_rotation_due"
  | "vault_rotation_overdue"
  | "screen_time_overage"
  | "kid_login_escalation"
  | "weekly_digest_opener"
  | "system_health_blip"
  | "scheduled_task_recovered"
  | "drive_mirror_skipped"
  | "ihsd_email_blocked_attempt"
  | "great_week_summary";

export interface RepairInput {
  context: RepairContext;
  seed: string;
  adultName?: string;
}

export interface RepairLine {
  text: string;
  severity: "info" | "attention" | "ask_when_ready";
}

const POOLS: Record<RepairContext, RepairLine[]> = {
  vault_rotation_due: [
    { text: "Hi {name} — a few app sign-ins are due for a fresh password this week. No rush, just when you have a minute.", severity: "ask_when_ready" },
    { text: "{name}, the password vault has a few entries past their rotate date. Pop in when you can.", severity: "ask_when_ready" },
    { text: "Heads up, {name}: a couple of logins want a fresh password soon.", severity: "ask_when_ready" },
  ],
  vault_rotation_overdue: [
    { text: "{name}, a few sign-ins have been past their rotate date for a while. Worth a look today if you can.", severity: "attention" },
    { text: "Hi {name} — overdue rotations are stacking up. Best to tackle them this evening.", severity: "attention" },
    { text: "{name}, the vault has overdue items. Nothing is locked, but they're due.", severity: "attention" },
  ],
  screen_time_overage: [
    { text: "Hi {name} — Reagan reached today's screen-time cap. The dashboard didn't block anything; just a heads up.", severity: "info" },
    { text: "{name}, today's screen-time cap was reached. Reading minutes don't count toward it.", severity: "info" },
    { text: "Heads up, {name}: cap reached for today. Reagan's still going if she wants; this is informational.", severity: "info" },
  ],
  kid_login_escalation: [
    { text: "{name}, Reagan asked for help with a sign-in. Details are in the dashboard.", severity: "attention" },
    { text: "Hi {name} — a sign-in didn't go through and Reagan tagged a grown-up. Check Today when free.", severity: "attention" },
    { text: "{name}, a kid-side sign-in needs a quick adult assist. Not urgent.", severity: "attention" },
  ],
  weekly_digest_opener: [
    { text: "Hi {name} — here's Reagan's week in three lines.", severity: "info" },
    { text: "{name}, your Sunday recap is ready.", severity: "info" },
    { text: "{name} — short week summary, nothing alarming.", severity: "info" },
  ],
  system_health_blip: [
    { text: "Hi {name} — the dashboard had a small hiccup and recovered. Nothing for Reagan to see.", severity: "info" },
    { text: "{name}, a background job blipped and self-healed. Logged for the record.", severity: "info" },
    { text: "Heads up, {name}: brief health blip, recovered cleanly.", severity: "info" },
  ],
  scheduled_task_recovered: [
    { text: "{name}, the scheduled job that no-op'd earlier ran cleanly on retry. All caught up.", severity: "info" },
    { text: "Hi {name} — yesterday's missed run completed on its own. Nothing else needed.", severity: "info" },
    { text: "{name}, the recovery pass for the scheduled task is done.", severity: "info" },
  ],
  drive_mirror_skipped: [
    { text: "Hi {name} — the Drive mirror skipped a run because connectors aren't granted yet. Easy fix when ready.", severity: "ask_when_ready" },
    { text: "{name}, Drive sync is paused pending the Google connector. Tap accept on the next card and it resumes.", severity: "ask_when_ready" },
    { text: "Heads up, {name}: Drive mirror waiting on connector grants. No data loss.", severity: "ask_when_ready" },
  ],
  ihsd_email_blocked_attempt: [
    { text: "{name}, an attempt was made to use the IHSD email; the dashboard sanitized it as designed.", severity: "info" },
    { text: "Hi {name} — IHSD-email path was blocked at the helper layer. Reagan didn't see anything.", severity: "info" },
    { text: "{name}, blocked email was filtered cleanly. Logged for audit.", severity: "info" },
  ],
  great_week_summary: [
    { text: "{name}, this was a strong week for Reagan. Effort + heart, both showed up.", severity: "info" },
    { text: "Hi {name} — really good week on the Reagan side. Numbers in the dashboard.", severity: "info" },
    { text: "{name}, week summary is positive across the board.", severity: "info" },
  ],
};

function hashSeed(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

const FORBIDDEN = [
  "urgent", "failed", "broken", "critical", "panic",
  "emergency", "asap", "now!", "fix immediately",
];

const BLAMES_KID = [
  "reagan can't", "reagan failed", "reagan broke",
  "reagan didn't", "reagan forgot", "reagan messed",
];

export function selectRepairLine(input: RepairInput): RepairLine {
  const pool = POOLS[input.context];
  if (!pool || pool.length === 0) {
    return {
      text: `Hi ${input.adultName ?? "Mom"} — small dashboard event logged. Details inside.`,
      severity: "info",
    };
  }
  const idx = hashSeed(`${input.context}:${input.seed}`) % pool.length;
  const chosen = pool[idx];
  const name = input.adultName ?? "Mom";
  const text = chosen.text.replace(/{name}/g, name);
  return { text, severity: chosen.severity };
}

function containsAlarmWord(lower: string, word: string): boolean {
  // Match the word as a substring but NOT when preceded by "not "
  // (so "not urgent" / "not broken" is fine; bare "urgent" / "broken" is not).
  const pattern = new RegExp(`(?<!not )\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
  return pattern.test(lower);
}

export function isLineSafeForAdult(text: string): boolean {
  const lower = text.toLowerCase();
  if (FORBIDDEN.some((w) => containsAlarmWord(lower, w))) return false;
  if (BLAMES_KID.some((w) => lower.includes(w))) return false;
  return true;
}

export const __FOR_TEST__ = { POOLS, FORBIDDEN, BLAMES_KID, hashSeed };
