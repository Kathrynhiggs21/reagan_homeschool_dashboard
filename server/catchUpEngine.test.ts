/**
 * Push 45 — Catch-up engine (per-subject mastery % + traffic light + next 3 topics).
 *
 * Pure-function coverage (the traffic-light bucketing + slug mapping)
 * runs against the live module; the DB-touching parts are covered by
 * shape assertions against db.ts + the router so we don't need a live
 * MySQL connection in unit tests.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { catchUpTrafficLightForPct } from "./db";

describe("Catch-up traffic-light buckets — push 45", () => {
  it("returns green for ≥ 67%", () => {
    expect(catchUpTrafficLightForPct(67, 10)).toBe("green");
    expect(catchUpTrafficLightForPct(100, 10)).toBe("green");
  });
  it("returns yellow for 34–66%", () => {
    expect(catchUpTrafficLightForPct(34, 10)).toBe("yellow");
    expect(catchUpTrafficLightForPct(50, 10)).toBe("yellow");
    expect(catchUpTrafficLightForPct(66, 10)).toBe("yellow");
  });
  it("returns red for ≤ 33%", () => {
    expect(catchUpTrafficLightForPct(0, 10)).toBe("red");
    expect(catchUpTrafficLightForPct(33, 10)).toBe("red");
  });
  it("treats empty total as yellow so the UI doesn't false-alarm", () => {
    expect(catchUpTrafficLightForPct(0, 0)).toBe("yellow");
  });
});

describe("Catch-up engine — contract", () => {
  const dbSrc = fs.readFileSync(path.join(__dirname, "db.ts"), "utf-8");
  const routersSrc = fs.readFileSync(path.join(__dirname, "routers.ts"), "utf-8");
  const curriculumSrc = fs.readFileSync(
    path.join(__dirname, "..", "client", "src", "pages", "Curriculum.tsx"),
    "utf-8",
  );

  it("getCatchUpRollup is exported with the documented row shape", () => {
    expect(dbSrc).toContain("export async function getCatchUpRollup()");
    expect(dbSrc).toContain("masteryPct");
    expect(dbSrc).toContain("trafficLight");
    expect(dbSrc).toContain("nextThree");
  });

  it("next-3 pulls inProgress topics before notStarted, ord ASC", () => {
    const idx = dbSrc.indexOf("export async function getCatchUpRollup");
    const slice = dbSrc.slice(idx, idx + 4000);
    expect(slice).toContain("status <> 'done'");
    expect(slice).toContain("CASE WHEN status = 'inProgress' THEN 0 ELSE 1 END ASC");
    expect(slice).toContain("ord ASC");
    expect(slice).toContain("LIMIT 3");
  });

  it("curriculum.catchUp is a protectedProcedure read query", () => {
    expect(routersSrc).toContain("catchUp: protectedProcedure.query(() => db.getCatchUpRollup())");
  });

  it("Curriculum.tsx renders the rollup card above the AI agenda sync strip", () => {
    const rollupIdx = curriculumSrc.indexOf("<CatchUpRollupStrip />");
    const syncIdx = curriculumSrc.indexOf("Tomorrow & the week ahead");
    expect(rollupIdx).toBeGreaterThan(0);
    expect(syncIdx).toBeGreaterThan(rollupIdx);
  });

  it("Catch-up rollup pills carry data attributes for analytics + a11y", () => {
    expect(curriculumSrc).toContain('data-testid="catch-up-rollup-strip"');
    expect(curriculumSrc).toContain("data-subject={s.subjectSlug}");
    expect(curriculumSrc).toContain("data-traffic-light={s.trafficLight}");
  });

  it("Each pill exposes the documented thresholds in its legend", () => {
    expect(curriculumSrc).toContain("≥ 67%");
    expect(curriculumSrc).toContain("34–66%");
    expect(curriculumSrc).toContain("≤ 33%");
  });
});
