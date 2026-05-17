/**
 * printForwardPlanWiring.test — Push 2.12 (2026-05-17)
 *
 * Source-pattern test that verifies the Print 2-weeks workflow is wired up:
 *   1. /print/forward-plan route is registered in App.tsx pointing at the
 *      PrintForwardPlan page.
 *   2. PrintForwardPlan.tsx calls trpc.curriculum.forwardPlan.printable.
 *   3. TodayForwardPlanCard has a Print button that navigates to that route
 *      with `?days=` and `?from=` query params.
 *
 * Pure file-shape assertions; no jsdom needed.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

function read(rel: string): string {
  return fs.readFileSync(path.resolve(rel), "utf8");
}

describe("Push 2.12 wiring — print forward plan", () => {
  it("App.tsx registers /print/forward-plan against PrintForwardPlan", () => {
    const src = read("client/src/App.tsx");
    expect(src).toContain('import PrintForwardPlan from "@/pages/PrintForwardPlan"');
    expect(src).toMatch(
      /<Route path="\/print\/forward-plan" component={PrintForwardPlan} \/>/,
    );
  });

  it("PrintForwardPlan calls trpc.curriculum.forwardPlan.printable", () => {
    const src = read("client/src/pages/PrintForwardPlan.tsx");
    expect(src).toContain("trpc.curriculum.forwardPlan.printable.useQuery");
    // Reads ?from=, ?days=, ?title= from the URL
    expect(src).toContain('sp.get("from")');
    expect(src).toContain('sp.get("days")');
    expect(src).toContain('sp.get("title")');
    // Auto print after data loads (default behavior)
    expect(src).toContain("window.print()");
  });

  it("TodayForwardPlanCard exposes a Print button that opens the print route", () => {
    const src = read("client/src/components/TodayForwardPlanCard.tsx");
    expect(src).toContain('data-testid="today-forward-plan-print"');
    expect(src).toContain("/print/forward-plan?days=");
    expect(src).toContain("window.open(url");
  });

  it("Print route is OUTSIDE any AdultGate (familyAdmin gate is server-side)", () => {
    // We don't want a kid-side gate that blocks the page from rendering at
    // all — the backing procedure (familyAdmin) is the source of truth.
    const src = read("client/src/App.tsx");
    const m = src.match(/<Route path="\/print\/forward-plan"[^>]*\/>/);
    expect(m).not.toBeNull();
    // The single self-closing Route line should not embed an AdultGate.
    expect(m![0].includes("AdultGate")).toBe(false);
  });
});
