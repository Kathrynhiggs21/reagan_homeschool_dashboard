/**
 * bootSplash — pure data + helpers for the animated boot splash.
 * Extracted from BootSplash.tsx so the choreography contract is unit-testable
 * in the node test environment (the component itself needs a DOM).
 *
 * Storyboard (Katy 2026-06-19): a white-studio, video-style intro built from
 * five real 3D cap-budgie pose renders that cross-fade, with an arched marker
 * "REAGAN'S" writing on and a two-tone teal/gold "HOMESCHOOL" lighting up.
 */

/** Cap-budgie pose renders (white-studio transparent PNGs) + the flying cap. */
export const BOOT_POSE = {
  wave: "/manus-storage/kiwi_grad_wave_clean_8fd797ac.png",
  windup: "/manus-storage/kiwi_grad_windup_clean_b75941ac.png",
  lookup: "/manus-storage/kiwi_grad_lookup_clean_25bddb5c.png",
  lookdown: "/manus-storage/kiwi_grad_lookdown_clean_94eb5955.png",
  wink: "/manus-storage/kiwi_grad_wink_clean_ca56387f.png",
} as const;

export const BOOT_CAP_IMG = "/manus-storage/grad_cap_fly_b86facd4.png";

export type BootPoseKey = keyof typeof BOOT_POSE;
export type BootPhase = "wave" | "windup" | "fling" | "lookdown" | "wink";

/** Choreography timeline (ms from mount). Ordered, monotonic, >5s on screen. */
export const BOOT_T = {
  wave: 350,
  write: 850,
  windup: 2050,
  fling: 2500,
  lookdown: 3650,
  wink: 4750,
  hold: 6250,
  fade: 700,
} as const;

/** Phases in playback order. */
export const BOOT_PHASES: BootPhase[] = [
  "wave",
  "windup",
  "fling",
  "lookdown",
  "wink",
];

/** Possessive form: "Reagan" -> "Reagan's", "Chris" -> "Chris'". */
export function possessive(name: string): string {
  const n = name.trim();
  if (!n) return "";
  return /s$/i.test(n) ? `${n}\u2019` : `${n}\u2019s`;
}

/** Resolve the first-name possessive title from a (possibly full) student name. */
export function bootTitleName(studentName?: string | null): string {
  const full = (studentName || "Reagan").trim();
  const first = full.split(/\s+/)[0] || "Reagan";
  return possessive(first);
}

/** Which pose render is on top for a given phase. */
export function poseForPhase(phase: BootPhase): BootPoseKey {
  switch (phase) {
    case "wave":
      return "wave";
    case "windup":
      return "windup";
    case "fling":
      return "lookup";
    case "lookdown":
      return "lookdown";
    case "wink":
      return "wink";
  }
}

/** The cap is airborne only while it is in flight (fling -> lands by lookdown). */
export function capFlyingForPhase(phase: BootPhase): boolean {
  return phase === "fling" || phase === "lookdown";
}

/** HOMESCHOOL visual state by phase: hidden -> dim -> lit. */
export function homeschoolStateForPhase(
  phase: BootPhase,
): "hidden" | "dim" | "lit" {
  if (phase === "wink") return "lit";
  if (phase === "lookdown") return "dim";
  return "hidden";
}
