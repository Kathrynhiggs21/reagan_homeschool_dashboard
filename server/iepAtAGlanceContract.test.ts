import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

/**
 * Push 21 (2026-05-12): IEP at-a-glance mini-card on Analytics
 * (todo.md lines 482-492). Locks:
 *  - The mini card exists in Analytics.tsx, scoped to the Kiwi/Adult area.
 *  - It uses the 3 Mom-friendly bucket labels: Behind / On / Ahead.
 *  - It includes an "Open in Drive" link to the Goals folder.
 *  - It deliberately does NOT render the detailed bars / source-labeled
 *    rows / estimated-vs-real charts. Those live in the dashboard further
 *    down in the dedicated "IEP Goals & Accommodations" section, NOT in
 *    the at-a-glance summary.
 */

const ANALYTICS = readFileSync(
  path.join(__dirname, "..", "client", "src", "pages", "Analytics.tsx"),
  "utf8",
);

function sliceAtAGlance(): string {
  const start = ANALYTICS.indexOf('{/* IEP at-a-glance mini-card');
  expect(start).toBeGreaterThan(-1);
  const end = ANALYTICS.indexOf("Subject radar", start);
  expect(end).toBeGreaterThan(start);
  return ANALYTICS.slice(start, end);
}

describe("IEP at-a-glance mini-card — contract (push 21)", () => {
  it("the mini-card section exists in Analytics.tsx", () => {
    const slice = sliceAtAGlance();
    expect(slice).toContain("IEP — at a glance");
  });

  it("uses iep.listGoals query as data source", () => {
    expect(ANALYTICS).toContain("trpc.iep.listGoals.useQuery");
  });

  it("renders Behind / On / Ahead buckets (Mom-friendly wording)", () => {
    const slice = sliceAtAGlance();
    expect(slice).toContain('"Behind"');
    expect(slice).toContain('"On"');
    expect(slice).toContain('"Ahead"');
  });

  it("maps both DB status enums and raw percentage to the 3 buckets", () => {
    const slice = sliceAtAGlance();
    // Treats "met" + "ahead" + pct>=1 as Ahead.
    expect(slice).toMatch(/raw === "met"[^\n]*"ahead"[^\n]*pct[^\n]*>=\s*1/);
    // Treats "not_met" + "at_risk" + "behind" + low pct as Behind.
    expect(slice).toContain('raw === "not_met"');
    expect(slice).toContain('raw === "at_risk"');
    expect(slice).toContain('raw === "behind"');
    expect(slice).toMatch(/pct[^\n]*<\s*0\.5/);
  });

  it("includes an Open in Drive link to the Goals folder", () => {
    const slice = sliceAtAGlance();
    expect(slice).toContain("OpenInDrive");
    expect(slice).toContain("Goals / IEP-style Plans in Drive");
  });

  it("the at-a-glance card does NOT include detailed bars / source labels (those live in the dedicated IEP section further down)", () => {
    const slice = sliceAtAGlance();
    // Negative checks: none of these rich UI bits should appear in this slice.
    expect(slice).not.toMatch(/Progress[^,]*bar/i);
    expect(slice).not.toContain("currentPercent: ");
    expect(slice).not.toContain("estimatedVs");
    expect(slice).not.toContain("source:");
  });

  it("at-a-glance card hides itself when no goals are available", () => {
    const slice = sliceAtAGlance();
    expect(slice).toMatch(/uniqueGoals\.length\s*>\s*0\s*&&/);
  });

  it("limits the visible goals to 6 (the rest live in the full breakdown below)", () => {
    const slice = sliceAtAGlance();
    expect(slice).toMatch(/uniqueGoals\.slice\(\s*0\s*,\s*6\s*\)/);
  });
});
