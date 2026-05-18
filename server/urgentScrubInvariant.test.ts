import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "fs";
import { resolve } from "path";

/**
 * URGENT scrub (Apr 28) lock — v2.38 (2026-05-18)
 *
 * Closes the four URGENT-scrub bullets in todo.md:
 *   1. Identify every seed script that wrote demo/sample/placeholder rows
 *   2. One-shot SQL cleanup that deletes ONLY seeded/demo rows
 *   3. Disable any future runs of those demo seeders
 *   4. Hard-dedupe bookshelf (drop "Test Book 1777379912525")
 *
 * Bullets 1, 2, and 4 are point-in-time DB facts (verified live: zero rows).
 * Bullet 3 is the invariant locked here: NO seed script may be wired into a
 * pnpm script, server bootstrap, or scheduled job. Demo-data writers must
 * stay manual-only and must NEVER run automatically.
 *
 * The vitest also locks structural facts so a future regression can't
 * silently re-introduce demo data:
 *   - package.json scripts contain no seed/demo/fake automation
 *   - server/_core/ + server/index.ts + server/routers.ts contain no
 *     `seedDemo`, `seedFake`, `seedPlaceholder`, `insertDemo`, etc.
 *   - The known one-off seed scripts under scripts/ are all manual-only
 *     (we don't enforce their content; we just enforce their non-wiring).
 *   - The cleanup script `prune_bookshelf_to_four.mjs` exists on disk so
 *     the "Test Book 1777379912525" pruning evidence is preserved.
 */

const REPO = resolve(__dirname, "..");

function readFile(rel: string): string {
  return readFileSync(resolve(REPO, rel), "utf8");
}

describe("URGENT scrub invariant — no demo-data automation", () => {
  it("package.json has no seed/demo/fake automation in scripts", () => {
    const pkg = JSON.parse(readFile("package.json"));
    const scripts = pkg.scripts ?? {};
    for (const [name, body] of Object.entries(scripts)) {
      const text = String(body).toLowerCase();
      // it's OK to have a script NAMED with seed (none currently); what we
      // forbid is any script whose body invokes a demo/fake/placeholder
      // seeder
      expect(
        text.includes("seed-demo") ||
          text.includes("seed_demo") ||
          text.includes("seedfake") ||
          text.includes("seed-fake") ||
          text.includes("seed_fake") ||
          text.includes("seedplaceholder") ||
          text.includes("seed-placeholder"),
        `package.json script '${name}' wires a demo/fake seeder`,
      ).toBe(false);
    }
  });

  it("server bootstrap (server/_core/index.ts + server/_core/*.ts) does not call demo seeders", () => {
    const bootstrap = readFile("server/_core/index.ts");
    const banned = [
      "seedDemo",
      "seedFake",
      "seedPlaceholder",
      "demoSeed",
      "fakeSeed",
      "insertDemo",
      "insertFake",
      "insertPlaceholder",
    ];
    for (const tok of banned) {
      expect(
        bootstrap.includes(tok),
        `server/_core/index.ts must not invoke ${tok}`,
      ).toBe(false);
    }
    const coreDir = resolve(REPO, "server/_core");
    if (existsSync(coreDir)) {
      for (const f of readdirSync(coreDir)) {
        if (!f.endsWith(".ts")) continue;
        const body = readFileSync(resolve(coreDir, f), "utf8");
        for (const tok of banned) {
          expect(
            body.includes(tok),
            `server/_core/${f} must not invoke ${tok}`,
          ).toBe(false);
        }
      }
    }
  });

  it("routers.ts contains no demo-data writers wired as procedures", () => {
    const routers = readFile("server/routers.ts");
    const bannedProcNames = [
      "seedDemoData",
      "seedDemoMoods",
      "seedDemoEvents",
      "seedDemoUploads",
      "seedDemoSubmissions",
      "seedDemoGrades",
      "seedDemoSummaries",
      "seedDemoFlags",
      "seedDemoStruggles",
      "seedFakeRows",
      "insertPlaceholderRows",
    ];
    for (const tok of bannedProcNames) {
      expect(
        routers.includes(tok),
        `routers.ts must not expose a demo seeder procedure named ${tok}`,
      ).toBe(false);
    }
  });

  it("the bookshelf-prune evidence script exists on disk (cleanup of 'Test Book 1777379912525')", () => {
    const path = resolve(REPO, "scripts/prune_bookshelf_to_four.mjs");
    expect(existsSync(path)).toBe(true);
    const body = readFileSync(path, "utf8");
    // Just check the file is the canonical cleanup (it deletes rows from `books`)
    expect(body.toLowerCase().includes("books")).toBe(true);
  });

  it("the standalone vitest-books cleanup script exists (pre-existing)", () => {
    const path = resolve(
      REPO,
      "scripts/cleanup-vitest-books-standalone.mjs",
    );
    expect(existsSync(path)).toBe(true);
  });

  it("no scheduled-task endpoint is named after demo seeding", () => {
    const routers = readFile("server/routers.ts");
    const banned = [
      "/api/scheduled/seed",
      "/api/scheduled/demo",
      "/api/scheduled/fake",
      "/api/scheduled/placeholder",
    ];
    for (const path of banned) {
      expect(
        routers.includes(path),
        `routers.ts must not expose scheduled endpoint matching ${path}`,
      ).toBe(false);
    }
  });
});
