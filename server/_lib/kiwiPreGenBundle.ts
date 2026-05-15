/**
 * Wave-15 / Push 239 — kiwiPreGenBundle
 *
 * Pure deterministic helper. The UI does a lot before each LLM
 * call: resolve which voice profile to use (Push 237), resolve
 * the prompt fragment for that profile (Push 218), and resolve
 * the TTS pacing for the "Read" button (Push 224). Each one is a
 * separate round-trip today. This bundle packs them into a
 * single call so the chat UI just does:
 *
 *   const pre = await trpc.today.kiwiPreGenBundle.useQuery({ panel: "today" });
 *   // pre.profile / pre.systemPromptFragment / pre.sentenceCap /
 *   // pre.readAloudPacing / pre.rationale
 *
 * Composition is intentionally one-way: nothing here mutates
 * Reagan-facing state. Pure read-only routing.
 */

import { resolveKiwiVoiceProfile, type KiwiVoiceProfile } from "./kiwiVoiceProfileResolver";
import { resolveKiwiVoiceSettings, type KiwiVoiceSettings } from "./kiwiVoiceSettings";
import { getKiwiReadAloudPacing, type KiwiReadAloudPacing } from "./kiwiReadAloudPacing";

export interface KiwiPreGenBundle {
  panel: string;
  profile: KiwiVoiceProfile;
  rationale: string;
  voice: KiwiVoiceSettings;
  readAloudPacing: KiwiReadAloudPacing;
}

export function buildKiwiPreGenBundle(input: {
  panel: string | null | undefined;
}): KiwiPreGenBundle {
  const panel = typeof input.panel === "string" ? input.panel : "";
  const { profile, rationale } = resolveKiwiVoiceProfile(panel);
  const voice = resolveKiwiVoiceSettings({ profile });
  const readAloudPacing = getKiwiReadAloudPacing(profile);

  return {
    panel,
    profile,
    rationale,
    voice,
    readAloudPacing,
  };
}
