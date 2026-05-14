/**
 * Push 155 (2026-05-14) — wiring contract for today.goodMorningGreeting.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Push 155 — today.goodMorningGreeting wiring", () => {
  const src = readFileSync(resolve(__dirname, "routers.ts"), "utf-8");

  it("today.goodMorningGreeting is a publicProcedure", () => {
    const idx = src.indexOf("goodMorningGreeting: publicProcedure");
    expect(idx).toBeGreaterThan(0);
  });

  it("wires pickGoodMorningGreeting from goodMorningReagan", () => {
    const idx = src.indexOf("goodMorningGreeting: publicProcedure");
    const window = src.slice(idx, idx + 1500);
    expect(window).toMatch(/pickGoodMorningGreeting/);
    expect(window).toMatch(/_lib\/goodMorningReagan/);
  });

  it("falls back to today's ISO when caller omits dateISO", () => {
    const idx = src.indexOf("goodMorningGreeting: publicProcedure");
    const window = src.slice(idx, idx + 1500);
    expect(window).toMatch(
      /input\?\.dateISO \?\? new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/,
    );
  });

  it("accepts forceKind override for all 5 kinds", () => {
    const idx = src.indexOf("goodMorningGreeting: publicProcedure");
    const window = src.slice(idx, idx + 2000);
    for (const kind of [
      "joke",
      "fun_fact",
      "riddle",
      "silly_thought",
      "kind_thought",
    ]) {
      expect(window).toMatch(new RegExp(`"${kind}"`));
    }
  });
});
