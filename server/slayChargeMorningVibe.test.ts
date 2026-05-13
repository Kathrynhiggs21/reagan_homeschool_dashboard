/**
 * Push 118 (2026-05-13) — Slay Charge ⚡ morning-vibe block contract.
 *
 * Locks the rename + suppression rules so the morning "vibe" block can
 * never silently regress into being treated as schoolwork.
 */
import { describe, it, expect } from "vitest";
import {
  SLAY_CHARGE_TITLE,
  SLAY_CHARGE_TYPE,
  SLAY_CHARGE_LEGACY_TYPE,
  SLAY_CHARGE_DEFAULT_MINUTES,
  SLAY_CHARGE_POOL,
  isMorningVibeBlock,
  pickSlayChargeForDay,
  dropMorningVibeRows,
} from "./_lib/slayChargeMorningVibe";

describe("Push 118 — Slay Charge ⚡ morning-vibe block", () => {
  it("title is exactly 'Slay Charge ⚡' with the bolt", () => {
    expect(SLAY_CHARGE_TITLE).toBe("Slay Charge ⚡");
    expect(SLAY_CHARGE_TITLE).toContain("⚡");
  });

  it("internal type is 'morning_vibe' and legacy is 'morning_warmup'", () => {
    expect(SLAY_CHARGE_TYPE).toBe("morning_vibe");
    expect(SLAY_CHARGE_LEGACY_TYPE).toBe("morning_warmup");
  });

  it("default duration is 5 minutes — short, not an academic block", () => {
    expect(SLAY_CHARGE_DEFAULT_MINUTES).toBe(5);
  });

  it("isMorningVibeBlock recognizes the new type", () => {
    expect(isMorningVibeBlock({ type: "morning_vibe" })).toBe(true);
    expect(isMorningVibeBlock({ blockType: "morning_vibe" })).toBe(true);
  });

  it("isMorningVibeBlock recognizes the legacy 'morning_warmup' type", () => {
    expect(isMorningVibeBlock({ type: "morning_warmup" })).toBe(true);
    expect(isMorningVibeBlock({ blockType: "morning_warmup" })).toBe(true);
  });

  it("isMorningVibeBlock recognizes the new title regardless of type", () => {
    expect(isMorningVibeBlock({ title: "Slay Charge ⚡" })).toBe(true);
    expect(isMorningVibeBlock({ title: "slay charge ⚡" })).toBe(true);
  });

  it("isMorningVibeBlock recognizes legacy 'Soft start' + 'Slow morning' titles", () => {
    expect(isMorningVibeBlock({ title: "Soft start" })).toBe(true);
    expect(isMorningVibeBlock({ title: "Slow morning" })).toBe(true);
  });

  it("isMorningVibeBlock returns false for real academic blocks", () => {
    expect(isMorningVibeBlock({ type: "math", title: "Decimals" })).toBe(false);
    expect(isMorningVibeBlock({ type: "read_aloud", title: "Charlotte's Web" })).toBe(false);
    expect(isMorningVibeBlock({ type: "choice", title: "Free reading" })).toBe(false);
  });

  it("pool is non-empty and contains both jokes and clips", () => {
    expect(SLAY_CHARGE_POOL.length).toBeGreaterThanOrEqual(20);
    const jokes = SLAY_CHARGE_POOL.filter((p) => p.kind === "joke");
    const clips = SLAY_CHARGE_POOL.filter((p) => p.kind === "clip");
    expect(jokes.length).toBeGreaterThan(0);
    expect(clips.length).toBeGreaterThan(0);
  });

  it("pickSlayChargeForDay is deterministic for same date+reroll", () => {
    const a = pickSlayChargeForDay({ dateIso: "2026-05-13" });
    const b = pickSlayChargeForDay({ dateIso: "2026-05-13" });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.item.id).toBe(b.item.id);
    }
  });

  it("rerollIndex picks a different (or at least re-derivable) item", () => {
    const first = pickSlayChargeForDay({ dateIso: "2026-05-13", rerollIndex: 0 });
    const second = pickSlayChargeForDay({ dateIso: "2026-05-13", rerollIndex: 1 });
    expect(first.ok && second.ok).toBe(true);
    // Re-running with the same reroll index is deterministic.
    const secondAgain = pickSlayChargeForDay({ dateIso: "2026-05-13", rerollIndex: 1 });
    if (second.ok && secondAgain.ok) {
      expect(second.item.id).toBe(secondAgain.item.id);
    }
  });

  it("pickSlayChargeForDay rejects missing/bad dates with a clear reason", () => {
    const missing = pickSlayChargeForDay({ dateIso: "" });
    const bad = pickSlayChargeForDay({ dateIso: "not-a-date" });
    expect(missing.ok).toBe(false);
    expect(bad.ok).toBe(false);
    if (!missing.ok) expect(missing.rejectReason).toBe("missing-date");
    if (!bad.ok) expect(bad.rejectReason).toBe("bad-date");
  });

  it("dropMorningVibeRows removes morning_vibe + morning_warmup + Soft-start rows", () => {
    const rows = [
      { id: 1, blockType: "morning_vibe", title: "Slay Charge ⚡" },
      { id: 2, blockType: "morning_warmup", title: "Soft start" },
      { id: 3, blockType: "math", title: "Decimals" },
      { id: 4, blockType: "read_aloud", title: "Charlotte's Web" },
      { id: 5, blockType: null, title: "Soft start" },
    ];
    const kept = dropMorningVibeRows(rows);
    expect(kept.map((r) => r.id)).toEqual([3, 4]);
  });

  it("dropMorningVibeRows tolerates non-array / empty input", () => {
    expect(dropMorningVibeRows([] as any)).toEqual([]);
    // @ts-expect-error — testing runtime defensive guard
    expect(dropMorningVibeRows(null)).toEqual([]);
  });
});
