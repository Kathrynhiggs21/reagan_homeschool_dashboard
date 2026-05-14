/**
 * Push 134 (2026-05-13) — Off-plan topic auto-add procedure wiring contract.
 *
 * Pins:
 *   - today.proposeOffPlanTopicAutoAdd is registered as a protectedProcedure mutation
 *   - it gates by adult role (admin/tutor/user) and returns { allowed:false } otherwise
 *   - it calls into ./_lib/offPlanTopicAutoAdd (Push 107 helper) and into
 *     db.listCurriculumTopicLabels (Push 134 wrapper)
 *   - it accepts (topicLabel, subjectSlug, confidence?, manualOverride?, recentHitCount?)
 *
 * Pure source-text check — no router instantiation, no DB.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROUTERS = readFileSync(
  join(__dirname, "routers.ts"),
  "utf8",
);
const DB = readFileSync(
  join(__dirname, "db.ts"),
  "utf8",
);

describe("Push 134 — proposeOffPlanTopicAutoAdd wiring", () => {
  it("router exposes proposeOffPlanTopicAutoAdd as a protectedProcedure mutation", () => {
    expect(ROUTERS).toContain("proposeOffPlanTopicAutoAdd:");
    const slice = ROUTERS.slice(
      ROUTERS.indexOf("proposeOffPlanTopicAutoAdd:"),
      ROUTERS.indexOf("proposeOffPlanTopicAutoAdd:") + 1500,
    );
    expect(slice).toContain("protectedProcedure");
    expect(slice).toContain(".mutation");
  });

  it("input zod schema covers all five helper fields", () => {
    const slice = ROUTERS.slice(
      ROUTERS.indexOf("proposeOffPlanTopicAutoAdd:"),
      ROUTERS.indexOf("proposeOffPlanTopicAutoAdd:") + 1500,
    );
    expect(slice).toMatch(/topicLabel:\s*z\.string\(\)/);
    expect(slice).toMatch(/subjectSlug:\s*z\.string\(\)/);
    expect(slice).toMatch(/confidence:\s*z\.number\(\)/);
    expect(slice).toMatch(/manualOverride:\s*z\.boolean\(\)/);
    expect(slice).toMatch(/recentHitCount:\s*z\.number\(\)/);
  });

  it("gates by adult role (admin / tutor / user) and short-circuits to allowed:false", () => {
    const slice = ROUTERS.slice(
      ROUTERS.indexOf("proposeOffPlanTopicAutoAdd:"),
      ROUTERS.indexOf("proposeOffPlanTopicAutoAdd:") + 1500,
    );
    expect(slice).toMatch(/ctx\.user\.role\s*!==\s*"admin"/);
    expect(slice).toMatch(/ctx\.user\.role\s*!==\s*"tutor"/);
    expect(slice).toMatch(/ctx\.user\.role\s*!==\s*"user"/);
    expect(slice).toMatch(/allowed:\s*false/);
  });

  it("delegates to the Push 107 pure helper (no inline reimplementation)", () => {
    const slice = ROUTERS.slice(
      ROUTERS.indexOf("proposeOffPlanTopicAutoAdd:"),
      ROUTERS.indexOf("proposeOffPlanTopicAutoAdd:") + 1500,
    );
    expect(slice).toContain("decideOffPlanTopicAutoAdd");
    expect(slice).toContain("_lib/offPlanTopicAutoAdd");
    // No re-implementation of the gating thresholds inline.
    expect(slice).not.toMatch(/MIN_CONFIDENCE/);
    expect(slice).not.toMatch(/0\.6/);
  });

  it("uses db.listCurriculumTopicLabels to feed the helper's index", () => {
    const slice = ROUTERS.slice(
      ROUTERS.indexOf("proposeOffPlanTopicAutoAdd:"),
      ROUTERS.indexOf("proposeOffPlanTopicAutoAdd:") + 1500,
    );
    expect(slice).toContain("db.listCurriculumTopicLabels()");
    expect(slice).toContain("existingLabels");
  });

  it("db.listCurriculumTopicLabels exists and lower-cases + trims + drops empties", () => {
    expect(DB).toContain("export async function listCurriculumTopicLabels");
    const slice = DB.slice(
      DB.indexOf("export async function listCurriculumTopicLabels"),
      DB.indexOf("export async function listCurriculumTopicLabels") + 600,
    );
    expect(slice).toContain("toLowerCase()");
    expect(slice).toContain(".trim()");
    expect(slice).toMatch(/length\s*>\s*0/);
    expect(slice).toContain("FROM curriculumTopics");
  });

  it("returns the helper's typed decision verbatim (so callers see promote + reason)", () => {
    const slice = ROUTERS.slice(
      ROUTERS.indexOf("proposeOffPlanTopicAutoAdd:"),
      ROUTERS.indexOf("proposeOffPlanTopicAutoAdd:") + 1500,
    );
    expect(slice).toMatch(/return\s*\{\s*allowed:\s*true[^}]*decision/);
  });
});
