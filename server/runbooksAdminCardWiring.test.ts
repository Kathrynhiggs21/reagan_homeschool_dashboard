/**
 * runbooksAdminCardWiring.test.ts — v3.19 (2026-05-30)
 *
 * Locks the integration seams for the new RunbooksAdminCard:
 *   - the component file exists with the expected API surface
 *   - it self-hides when registry is empty / query unavailable
 *   - Settings.tsx imports + mounts it (and only mounts it once)
 *   - it uses the right tRPC procedures (runbooks.list + runbooks.get)
 *   - it uses Streamdown to render markdown (not dangerouslySetInnerHTML)
 *
 * These are source-introspection tests (same pattern as
 * uiContractsKiwiAndApps.test.ts) since the project doesn't have
 * @testing-library/react.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");

function readFile(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("RunbooksAdminCard component", () => {
  const cardSource = readFile("client/src/components/RunbooksAdminCard.tsx");

  it("uses trpc.runbooks.list to fetch the registry", () => {
    expect(cardSource).toMatch(/runbooks\?\.list\?\.useQuery/);
  });

  it("uses trpc.runbooks.get to fetch a single runbook body", () => {
    expect(cardSource).toMatch(/runbooks\?\.get\?\.useQuery/);
  });

  it("renders the body via Streamdown (not dangerouslySetInnerHTML)", () => {
    expect(cardSource).toContain('import { Streamdown } from "streamdown"');
    expect(cardSource).toMatch(/<Streamdown>\{openRunbook\.body\}<\/Streamdown>/);
    expect(cardSource).not.toContain("dangerouslySetInnerHTML");
  });

  it("self-hides when registry is empty (returns null)", () => {
    // v3.20 renamed `runbooks` -> `allRunbooks` (since we now split by
    // dismissed). The self-hide still keys off the *total* registry size.
    expect(cardSource).toMatch(
      /if \(allRunbooks\.length === 0\) return null;/,
    );
  });

  it("self-hides when the trpc procedure is unavailable", () => {
    // listQ defaulted via `?.list?.useQuery?.` chain; if undefined, return null
    expect(cardSource).toMatch(/if \(!listQ\) return null;/);
  });

  it("exposes data-testid hooks for future DOM-level tests", () => {
    expect(cardSource).toContain('data-testid="runbooks-admin-card"');
    expect(cardSource).toContain('data-testid="runbooks-list"');
    expect(cardSource).toContain('data-testid="runbook-detail"');
    expect(cardSource).toContain('data-testid="runbook-back"');
  });

  it("only enables the detail query when a slug is open (no spurious fetches)", () => {
    expect(cardSource).toMatch(/enabled: !!openSlug/);
  });

  it("uses category tone classes that pair bg + text + border", () => {
    // Each tone must be a complete trio so contrast stays readable on light
    // backgrounds. Spot-check the email tone (which is the visible default).
    expect(cardSource).toMatch(
      /bg-rose-100 text-rose-900 border-rose-300/,
    );
  });

  it("admin-only — uses adminProcedure on the server side", () => {
    const routersSource = readFile("server/routers.ts");
    // The runbooks router block must define both procedures via adminProcedure
    expect(routersSource).toMatch(
      /runbooks: router\(\{[\s\S]*?list: adminProcedure\.query/,
    );
    expect(routersSource).toMatch(
      /get: adminProcedure[\s\S]*?slug: z\.string\(\)\.min\(1\)\.max\(120\)/,
    );
  });

  it("admin procedure imports runbooks module lazily (no top-of-file dep)", () => {
    const routersSource = readFile("server/routers.ts");
    // Lazy import keeps the cold-start budget low — runbooks module is only
    // pulled in when an admin actually visits the Settings card.
    expect(routersSource).toMatch(
      /await import\(["']\.\/_lib\/runbooks["']\)/,
    );
  });
});

describe("Settings page wires the card", () => {
  const settingsSource = readFile("client/src/pages/Settings.tsx");

  it("imports RunbooksAdminCard from components/", () => {
    expect(settingsSource).toContain(
      'import RunbooksAdminCard from "@/components/RunbooksAdminCard"',
    );
  });

  it("mounts RunbooksAdminCard exactly once", () => {
    const occurrences = settingsSource.match(/<RunbooksAdminCard\s*\/>/g);
    expect(occurrences).not.toBeNull();
    expect(occurrences?.length ?? 0).toBe(1);
  });

  it("mounts the card OUTSIDE the 5-tab streamlined layout (so it doesn't clutter Mom's tabs)", () => {
    const cardIdx = settingsSource.indexOf("<RunbooksAdminCard");
    const tabsCloseIdx = settingsSource.lastIndexOf("</Tabs>");
    expect(cardIdx).toBeGreaterThan(-1);
    expect(tabsCloseIdx).toBeGreaterThan(-1);
    expect(cardIdx).toBeGreaterThan(tabsCloseIdx);
  });
});
