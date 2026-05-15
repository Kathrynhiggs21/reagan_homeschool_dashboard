/**
 * Wave-15 / Push 237 — kiwiVoiceProfileResolver
 *
 * Pure deterministic helper. Picks which voice profile to use
 * based on the surface (panel) Reagan is currently on. The three
 * profiles (older_cousin, neutral_calm, study_buddy) all exist
 * from Push 218 — this just routes the right one for the context.
 *
 * Routing table:
 *   today          → older_cousin   (general dashboard chat)
 *   kiwi           → older_cousin   (dedicated Kiwi page; the
 *                                    default surface)
 *   schedule       → neutral_calm   (calendar/planning; calm tone)
 *   bookshelf      → study_buddy    (reading help; focus mode)
 *   notebook       → study_buddy    (writing help; focus mode)
 *   apps           → neutral_calm   (app links/credentials; calm)
 *   feeling        → neutral_calm   (emotional check-in; most
 *                                    subdued)
 *   stuck          → study_buddy    (homework-help request; focus)
 *
 * Unknown / missing panel → older_cousin (the safe default).
 *
 * Returns BOTH the profile id and a short rationale string that
 * the audit log surfaces to adults (Mom + Grandma) so they can see
 * "Why did Kiwi switch to neutral_calm here?".
 *
 * Note: this is a routing helper. The actual prompt fragment lives
 * in kiwiVoiceSettings (Push 218). Callers chain:
 *   resolveKiwiVoiceProfile(panel) → kiwiVoiceSettings(profile)
 */

export type KiwiVoiceProfile =
  | "older_cousin"
  | "neutral_calm"
  | "study_buddy";

export type KiwiPanel =
  | "today"
  | "kiwi"
  | "schedule"
  | "bookshelf"
  | "notebook"
  | "apps"
  | "feeling"
  | "stuck";

export interface KiwiVoiceProfileResolution {
  profile: KiwiVoiceProfile;
  rationale: string;
}

const ROUTING: Record<KiwiPanel, { profile: KiwiVoiceProfile; rationale: string }> = {
  today: {
    profile: "older_cousin",
    rationale: "Dashboard default — calm older-cousin register.",
  },
  kiwi: {
    profile: "older_cousin",
    rationale: "Dedicated Kiwi page — calm older-cousin register.",
  },
  schedule: {
    profile: "neutral_calm",
    rationale: "Calendar / planning — neutral, low-energy tone.",
  },
  bookshelf: {
    profile: "study_buddy",
    rationale: "Reading help — focus-mode register.",
  },
  notebook: {
    profile: "study_buddy",
    rationale: "Writing help — focus-mode register.",
  },
  apps: {
    profile: "neutral_calm",
    rationale: "App links / credentials — neutral, low-energy tone.",
  },
  feeling: {
    profile: "neutral_calm",
    rationale: "Emotional check-in — most subdued register.",
  },
  stuck: {
    profile: "study_buddy",
    rationale: "Homework-help request — focus-mode register.",
  },
};

export function resolveKiwiVoiceProfile(
  panel: string | null | undefined,
): KiwiVoiceProfileResolution {
  const key = typeof panel === "string" ? panel.trim().toLowerCase() : "";
  const hit = (ROUTING as Record<string, { profile: KiwiVoiceProfile; rationale: string }>)[key];
  if (hit) {
    return { profile: hit.profile, rationale: hit.rationale };
  }
  return {
    profile: "older_cousin",
    rationale: "Unknown panel — safe default older-cousin register.",
  };
}

/** Stable list of all known panel ids — useful for UI dropdowns. */
export function listKiwiPanels(): readonly KiwiPanel[] {
  return Object.keys(ROUTING) as KiwiPanel[];
}
