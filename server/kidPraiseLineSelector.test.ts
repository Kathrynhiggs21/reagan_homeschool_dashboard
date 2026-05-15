import { describe, it, expect } from "vitest";
import {
  selectPraiseLine,
  isLineSafe,
  __FOR_TEST__,
  type PraiseContext,
} from "./_lib/kidPraiseLineSelector";

const ALL_CONTEXTS: PraiseContext[] = [
  "book_finished",
  "chapter_book_finished",
  "reading_streak",
  "lesson_done",
  "doodle_saved",
  "vault_healthy",
  "screen_time_wrap",
  "app_login_success",
  "mood_pulse_positive",
  "great_day",
];

describe("Push 200 — kidPraiseLineSelector", () => {
  it("returns a non-empty line for every context", () => {
    for (const ctx of ALL_CONTEXTS) {
      const r = selectPraiseLine({ context: ctx, seed: "2026-05-14" });
      expect(r.text.length).toBeGreaterThan(0);
      expect(r.pillar).toBeTruthy();
    }
  });

  it("substitutes {name} with kidName", () => {
    const r = selectPraiseLine({
      context: "book_finished",
      seed: "x",
      kidName: "Reagan",
    });
    expect(r.text).toContain("Reagan");
    expect(r.text).not.toContain("{name}");
  });

  it("defaults kidName to Reagan when omitted", () => {
    const r = selectPraiseLine({ context: "book_finished", seed: "x" });
    expect(r.text).toContain("Reagan");
  });

  it("custom kidName works (Mom, Grandma, sibling, etc.)", () => {
    const r = selectPraiseLine({
      context: "great_day",
      seed: "x",
      kidName: "Marcy",
    });
    expect(r.text).toContain("Marcy");
    expect(r.text).not.toContain("Reagan");
  });

  it("same (context+seed) ⇒ same line (deterministic)", () => {
    const a = selectPraiseLine({ context: "book_finished", seed: "2026-05-14" });
    const b = selectPraiseLine({ context: "book_finished", seed: "2026-05-14" });
    expect(a).toEqual(b);
  });

  it("different seeds rotate through the pool over time", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const r = selectPraiseLine({ context: "book_finished", seed: `seed-${i}` });
      seen.add(r.text);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("every line in every pool is safe (no forbidden words)", () => {
    for (const [ctx, pool] of Object.entries(__FOR_TEST__.POOLS)) {
      for (const line of pool) {
        const sample = line.text.replace(/{name}/g, "Reagan");
        expect(isLineSafe(sample), `unsafe line in ${ctx}: "${sample}"`).toBe(true);
      }
    }
  });

  it("every line uses one of the four pillars", () => {
    const allowed = new Set(["feel_safe", "understand", "grow_on_purpose", "you_are_smart"]);
    for (const pool of Object.values(__FOR_TEST__.POOLS)) {
      for (const line of pool) {
        expect(allowed.has(line.pillar)).toBe(true);
      }
    }
  });

  it("every pool has at least 3 lines", () => {
    for (const [ctx, pool] of Object.entries(__FOR_TEST__.POOLS)) {
      expect(pool.length, `pool ${ctx} too short`).toBeGreaterThanOrEqual(3);
    }
  });

  it("hashSeed is stable + uniform-ish", () => {
    const a = __FOR_TEST__.hashSeed("hello");
    const b = __FOR_TEST__.hashSeed("hello");
    const c = __FOR_TEST__.hashSeed("world");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("isLineSafe flags forbidden words", () => {
    expect(isLineSafe("you didn't fail today")).toBe(false);
    expect(isLineSafe("you are dumb sometimes")).toBe(false);
    expect(isLineSafe("nice work on the lesson")).toBe(true);
  });

  it("isLineSafe is case-insensitive", () => {
    expect(isLineSafe("That was DUMB")).toBe(false);
    expect(isLineSafe("you should HAVE done it")).toBe(false);
  });

  it("never produces output containing forbidden words for any context", () => {
    for (const ctx of ALL_CONTEXTS) {
      for (let i = 0; i < 25; i++) {
        const r = selectPraiseLine({ context: ctx, seed: `s${i}` });
        expect(isLineSafe(r.text), `unsafe output in ${ctx}: "${r.text}"`).toBe(true);
      }
    }
  });

  it("falls back gracefully on unknown context", () => {
    const r = selectPraiseLine({
      context: "totally_made_up" as PraiseContext,
      seed: "x",
    });
    expect(r.text).toContain("Reagan");
    expect(r.pillar).toBe("feel_safe");
  });

  it("FORBIDDEN list contains the most important blockers", () => {
    const list = __FOR_TEST__.FORBIDDEN;
    expect(list).toContain("fail");
    expect(list).toContain("dumb");
    expect(list).toContain("not enough");
    expect(list).toContain("behind");
  });

  it("output always ends with a sentence-ish character", () => {
    for (const ctx of ALL_CONTEXTS) {
      const r = selectPraiseLine({ context: ctx, seed: "today" });
      expect(r.text).toMatch(/[.!?]$/);
    }
  });

  it("output is short enough for a kid's quick read (<= 120 chars)", () => {
    for (const ctx of ALL_CONTEXTS) {
      for (let i = 0; i < 10; i++) {
        const r = selectPraiseLine({ context: ctx, seed: `s${i}` });
        expect(r.text.length, `too long in ${ctx}: ${r.text}`).toBeLessThanOrEqual(120);
      }
    }
  });

  it("celebratory contexts skew toward growth/safety pillars", () => {
    const counts: Record<string, number> = {};
    for (const line of __FOR_TEST__.POOLS.great_day) counts[line.pillar] = (counts[line.pillar] ?? 0) + 1;
    expect(
      (counts.grow_on_purpose ?? 0) + (counts.you_are_smart ?? 0) + (counts.feel_safe ?? 0),
    ).toBe(__FOR_TEST__.POOLS.great_day.length);
  });

  it("vault_healthy lines never describe Reagan as responsible for adult security", () => {
    for (const line of __FOR_TEST__.POOLS.vault_healthy) {
      const lower = line.text.toLowerCase();
      expect(lower).not.toContain("you forgot");
      expect(lower).not.toContain("you need to");
    }
  });
});
