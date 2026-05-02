import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");

describe("Apps page mounts AppAccountsCard (adult-only)", () => {
  const appsPage = readFileSync(resolve(ROOT, "client/src/pages/Apps.tsx"), "utf8");

  it("imports AppAccountsCard from components", () => {
    expect(appsPage).toMatch(/import\s+AppAccountsCard\s+from\s+["']@\/components\/AppAccountsCard["']/);
  });

  it("renders the card behind the adult unlock", () => {
    // The mount should be inside an `unlocked && (` block
    const idx = appsPage.indexOf("<AppAccountsCard");
    expect(idx).toBeGreaterThan(0);
    const before = appsPage.slice(Math.max(0, idx - 600), idx);
    expect(before).toMatch(/unlocked\s*&&\s*\(/);
  });

  it("AppAccountsCard component still references reaganhiggs910@gmail.com", () => {
    const card = readFileSync(resolve(ROOT, "client/src/components/AppAccountsCard.tsx"), "utf8");
    expect(card).toContain("reaganhiggs910@gmail.com");
  });
});
