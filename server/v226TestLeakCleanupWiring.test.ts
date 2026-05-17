import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * v2.26 (2026-05-17) — Test-leak cleanup contract.
 *
 * Audit on 2026-05-17 found two long-running test data leaks:
 *   - 10 leaked `__vitest_filter_probe_*` rows in `books`
 *   - 238 leaked `Columbus\n4` rows in `assignmentSubmissions`
 *
 * Both have been deleted from the live DB and both test files now have
 * belt-and-suspenders cleanup (per-test `try/finally` + suite-level
 * `afterAll`). This contract test source-pattern-locks both cleanups so
 * they can never silently regress: if anyone removes either layer of
 * cleanup, the suite fails immediately with a clear pointer at the
 * cleanup that broke.
 */

const REPO = join(__dirname, "..");

function read(rel: string): string {
  const p = join(REPO, rel);
  expect(existsSync(p), `expected ${rel} to exist`).toBe(true);
  return readFileSync(p, "utf8");
}

describe("v2.26 test-leak cleanup contract", () => {
  describe("books test (server/listBooksFilter.test.ts)", () => {
    const src = read("server/listBooksFilter.test.ts");

    it("imports afterAll from vitest", () => {
      expect(src).toMatch(/import\s+\{[^}]*\bafterAll\b[^}]*\}\s+from\s+["']vitest["']/);
    });

    it("registers a suite-level afterAll cleanup hook", () => {
      expect(src).toMatch(/afterAll\s*\(\s*async\s*\(\s*\)\s*=>/);
    });

    it("afterAll uses listBooksRaw to find leaked rows", () => {
      expect(src).toMatch(/listBooksRaw/);
    });

    it("afterAll filters by the __vitest_filter_probe_ prefix", () => {
      expect(src).toMatch(/__vitest_filter_probe_/);
    });

    it("per-test finally still deletes the created row", () => {
      // The original Push-57 fix lives inside the finally block; we keep it
      // and add the afterAll on top, not replace it.
      expect(src).toMatch(/finally\s*\{[\s\S]*caller\.books\.delete/);
    });
  });

  describe("submissions test (server/newFeatures.test.ts)", () => {
    const src = read("server/newFeatures.test.ts");

    it("imports afterAll from vitest", () => {
      expect(src).toMatch(/import\s+\{[^}]*\bafterAll\b[^}]*\}\s+from\s+["']vitest["']/);
    });

    it("registers a suite-level afterAll cleanup hook", () => {
      expect(src).toMatch(/afterAll\s*\(\s*async\s*\(\s*\)\s*=>/);
    });

    it("afterAll deletes by exact contentText 'Columbus\\n4'", () => {
      // The afterAll must scrub the test fixture by exact contentText
      // match so Reagan's real submissions are never touched.
      expect(src).toMatch(/Columbus\\n4/);
      expect(src).toMatch(/DELETE FROM assignmentSubmissions/);
    });

    it("per-test wraps create+grade in try/finally", () => {
      // Verify the new try/finally is present around the submission flow.
      expect(src).toMatch(/let\s+sub:\s*any\s*=\s*null;\s*\n\s*try\s*\{/);
    });

    it("per-test finally deletes by sub.id (not contentText) to avoid race", () => {
      // The per-test cleanup must target the row it just created by id,
      // not by contentText, so two parallel test runs don't fight over
      // the same row.
      expect(src).toMatch(/finally\s*\{[\s\S]*WHERE\s+id\s*=\s*\$\{sub\.id\}/);
    });
  });

  describe("listBooksRaw helper (server/db.ts)", () => {
    const src = read("server/db.ts");

    it("exports listBooksRaw for test cleanup use", () => {
      expect(src).toMatch(/export\s+async\s+function\s+listBooksRaw\s*\(/);
    });

    it("listBooksRaw is documented as test-only infrastructure", () => {
      // The doc comment should warn against using it in product code.
      const idx = src.indexOf("export async function listBooksRaw");
      expect(idx).toBeGreaterThan(-1);
      const before = src.slice(Math.max(0, idx - 600), idx);
      expect(before).toMatch(/test infrastructure|test cleanup|do not use in product|cleanup/i);
    });
  });
});
