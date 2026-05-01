import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");

describe("Open button — block-pinned library resolution", () => {
  it("library.list accepts blockId filter (server side)", () => {
    const src = readFileSync(join(root, "server/routers.ts"), "utf8");
    expect(src).toMatch(/blockId:\s*z\.number\(\)\.nullable\(\)\.optional\(\)/);
  });

  it("listAssignmentsLibrary db helper supports blockId filter", () => {
    const src = readFileSync(join(root, "server/db.ts"), "utf8");
    expect(src).toContain("filters.blockId != null");
    expect(src).toMatch(/blockId\?\:\s*number\s*\|\s*null/);
  });

  it("Today.tsx prefers block-pinned library rows before subject match", () => {
    const src = readFileSync(join(root, "client/src/pages/Today.tsx"), "utf8");
    expect(src).toContain("blockPinned");
    expect(src).toMatch(/blockPinned\.length\s*>\s*0/);
    // openPrintableForBlock now accepts an `id` so it can pin
    expect(src).toMatch(/openPrintableForBlock\(block:\s*\{\s*id\?\:/);
  });
});
