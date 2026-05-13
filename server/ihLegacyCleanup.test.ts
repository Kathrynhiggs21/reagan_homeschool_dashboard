import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Push 63 (2026-05-13) — IH / PowerSchool legacy cleanup, consolidated pass.
 *
 * Reagan exited Indian Hill in April 2026. Her @ihsd.us account is dead,
 * the PowerSchool integration was disconnected, and pages that surfaced
 * that data (UploadOrSync, Schedule's IH overlay, etc.) were deleted in
 * earlier pushes.
 *
 * This contract makes sure no one accidentally re-introduces a LIVE
 * dependency on the dead school account. It deliberately allows
 * historical comments + curriculum-provenance strings (e.g. "imported
 * from Wells PDF + Froehlich weekly updates") because that's factual
 * audit context Mom might want later.
 */

const ROOT = join(__dirname, "..");
const SERVER_DB = readFileSync(join(ROOT, "server", "db.ts"), "utf8");
const ROUTERS = readFileSync(join(ROOT, "server", "routers.ts"), "utf8");
const SEED = readFileSync(join(ROOT, "seed.mjs"), "utf8");

describe("IH / PowerSchool legacy cleanup — push 63", () => {
  it("no LIVE @ihsd.us allowlist regex in server code (comments OK)", () => {
    // We allow `// ... @ihsd.us ...` historical comments but reject any
    // /ihsd\.us/ regex literal inside an active code line.
    const lines = SERVER_DB.split("\n");
    for (const line of lines) {
      const trimmed = line.replace(/\/\/.*$/, ""); // strip line comment
      // A live regex literal will appear outside of comments.
      expect(trimmed).not.toMatch(/\/[^/]*ihsd\\\.us[^/]*\//);
    }
  });

  it("no LIVE `reagan.higgs33@ihsd.us` default in any code path", () => {
    // String literals containing the dead address are not allowed in
    // active code (comments are fine — they often explain the removal).
    const stripComments = (src: string) =>
      src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n")
        .map((l) => l.replace(/\/\/.*$/, ""))
        .join("\n");
    for (const [name, src] of [
      ["server/db.ts", SERVER_DB],
      ["server/routers.ts", ROUTERS],
      ["seed.mjs", SEED],
    ] as const) {
      const code = stripComments(src);
      expect(code, name).not.toMatch(/reagan\.higgs33@ihsd\.us/);
    }
  });

  it("dead PowerSchool/Indian-Hill pages stay deleted (no resurrection)", () => {
    const pagesDir = join(ROOT, "client", "src", "pages");
    for (const file of ["UploadOrSync.tsx", "DailyAgendas.tsx", "DailyPacket.tsx"]) {
      expect(existsSync(join(pagesDir, file))).toBe(false);
    }
  });

  it("seed.mjs no longer seeds PowerSchool data (only a historical comment)", () => {
    // Active seed code must not call a function literally named seedPowerSchool*.
    const stripComments = SEED.replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map((l) => l.replace(/\/\/.*$/, ""))
      .join("\n");
    expect(stripComments).not.toMatch(/seedPowerSchool\w*\s*\(/);
    expect(stripComments).not.toMatch(/insertPowerschoolAssignments\s*\(/);
  });

  it("IHThisWeekStrip and SkillBuilderTile remain inert (no IH-week pill)", () => {
    // Mirrors the existing ihBannerRemoved.test.ts so a refactor that
    // accidentally re-imports the strip into a page still fails.
    const stripSrc = readFileSync(
      join(ROOT, "client", "src", "components", "IHThisWeekStrip.tsx"),
      "utf8",
    );
    expect(stripSrc).toMatch(/return null;/);

    const tileSrc = readFileSync(
      join(ROOT, "client", "src", "components", "SkillBuilderTile.tsx"),
      "utf8",
    );
    expect(tileSrc).not.toContain("At Indian Hill this week");
  });

  it("no Analytics card calls PowerSchool tRPC procedures", () => {
    const analytics = readFileSync(
      join(ROOT, "client", "src", "pages", "Analytics.tsx"),
      "utf8",
    );
    // Comments are fine — strip them and assert no live useQuery call.
    const stripComments = analytics
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map((l) => l.replace(/\/\/.*$/, ""))
      .join("\n");
    expect(stripComments).not.toMatch(/trpc\.powerschool\.\w+\.useQuery/);
    expect(stripComments).not.toMatch(/<PowerSchoolGradesCard/);
  });
});
