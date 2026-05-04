import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

/**
 * Mom asked May 2026 — pre-tomorrow audit fixes #3 (block detail link-up),
 * #4 (page references), #5 (tutor-of-day strip), and #6 (one-tap Apple-Pencil
 * draw-over-worksheet button). None of those have a server-side handler we
 * can hit directly, so this file does a lightweight source-surface check
 * against the relevant client files. If a future edit drops one of these
 * features the test fails loudly, instead of us only finding out the next
 * morning when Reagan goes to use it.
 */
const ROOT = resolve(__dirname, "..");
const TODAY = resolve(ROOT, "client/src/pages/Today.tsx");
const PACKET = resolve(ROOT, "client/src/pages/DailyPacket.tsx");
const TURN_IN = resolve(ROOT, "client/src/components/TurnInDialog.tsx");

function read(path: string): string {
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf-8");
}

describe("UI audit surface (Mom's pre-tomorrow checklist)", () => {
  it("Today exposes the ✏️ Draw on it quick action wired to TurnInDialog initialMode='draw'", () => {
    const src = read(TODAY);
    expect(src.length).toBeGreaterThan(1000);
    expect(src).toContain("✏️ Draw on it");
    expect(src).toMatch(/initialMode:\s*"draw"/);
  });

  it("Today still renders the standard 📝 Turn in flow alongside the new draw action", () => {
    const src = read(TODAY);
    expect(src).toContain("📝 Turn in");
  });

  it("Today injects the tutor-of-day strip and survives the one-line greeting refactor", () => {
    const src = read(TODAY);
    expect(src.toLowerCase()).toContain("tutorofday");
  });

  it("DailyPacket prints page references (e.g., pg 24-28) for every block that has them", () => {
    const src = read(PACKET);
    expect(src.length).toBeGreaterThan(500);
    expect(src.toLowerCase()).toMatch(/pageref|pages?:/);
  });

  it("TurnInDialog accepts initialMode and threads it through the open-reset effect", () => {
    const src = read(TURN_IN);
    expect(src).toContain("initialMode");
    expect(src).toMatch(/setMode\(\s*initialMode\s*\?\?/);
  });
});
