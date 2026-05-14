/**
 * Push 136 (2026-05-13) — Slay Charge ⚡ kid-tier copy variants.
 *
 * Per project memory:
 *   - Reagan is a 5th grader (~10–11 yrs old)
 *   - Daily start-up should feel like a happy/funny morning message
 *   - Mom + Grandma should never have to worry about what's served
 *
 * This pure helper sits on top of the SLAY_CHARGE_POOL from Push 118 and:
 *   1. Filters items that fail the kid-safe blocklist (drop, never serve)
 *   2. Filters items whose joke/clip caption reads above 5th-grade level
 *      (Flesch-Kincaid grade level approximation; ≤ 6.5 passes)
 *   3. Returns the eligible pool plus a per-item "tier" label so the UI
 *      can pick the right register for kid vs adult preview
 *
 * Pure module — no DB, no I/O, no external pool mutation. Returns a NEW
 * array; SLAY_CHARGE_POOL itself is never modified.
 */

import {
  SLAY_CHARGE_POOL,
  type SlayChargePoolItem,
  type SlayChargePickKind,
} from "./slayChargeMorningVibe";

// Kid-safe blocklist — words we never want to serve into Reagan's morning.
// Lowercased; matched as whole-word substrings.
export const KID_SAFE_BLOCKLIST: readonly string[] = [
  "kill",
  "killed",
  "killing",
  "die",
  "dying",
  "dead",
  "death",
  "violence",
  "blood",
  "bloody",
  "weapon",
  "gun",
  "knife",
  "sex",
  "sexy",
  "drug",
  "drunk",
  "stupid",
  "idiot",
  "hate",
  "hated",
  "hating",
  "hell",
  "damn",
  "scary",
  "horror",
  "ugly",
];

// Reading-level thresholds. We use a Flesch-Kincaid grade level
// approximation: 0.39 * (words/sentences) + 11.8 * (syllables/words) - 15.59
export const KID_TIER_MAX_GRADE_LEVEL = 6.5;

export type KidTierLabel = "kid-safe" | "kid-friendly-stretch";

export interface KidTieredItem extends SlayChargePoolItem {
  tier: KidTierLabel;
  gradeLevel: number;
}

/** Estimate syllable count for a word (cheap heuristic, deterministic). */
function syllablesIn(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length === 0) return 0;
  if (w.length <= 3) return 1;
  // Drop trailing silent 'e' and "es"/"ed".
  let stripped = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  // Treat 'y' as a vowel only when not initial.
  stripped = stripped.replace(/^y/, "");
  const groups = stripped.match(/[aeiouy]+/g);
  return Math.max(1, groups?.length ?? 1);
}

export function fleschKincaidGradeLevel(text: string): number {
  if (typeof text !== "string") return 0;
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  // Sentence count: split on . ! ? but keep at least 1.
  const sentences = Math.max(
    1,
    trimmed.split(/[.!?]+/).filter((s) => s.trim().length > 0).length,
  );
  const words = trimmed.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = Math.max(1, words.length);
  const syllableCount = words.reduce((acc, w) => acc + syllablesIn(w), 0);
  const grade =
    0.39 * (wordCount / sentences) +
    11.8 * (syllableCount / wordCount) -
    15.59;
  // Clamp negatives to 0 (very short, simple text).
  return Math.max(0, Number(grade.toFixed(2)));
}

export function isKidSafeText(text: string): boolean {
  if (typeof text !== "string") return false;
  const t = text.toLowerCase();
  // Whole-word check using \b boundaries.
  for (const bad of KID_SAFE_BLOCKLIST) {
    const re = new RegExp(`\\b${bad}\\b`, "i");
    if (re.test(t)) return false;
  }
  return true;
}

export interface KidPoolFilterOptions {
  /** Override max grade level (defaults to KID_TIER_MAX_GRADE_LEVEL). */
  maxGradeLevel?: number;
  /** Optional kind filter (joke / clip). */
  kind?: SlayChargePickKind;
}

export function filterKidSafePool(
  pool: ReadonlyArray<SlayChargePoolItem> = SLAY_CHARGE_POOL,
  options: KidPoolFilterOptions = {},
): KidTieredItem[] {
  const maxGrade = options.maxGradeLevel ?? KID_TIER_MAX_GRADE_LEVEL;
  const out: KidTieredItem[] = [];
  for (const item of pool) {
    if (!item || typeof item.text !== "string") continue;
    if (options.kind && item.kind !== options.kind) continue;
    if (!isKidSafeText(item.text)) continue;
    const grade = fleschKincaidGradeLevel(item.text);
    if (grade > maxGrade) {
      // Above threshold but still safe — mark as stretch and keep, so the
      // adult-preview surface can opt in even if the kid surface skips it.
      out.push({ ...item, tier: "kid-friendly-stretch", gradeLevel: grade });
      continue;
    }
    out.push({ ...item, tier: "kid-safe", gradeLevel: grade });
  }
  return out;
}

/** Strict subset for Reagan's actual morning surface. */
export function kidSafeOnly(items: ReadonlyArray<KidTieredItem>): KidTieredItem[] {
  return items.filter((i) => i.tier === "kid-safe");
}
