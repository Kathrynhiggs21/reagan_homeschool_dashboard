/**
 * Push 136 (2026-05-13) — Slay Charge ⚡ kid-tier copy variants contract.
 *
 * Pins:
 *   - blocklist drops items with banned words (whole-word match)
 *   - reading-level grade is clamped non-negative and computed deterministically
 *   - SLAY_CHARGE_POOL is unchanged after filtering (no mutation)
 *   - all current pool items pass the safe filter (sanity guard for future edits)
 *   - kid-friendly-stretch items remain available to adult-preview surface
 *   - kind filter narrows correctly (joke vs clip)
 *   - kidSafeOnly() returns only "kid-safe" tier items
 */
import { describe, it, expect } from "vitest";
import {
  KID_SAFE_BLOCKLIST,
  KID_TIER_MAX_GRADE_LEVEL,
  fleschKincaidGradeLevel,
  isKidSafeText,
  filterKidSafePool,
  kidSafeOnly,
} from "./_lib/slayChargeKidCopyVariants";
import { SLAY_CHARGE_POOL } from "./_lib/slayChargeMorningVibe";

describe("Push 136 — kid-tier copy variants", () => {
  it("ships canonical thresholds (grade ≤ 6.5; blocklist non-empty)", () => {
    expect(KID_TIER_MAX_GRADE_LEVEL).toBe(6.5);
    expect(KID_SAFE_BLOCKLIST.length).toBeGreaterThan(0);
    expect(KID_SAFE_BLOCKLIST).toContain("kill");
    expect(KID_SAFE_BLOCKLIST).toContain("scary");
  });

  it("blocks unsafe text via whole-word match", () => {
    expect(isKidSafeText("This joke is about a gun.")).toBe(false);
    expect(isKidSafeText("Don't be stupid")).toBe(false);
    expect(isKidSafeText("It was a sunny day at the park.")).toBe(true);
  });

  it("does NOT false-positive on safe substrings", () => {
    // "skill" contains "kill" but should not be blocked (whole-word).
    expect(isKidSafeText("Reagan has skill at math.")).toBe(true);
    // "diet" contains "die" but should not be blocked.
    expect(isKidSafeText("Try a balanced diet.")).toBe(true);
  });

  it("computes a non-negative grade level (clamped at 0 for trivial text)", () => {
    expect(fleschKincaidGradeLevel("Hi.")).toBeGreaterThanOrEqual(0);
    expect(fleschKincaidGradeLevel("")).toBe(0);
  });

  it("returns higher grade for clearly more complex sentences", () => {
    const simple = fleschKincaidGradeLevel("The dog sat on the mat.");
    const complex = fleschKincaidGradeLevel(
      "Notwithstanding considerable methodological complications, the investigators systematically reanalyzed unprecedented neurophysiological observations.",
    );
    expect(complex).toBeGreaterThan(simple);
  });

  it("does NOT mutate SLAY_CHARGE_POOL", () => {
    const before = SLAY_CHARGE_POOL.map((i) => i.id).join(",");
    filterKidSafePool();
    const after = SLAY_CHARGE_POOL.map((i) => i.id).join(",");
    expect(after).toBe(before);
  });

  it("all current pool items pass the safe filter (no banned words)", () => {
    const filtered = filterKidSafePool();
    // Pool size = filtered size — none dropped by blocklist.
    expect(filtered.length).toBe(SLAY_CHARGE_POOL.length);
  });

  it("tags items with tier = kid-safe or kid-friendly-stretch", () => {
    const filtered = filterKidSafePool();
    for (const it of filtered) {
      expect(["kid-safe", "kid-friendly-stretch"]).toContain(it.tier);
      expect(typeof it.gradeLevel).toBe("number");
      expect(it.gradeLevel).toBeGreaterThanOrEqual(0);
    }
  });

  it("kidSafeOnly() returns only kid-safe-tier items", () => {
    const safeOnly = kidSafeOnly(filterKidSafePool());
    for (const it of safeOnly) expect(it.tier).toBe("kid-safe");
  });

  it("kidSafeOnly() is non-empty for the shipped pool (Reagan always has something on screen)", () => {
    expect(kidSafeOnly(filterKidSafePool()).length).toBeGreaterThan(0);
  });

  it("kind filter narrows to jokes only", () => {
    const jokes = filterKidSafePool(SLAY_CHARGE_POOL, { kind: "joke" });
    for (const it of jokes) expect(it.kind).toBe("joke");
    expect(jokes.length).toBeGreaterThan(0);
  });

  it("kind filter narrows to clips only", () => {
    const clips = filterKidSafePool(SLAY_CHARGE_POOL, { kind: "clip" });
    for (const it of clips) expect(it.kind).toBe("clip");
    expect(clips.length).toBeGreaterThan(0);
  });

  it("custom maxGradeLevel can downgrade items into stretch tier", () => {
    // With max=0 every item should land in 'stretch' (since most have grade > 0)
    const all = filterKidSafePool(SLAY_CHARGE_POOL, { maxGradeLevel: 0 });
    const safe = kidSafeOnly(all);
    expect(all.length).toBe(SLAY_CHARGE_POOL.length);
    expect(safe.length).toBeLessThan(all.length);
  });
});
