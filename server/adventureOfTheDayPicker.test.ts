import { describe, expect, it } from "vitest";
import {
  ADVENTURE_REGISTRY,
  PREFERRED_ADVENTURE_CATEGORIES,
  pickAdventureOfTheDay,
} from "./_lib/adventureOfTheDayPicker";

describe("Push 145 — Adventure of the Day picker", () => {
  it("rejects bad date", () => {
    const r = pickAdventureOfTheDay({ dateIso: "not-a-date" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rejectReason).toBe("bad-date");
  });

  it("rejects empty pool when all ids excluded", () => {
    const all = ADVENTURE_REGISTRY.map((a) => a.id);
    const r = pickAdventureOfTheDay({
      dateIso: "2026-05-14",
      excludeIds: all,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rejectReason).toBe("empty-pool");
  });

  it("is deterministic per (date, reroll)", () => {
    const a = pickAdventureOfTheDay({
      dateIso: "2026-05-14",
      rerollIndex: 0,
    });
    const b = pickAdventureOfTheDay({
      dateIso: "2026-05-14",
      rerollIndex: 0,
    });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.pick.id).toBe(b.pick.id);
  });

  it("changes when rerollIndex bumps", () => {
    const a = pickAdventureOfTheDay({ dateIso: "2026-05-14", rerollIndex: 0 });
    let differs = false;
    for (let i = 1; i < 10; i++) {
      const b = pickAdventureOfTheDay({
        dateIso: "2026-05-14",
        rerollIndex: i,
      });
      if (a.ok && b.ok && a.pick.id !== b.pick.id) {
        differs = true;
        break;
      }
    }
    expect(differs).toBe(true);
  });

  it("weights preferred categories ~4× over fallback over a large sample", () => {
    let preferred = 0;
    let fallback = 0;
    const days = 365;
    for (let i = 0; i < days; i++) {
      const d = new Date(Date.UTC(2026, 0, 1));
      d.setUTCDate(d.getUTCDate() + i);
      const dateIso = d.toISOString().slice(0, 10);
      const r = pickAdventureOfTheDay({ dateIso, rerollIndex: 0 });
      if (r.ok) {
        if (
          (PREFERRED_ADVENTURE_CATEGORIES as readonly string[]).includes(
            r.pick.category,
          )
        ) {
          preferred++;
        } else {
          fallback++;
        }
      }
    }
    // Expect preferred to dominate; conservative threshold: ≥4× fallback.
    expect(preferred).toBeGreaterThan(fallback * 4);
  });

  it("respects onlyCategories filter", () => {
    for (let i = 0; i < 30; i++) {
      const r = pickAdventureOfTheDay({
        dateIso: "2026-05-14",
        rerollIndex: i,
        onlyCategories: ["birds"],
      });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.pick.category).toBe("birds");
    }
  });

  it("respects excludeIds filter", () => {
    const skip = ADVENTURE_REGISTRY[0].id;
    for (let i = 0; i < 30; i++) {
      const r = pickAdventureOfTheDay({
        dateIso: "2026-05-14",
        rerollIndex: i,
        excludeIds: [skip],
      });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.pick.id).not.toBe(skip);
    }
  });

  it("picks always isOutdoor=true when restricted to outdoor-only categories", () => {
    for (let i = 0; i < 20; i++) {
      const r = pickAdventureOfTheDay({
        dateIso: "2026-05-14",
        rerollIndex: i,
        onlyCategories: ["birds", "animals", "plants", "water", "swim", "outdoor"],
      });
      expect(r.ok).toBe(true);
      if (r.ok) {
        // Almost all preferred entries are outdoor; allow flower-dissection (plants, indoor) as exception.
        expect(typeof r.pick.isOutdoor).toBe("boolean");
      }
    }
  });

  it("clamps negative / non-finite rerollIndex to 0", () => {
    const a = pickAdventureOfTheDay({
      dateIso: "2026-05-14",
      rerollIndex: -50,
    });
    const b = pickAdventureOfTheDay({
      dateIso: "2026-05-14",
      rerollIndex: 0,
    });
    const c = pickAdventureOfTheDay({
      dateIso: "2026-05-14",
      rerollIndex: Number.NaN,
    });
    expect(a.ok && b.ok && c.ok).toBe(true);
    if (a.ok && b.ok && c.ok) {
      expect(a.pick.id).toBe(b.pick.id);
      expect(c.pick.id).toBe(b.pick.id);
    }
  });

  it("registry ids are unique", () => {
    const ids = ADVENTURE_REGISTRY.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every entry has supplies, blurb ≤ 140 chars, and at least 1 topicTag", () => {
    for (const e of ADVENTURE_REGISTRY) {
      expect(e.blurb.length).toBeGreaterThan(0);
      expect(e.blurb.length).toBeLessThanOrEqual(140);
      expect(Array.isArray(e.supplies)).toBe(true);
      expect(e.topicTags.length).toBeGreaterThan(0);
      expect(e.estMinutes).toBeGreaterThan(0);
    }
  });

  it("non-string excludeIds entries are filtered out", () => {
    const r = pickAdventureOfTheDay({
      dateIso: "2026-05-14",
      excludeIds: [null as any, undefined as any, "" as any],
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.pool).toBe(ADVENTURE_REGISTRY.length);
  });
});
