import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROUTERS = readFileSync(
  join(__dirname, "routers.ts"),
  "utf8",
);

describe("Push 143 — bookshelf rollup tRPC wiring", () => {
  it("registers today.bookshelfRollup as a public procedure", () => {
    expect(ROUTERS).toMatch(/bookshelfRollup:\s*publicProcedure/);
  });

  it("imports rollupShelfProgress from the pure helper module", () => {
    expect(ROUTERS).toMatch(
      /import\s*\(\s*["']\.\/_lib\/bookReadingProgress["']\s*\)/,
    );
    expect(ROUTERS).toMatch(/rollupShelfProgress/);
  });

  it("accepts an optional sessions array with slug + page fields", () => {
    expect(ROUTERS).toMatch(/sessions:\s*z\s*\n?\s*\.array/);
    expect(ROUTERS).toMatch(/slug:\s*z\.string\(\)/);
    expect(ROUTERS).toMatch(/dayNumber:/);
  });

  it("accepts an optional prior page-map keyed by slug", () => {
    expect(ROUTERS).toMatch(/prior:\s*z\.record/);
  });

  it("does not introduce a separate db query helper for the rollup", () => {
    expect(ROUTERS).not.toMatch(/db\.bookshelfRollup\(/);
  });

  it("falls through cleanly when input is undefined", () => {
    expect(ROUTERS).toMatch(/input\?\.prior\s*\?\?\s*\{\}/);
    expect(ROUTERS).toMatch(/input\?\.sessions\s*\?\?\s*\[\]/);
  });

  it("is mounted inside today router (single source of truth for kid-side calls)", () => {
    const todayBlock = ROUTERS.split("today: router(")[1] ?? "";
    expect(todayBlock).toMatch(/bookshelfRollup/);
  });
});
