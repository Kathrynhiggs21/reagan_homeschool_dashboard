/**
 * Push 182 — Family Screen-Time Fairness
 *
 * Plain-English rules for Mom + Grandma + Reagan:
 *   • There is no "punishment". We never auto-deduct screen time.
 *   • "Always-allowed" activities (reading, outdoor, art, building, music)
 *     are surfaced first whenever someone opens the screen-time card.
 *   • Mom + Grandma can each grant an override. Either adult's override
 *     is enough — they don't need to agree.
 *   • Fairness across family members: if one person has had way more
 *     screen time today than the others, the card gently suggests an
 *     "always-allowed" activity instead. It never blocks anything.
 *   • Kid-readable, never punitive language.
 *
 * Pure helper — no I/O, no DB, no LLM. All inputs typed.
 */

export type FamilyMemberId = "reagan" | "mom" | "grandma" | string;

export type ScreenTimeUseToday = {
  memberId: FamilyMemberId;
  minutes: number;
};

export type AdultOverride = {
  grantedBy: "mom" | "grandma";
  extraMinutes: number; // additive on top of base allowance for the kid
  reason?: string;
};

export type AlwaysAllowedActivity = {
  key: string;
  label: string; // kid-readable, e.g. "Read in the cozy chair"
  category: "reading" | "outdoor" | "art" | "building" | "music";
};

export type FairnessInput = {
  isoDate: string; // "YYYY-MM-DD"
  /** Who is opening the card right now. */
  viewerId: FamilyMemberId;
  /** Today's screen-time totals so far. */
  usageToday: ScreenTimeUseToday[];
  /** Base daily allowance for Reagan (minutes). Defaults to 45. */
  reaganBaseAllowanceMin?: number;
  /** Active overrides granted by Mom or Grandma (additive). */
  overrides?: AdultOverride[];
  /** Curated list of always-allowed activities. */
  alwaysAllowed?: AlwaysAllowedActivity[];
  /** Carry-in bank from Roblox earn helper, if any. */
  bankCarriedMin?: number;
};

export type FairnessLine = {
  kind: "headline" | "always_allowed" | "fairness_note" | "override_note";
  text: string;
};

export type FairnessResult = {
  isoDate: string;
  reaganMinutesUsedToday: number;
  reaganTotalAllowedMin: number;
  reaganRemainingMin: number;
  alwaysAllowedSurfaced: AlwaysAllowedActivity[];
  fairnessSuggested: boolean;
  /** Always false — we never block. */
  blocked: false;
  lines: FairnessLine[];
  kidLine: string;
  adultLine: string;
};

const DEFAULT_ALWAYS_ALLOWED: AlwaysAllowedActivity[] = [
  { key: "read_cozy", label: "Read in the cozy chair", category: "reading" },
  { key: "outside_yard", label: "Go outside in the yard", category: "outdoor" },
  { key: "draw_doodle", label: "Draw or doodle", category: "art" },
  { key: "build_legos", label: "Build with LEGO or blocks", category: "building" },
  { key: "music_jam", label: "Put on music and dance", category: "music" },
];

const BANNED = ["lose", "lost", "punish", "punished", "bad", "fail", "failed"];

function scrub(s: string): string {
  let out = s;
  for (const b of BANNED) {
    out = out.replace(new RegExp(`\\b${b}\\b`, "gi"), "okay");
  }
  return out;
}

export function computeFamilyScreenTimeFairness(
  input: FairnessInput,
): FairnessResult {
  const base = input.reaganBaseAllowanceMin ?? 45;
  const overrides = input.overrides ?? [];
  const alwaysAllowed =
    input.alwaysAllowed && input.alwaysAllowed.length > 0
      ? input.alwaysAllowed
      : DEFAULT_ALWAYS_ALLOWED;
  const bank = Math.max(0, input.bankCarriedMin ?? 0);

  const overrideTotal = overrides.reduce(
    (acc, o) => acc + Math.max(0, o.extraMinutes),
    0,
  );
  const reaganUsed =
    input.usageToday.find((u) => u.memberId === "reagan")?.minutes ?? 0;
  const reaganTotalAllowed = base + overrideTotal + bank;
  const reaganRemaining = Math.max(0, reaganTotalAllowed - reaganUsed);

  // Fairness check: only suggest when Reagan's usage is meaningfully
  // higher than the family average. Never blocks.
  const totalMembers = input.usageToday.length || 1;
  const familyAvg =
    input.usageToday.reduce((acc, u) => acc + u.minutes, 0) / totalMembers;
  const fairnessSuggested =
    totalMembers >= 2 && reaganUsed > familyAvg + 30;

  const lines: FairnessLine[] = [];

  // Headline — always kid-readable, never punitive.
  if (input.viewerId === "reagan") {
    lines.push({
      kind: "headline",
      text:
        reaganRemaining > 0
          ? `You have about ${reaganRemaining} minutes of screen time saved up.`
          : `No screen-time minutes saved up right now — that's okay.`,
    });
  } else {
    lines.push({
      kind: "headline",
      text: `Reagan: ${reaganUsed} min used today, ${reaganRemaining} min left.`,
    });
  }

  // Always-allowed surfaces first, every time the card opens.
  const surfaced = alwaysAllowed.slice(0, 5);
  for (const a of surfaced) {
    lines.push({
      kind: "always_allowed",
      text: a.label,
    });
  }

  if (fairnessSuggested) {
    lines.push({
      kind: "fairness_note",
      text: "Maybe pick an always-allowed thing for a bit?",
    });
  }

  for (const o of overrides) {
    lines.push({
      kind: "override_note",
      text: `${o.grantedBy === "mom" ? "Mom" : "Grandma"} added +${o.extraMinutes} min${o.reason ? ` (${o.reason})` : ""}.`,
    });
  }

  const kidLine = scrub(
    reaganRemaining > 0
      ? `You have ${reaganRemaining} screen-time minutes saved. Reading, outside, art, LEGO, and music are always okay.`
      : `No screen-time minutes saved right now — that's okay. Reading, outside, art, LEGO, and music are always okay.`,
  );

  const adultLine = scrub(
    `Reagan: ${reaganUsed}/${reaganTotalAllowed} min today. ${overrideTotal > 0 ? `Overrides: +${overrideTotal} min. ` : ""}${fairnessSuggested ? "Family fairness: suggesting always-allowed activity." : "Balanced with family."}`,
  );

  return {
    isoDate: input.isoDate,
    reaganMinutesUsedToday: reaganUsed,
    reaganTotalAllowedMin: reaganTotalAllowed,
    reaganRemainingMin: reaganRemaining,
    alwaysAllowedSurfaced: surfaced,
    fairnessSuggested,
    blocked: false,
    lines,
    kidLine,
    adultLine,
  };
}
