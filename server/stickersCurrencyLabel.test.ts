import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Currency label contract: per todo item 1421, the kid-facing currency on the
 * Sticker Book page must read "Kiwi Coins" (not the older "Feathers" copy).
 * Backend column names are intentionally NOT changed — only UI strings.
 */

const STICKERS = path.resolve(__dirname, "..", "client/src/pages/Stickers.tsx");

describe("Stickers currency label", () => {
  it("uses 'Kiwi Coins' and never 'Feathers' as a visible label", () => {
    const src = fs.readFileSync(STICKERS, "utf8");
    expect(src).toContain("Kiwi Coins");
    // No literal label "Feathers" — comments/lines that mention it are also gone.
    // Allow the emoji 🪶 (still kiwi-themed) but the word must be absent.
    expect(/Feathers/i.test(src)).toBe(false);
  });
});
