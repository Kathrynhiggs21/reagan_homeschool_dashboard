import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * v2.41 (2026-05-18) — Per-topic progress arcs MUST live on the Analytics
 * page, not on the Curriculum Hub. This test red-flags any future commit
 * that re-introduces the mount on Curriculum, drops it from Analytics, or
 * deletes the component itself.
 */

const ROOT = resolve(__dirname, "..");
const ANALYTICS = resolve(ROOT, "client/src/pages/Analytics.tsx");
const CURRICULUM = resolve(ROOT, "client/src/pages/Curriculum.tsx");
const COMPONENT = resolve(ROOT, "client/src/components/CurriculumProgressArcs.tsx");

describe("v2.41 — CurriculumProgressArcs on Analytics", () => {
  it("the component file still exists at /components/CurriculumProgressArcs.tsx", () => {
    expect(existsSync(COMPONENT)).toBe(true);
  });

  it("Analytics imports CurriculumProgressArcs", () => {
    const src = readFileSync(ANALYTICS, "utf-8");
    expect(src).toMatch(
      /import\s+CurriculumProgressArcs\s+from\s+["']@\/components\/CurriculumProgressArcs["']/,
    );
  });

  it("Analytics mounts <CurriculumProgressArcs /> exactly once", () => {
    const src = readFileSync(ANALYTICS, "utf-8");
    const mounts = src.match(/<CurriculumProgressArcs\s*\/>/g) ?? [];
    expect(mounts.length).toBe(1);
  });

  it("Curriculum no longer imports CurriculumProgressArcs", () => {
    const src = readFileSync(CURRICULUM, "utf-8");
    const importRe = /^[ \t]*import\s+CurriculumProgressArcs\s+from\s+["']@\/components\/CurriculumProgressArcs["']/m;
    expect(src).not.toMatch(importRe);
  });

  it("Curriculum no longer mounts <CurriculumProgressArcs />", () => {
    const src = readFileSync(CURRICULUM, "utf-8");
    expect(src).not.toMatch(/<CurriculumProgressArcs\s*\/>/);
  });

  it("Analytics also keeps CurriculumCoverageArcs (the at-a-glance roll-up alongside the per-topic matrix)", () => {
    const src = readFileSync(ANALYTICS, "utf-8");
    expect(src).toMatch(
      /import\s+CurriculumCoverageArcs\s+from\s+["']@\/components\/CurriculumCoverageArcs["']/,
    );
    expect(src).toMatch(/<CurriculumCoverageArcs\s*\/>/);
  });
});
