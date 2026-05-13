import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

/**
 * Push 62 (2026-05-13) — Lock CurriculumCoverageArcs as the visual layer for
 * curriculum catalog coverage on the Analytics page.
 *
 * What this contract enforces:
 *  1. The component file exists and exports the SUBJECT_ARC_COLOR palette
 *     covering all six canonical TitleCase subjects returned by
 *     curriculumProgress() in server/db.ts.
 *  2. The "don't show if no info" rule is wired (returns null when there
 *     are no rows OR when total topics across subjects is 0).
 *  3. Analytics.tsx mounts it (so adults actually see it).
 *  4. It reads from `trpc.curriculum.progress` (NOT a new bespoke RPC —
 *     reusing the existing procedure keeps server churn at zero).
 */

const ARC = readFileSync(
  path.join(__dirname, "..", "client", "src", "components", "CurriculumCoverageArcs.tsx"),
  "utf8",
);
const ANALYTICS = readFileSync(
  path.join(__dirname, "..", "client", "src", "pages", "Analytics.tsx"),
  "utf8",
);

describe("CurriculumCoverageArcs — push 62 contract", () => {
  it("file exists and exports SUBJECT_ARC_COLOR", () => {
    expect(ARC).toMatch(/export const SUBJECT_ARC_COLOR/);
  });

  for (const subject of ["Math", "ELA", "Science", "Social", "Specials", "Other"]) {
    it(`palette covers subject "${subject}" (TitleCase from curriculumProgress() SQL)`, () => {
      // Match `Subject: "#xxxxxx"` (with optional whitespace).
      const re = new RegExp(`${subject}:\\s*"#[0-9a-fA-F]{3,8}"`);
      expect(ARC).toMatch(re);
    });
  }

  it("uses trpc.curriculum.progress (no bespoke new procedure)", () => {
    expect(ARC).toMatch(/trpc\.curriculum\.progress\.useQuery/);
  });

  it("respects don't-show-if-no-info rule (returns null on empty)", () => {
    expect(ARC).toMatch(/if\s*\(ordered\.length === 0 \|\| totalAcross === 0\)\s*return null/);
  });

  it("Analytics.tsx imports and mounts the widget", () => {
    expect(ANALYTICS).toMatch(/from "@\/components\/CurriculumCoverageArcs"/);
    expect(ANALYTICS).toMatch(/<CurriculumCoverageArcs\s*\/>/);
  });

  it("renders a numeric overall pct line in the header", () => {
    expect(ARC).toMatch(/overallPct/);
    expect(ARC).toMatch(/% overall/);
  });
});
