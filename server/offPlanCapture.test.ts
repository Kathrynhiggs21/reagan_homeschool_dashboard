/**
 * Push 84 (2026-05-13) — Off-plan capture summary on adult Today recap.
 *
 * Source-level contract that locks:
 *   1) `offPlanCaptureSummaryForDate(dateISO)` exists in db.ts and returns
 *      the expected shape (totalCount, drivePushedCount, pendingCount, items).
 *   2) `today.offPlanCaptureSummary` procedure is protected and rejects
 *      Reagan (role !== admin|tutor|user) by returning allowed:false +
 *      empty payload — never exposing other captures to the kid.
 *   3) The adult `OffPlanCaptureCard` is mounted on Today.tsx with a
 *      `data-testid="off-plan-capture-card"` and self-hides on empty.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");
const DB_TS = readFileSync(join(ROOT, "server/db.ts"), "utf8");
const ROUTERS_TS = readFileSync(join(ROOT, "server/routers.ts"), "utf8");
const CARD_TSX = readFileSync(
  join(ROOT, "client/src/components/OffPlanCaptureCard.tsx"),
  "utf8",
);
const TODAY_TSX = readFileSync(
  join(ROOT, "client/src/pages/Today.tsx"),
  "utf8",
);

describe("Push 84 — offPlanCaptureSummaryForDate (db.ts)", () => {
  it("declares the helper with the expected name", () => {
    expect(DB_TS).toMatch(
      /export\s+async\s+function\s+offPlanCaptureSummaryForDate/,
    );
  });
  it("queries the topicsCoveredOffPlan table", () => {
    expect(DB_TS).toMatch(/topicsCoveredOffPlan/);
  });
  it("returns the four counts + items array shape", () => {
    expect(DB_TS).toMatch(/totalCount:\s*items\.length/);
    expect(DB_TS).toMatch(/drivePushedCount,?/);
    expect(DB_TS).toMatch(/pendingCount:\s*items\.length\s*-\s*drivePushedCount/);
  });
  it("normalizes drivePushed via Boolean()", () => {
    expect(DB_TS).toMatch(/drivePushed:\s*Boolean\(r\.drivePushed\)/);
  });
});

describe("Push 84 — today.offPlanCaptureSummary procedure", () => {
  it("is exposed under today router as offPlanCaptureSummary", () => {
    expect(ROUTERS_TS).toMatch(/offPlanCaptureSummary:\s*protectedProcedure/);
  });
  it("rejects non-adult roles with allowed:false and empty payload", () => {
    expect(ROUTERS_TS).toMatch(
      /if\s*\(\s*ctx\.user\.role\s*!==\s*"admin"\s*&&\s*ctx\.user\.role\s*!==\s*"tutor"\s*&&\s*ctx\.user\.role\s*!==\s*"user"\s*\)/,
    );
    expect(ROUTERS_TS).toMatch(/allowed:\s*false/);
  });
  it("calls the db helper for adult callers", () => {
    expect(ROUTERS_TS).toMatch(/db\.offPlanCaptureSummaryForDate\(date\)/);
  });
  it("returns allowed:true and a date string when permitted", () => {
    expect(ROUTERS_TS).toMatch(/allowed:\s*true,\s*date/);
  });
});

describe("Push 84 — OffPlanCaptureCard component", () => {
  it("self-hides when totalCount === 0 (no-info rule)", () => {
    expect(CARD_TSX).toMatch(/totalCount === 0/);
  });
  it("self-hides when allowed:false (kid never sees captures)", () => {
    expect(CARD_TSX).toMatch(/!\s*data\.allowed/);
  });
  it("uses the today.offPlanCaptureSummary procedure", () => {
    expect(CARD_TSX).toMatch(
      /trpc\.today\.offPlanCaptureSummary\.useQuery/,
    );
  });
  it("stabilizes useQuery input via useMemo (no infinite loops)", () => {
    expect(CARD_TSX).toMatch(/useMemo\(/);
  });
  it("renders the testid", () => {
    expect(CARD_TSX).toMatch(/data-testid="off-plan-capture-card"/);
  });
});

describe("Push 84 — Today.tsx mount", () => {
  it("imports OffPlanCaptureCard", () => {
    expect(TODAY_TSX).toMatch(
      /import\s+\{\s*OffPlanCaptureCard\s*\}\s+from\s+["']@\/components\/OffPlanCaptureCard["']/,
    );
  });
  it("mounts the card under the kid header strips", () => {
    expect(TODAY_TSX).toMatch(/<OffPlanCaptureCard\s*\/>/);
  });
});
