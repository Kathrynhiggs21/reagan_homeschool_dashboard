import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Contract/wiring tests for the diagnostic working-grade-level result.
 * These are grep-style assertions over the source so the feature can't be
 * silently unwired (procedure removed, AI context dropped, UI link deleted).
 */

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("placement level report — server wiring", () => {
  const routers = read("server/routers.ts");
  const db = read("server/db.ts");

  it("exposes an adult-only levelReport query on the placement router", () => {
    expect(routers).toMatch(/levelReport:\s*protectedProcedure\.query\(\(\)\s*=>\s*db\.placementLevelReport\(\)\)/);
  });

  it("db.placementLevelReport joins responses->tasks->skillLadder and uses the estimator", () => {
    expect(db).toContain("export async function placementLevelReport()");
    expect(db).toContain("buildPlacementLevelReport");
    // joins through the three diagnostic tables
    expect(db).toContain(".innerJoin(placementTasks");
    expect(db).toContain(".innerJoin(skillLadder");
  });
});

describe("placement level report — AI agenda context", () => {
  const answer = read("server/_lib/agendaAnswer.ts");

  it("AnswerContext carries placementLevels and the assembler fills it", () => {
    expect(answer).toContain("placementLevels: string;");
    expect(answer).toContain("db.placementLevelReport");
  });

  it("the answer system prompt teaches the 'what level is she at' rule", () => {
    expect(answer.toLowerCase()).toContain("working grade level");
    expect(answer.toLowerCase()).toMatch(/what level.*she at|grade level is she at/);
  });

  it("never fabricates: empty report yields a 'no diagnostic' line, not a number", () => {
    expect(answer).toMatch(/no diagnostic Skill Check-up completed yet/i);
  });
});

describe("placement level report — adult UI", () => {
  const page = read("client/src/pages/Placement.tsx");

  it("renders a parent-only Results view that reads levelReport", () => {
    expect(page).toContain("trpc.placement.levelReport.useQuery");
    expect(page).toContain("Working Grade Level");
    expect(page).toMatch(/Parent view/);
  });

  it("gates the results entry behind an authenticated adult", () => {
    expect(page).toContain('import { useAuth } from "@/_core/hooks/useAuth"');
    expect(page).toContain("isAdult");
  });
});
