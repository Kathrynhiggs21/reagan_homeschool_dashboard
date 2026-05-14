/**
 * Push 155 (2026-05-14) — vitest contract for the "Good Morning, Reagan!"
 * pure helper. Covers determinism, kid-readable rules (no warm-up/test
 * framing, single-bang greeting), forceKind override, customPool empty
 * fallback, kid-name override, and bad date guard.
 */
import { describe, it, expect } from "vitest";
import {
  pickGoodMorningGreeting,
  __INTERNAL_DEFAULT_POOL_SIZE,
} from "./_lib/goodMorningReagan";

describe("Push 155 — pickGoodMorningGreeting", () => {
  it("returns a deterministic greeting for the same date + name", () => {
    const a = pickGoodMorningGreeting("2026-05-14");
    const b = pickGoodMorningGreeting("2026-05-14");
    expect(a).toEqual(b);
  });

  it("rotates the pick across consecutive days (sample 14)", () => {
    const greetings = new Set<string>();
    for (let i = 0; i < 14; i++) {
      const day = `2026-05-${String(i + 1).padStart(2, "0")}`;
      greetings.add(pickGoodMorningGreeting(day).greeting);
    }
    // We don't require all 14 distinct (small pool collisions possible)
    // but a healthy rotation should easily produce 8+ distinct greetings.
    expect(greetings.size).toBeGreaterThanOrEqual(8);
  });

  it("greeting always opens with 'Good morning, Reagan!' by default", () => {
    for (const day of ["2026-01-01", "2026-05-14", "2026-12-31"]) {
      expect(pickGoodMorningGreeting(day).greeting).toMatch(
        /^Good morning, Reagan! /,
      );
    }
  });

  it("never includes warm-up / test framing words", () => {
    for (let i = 1; i <= 28; i++) {
      const day = `2026-02-${String(i).padStart(2, "0")}`;
      const g = pickGoodMorningGreeting(day);
      const haystack = `${g.greeting} ${g.payload} ${g.payoff ?? ""}`.toLowerCase();
      for (const banned of [
        "warm-up",
        "warmup",
        "review yesterday",
        "did you get it right",
        "test ",
        "quiz",
        "you have 2 minutes",
      ]) {
        expect(haystack).not.toContain(banned);
      }
    }
  });

  it("greeting prefix uses exactly one '!' (single-bang rule)", () => {
    for (let i = 1; i <= 31; i++) {
      const day = `2026-03-${String(i).padStart(2, "0")}`;
      const greeting = pickGoodMorningGreeting(day).greeting;
      // The "Good morning, Reagan!" prefix contributes the only !, the
      // payload itself is curated to not include any.
      const bangs = (greeting.match(/!/g) ?? []).length;
      expect(bangs).toBeLessThanOrEqual(1);
    }
  });

  it("forceKind = 'joke' always returns a joke entry", () => {
    for (let i = 1; i <= 28; i++) {
      const day = `2026-04-${String(i).padStart(2, "0")}`;
      const g = pickGoodMorningGreeting(day, { forceKind: "joke" });
      expect(g.kind).toBe("joke");
      expect(g.iconHint).toBe("star");
      expect(g.accent).toBe("yellow");
      expect(g.payoff).toBeTruthy();
    }
  });

  it("forceKind = 'kind_thought' returns no payoff (one-line greeting)", () => {
    const g = pickGoodMorningGreeting("2026-05-14", { forceKind: "kind_thought" });
    expect(g.kind).toBe("kind_thought");
    expect(g.payoff).toBeUndefined();
    expect(g.iconHint).toBe("heart");
    expect(g.accent).toBe("green");
  });

  it("kidName override is reflected in the greeting prefix + sanitized", () => {
    const g = pickGoodMorningGreeting("2026-05-14", { kidName: "  Tutor    Pal  " });
    expect(g.greeting.startsWith("Good morning, Tutor Pal!")).toBe(true);
  });

  it("empty kidName falls back to 'Reagan'", () => {
    const g = pickGoodMorningGreeting("2026-05-14", { kidName: "   " });
    expect(g.greeting.startsWith("Good morning, Reagan!")).toBe(true);
  });

  it("empty customPool falls back to a soft kind_thought (no throw)", () => {
    const g = pickGoodMorningGreeting("2026-05-14", { customPool: [] });
    expect(g.kind).toBe("kind_thought");
    expect(g.greeting).toContain("Good morning, Reagan!");
  });

  it("customPool with one entry is always picked", () => {
    const g = pickGoodMorningGreeting("2026-05-14", {
      customPool: [{ kind: "fun_fact", text: "Pumpkins are berries too." }],
    });
    expect(g.payload).toBe("Pumpkins are berries too.");
    expect(g.kind).toBe("fun_fact");
  });

  it("throws kid-readable error on a bad date string", () => {
    expect(() => pickGoodMorningGreeting("nope" as never)).toThrow(/YYYY-MM-DD/);
    expect(() => pickGoodMorningGreeting("" as never)).toThrow(/YYYY-MM-DD/);
    expect(() => pickGoodMorningGreeting("2026-5-14" as never)).toThrow(/YYYY-MM-DD/);
  });

  it("default pool is healthy (>= 50 curated entries)", () => {
    expect(__INTERNAL_DEFAULT_POOL_SIZE).toBeGreaterThanOrEqual(50);
  });

  it("iconHint + accent always agree per kind across the whole pool", () => {
    const seen = new Map<string, string>();
    for (let i = 1; i <= 30; i++) {
      const day = `2026-06-${String(i).padStart(2, "0")}`;
      const g = pickGoodMorningGreeting(day);
      const key = g.kind;
      const value = `${g.iconHint}|${g.accent}`;
      const prior = seen.get(key);
      if (prior) {
        expect(value).toBe(prior);
      } else {
        seen.set(key, value);
      }
    }
  });

  it("seed differs by kid name (Reagan vs other)", () => {
    const a = pickGoodMorningGreeting("2026-05-14", { kidName: "Reagan" });
    const b = pickGoodMorningGreeting("2026-05-14", { kidName: "Other" });
    // Not guaranteed always different (hash collision possible), but for
    // a curated 60+ entry pool a single-day seed change should land in a
    // different slot the vast majority of the time. Try a few days.
    let differentDays = 0;
    for (let i = 1; i <= 10; i++) {
      const day = `2026-07-${String(i).padStart(2, "0")}`;
      const x = pickGoodMorningGreeting(day, { kidName: "Reagan" });
      const y = pickGoodMorningGreeting(day, { kidName: "Other" });
      if (x.greeting !== y.greeting) differentDays++;
    }
    expect(differentDays).toBeGreaterThanOrEqual(5);
    // Sanity-check a + b not both undefined.
    expect(a.greeting).toBeTruthy();
    expect(b.greeting).toBeTruthy();
  });
});
