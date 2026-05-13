/**
 * Push 52 — Auto-add new topics from recap reply into curriculum.
 *
 * Contract:
 *   1. db.ts exports `autoAddRecapTopicToCurriculum` with the documented
 *      subjectSlug→TitleCase mapping (incl. life-skills + social-emotional →
 *      "Specials") and a normalizer that strips punctuation + lowercases.
 *   2. The helper short-circuits when the subjectSlug is unknown or the topic
 *      is empty.
 *   3. The recap-reply route in scheduledSync.ts calls the helper for every
 *      off-plan entry RIGHT AFTER queueOffPlanTopicForDriveSync, swallowing
 *      errors so the recap insert still succeeds.
 *   4. Inserted curriculumTopics rows carry status='covered',
 *      last_covered_source = the recap source label, and a RECAP-{date}-{slug}
 *      code so they sort distinct from seeded standards.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const dbSrc = fs.readFileSync(path.join(__dirname, "db.ts"), "utf-8");
const schedSrc = fs.readFileSync(path.join(__dirname, "scheduledSync.ts"), "utf-8");

describe("Push 52 — Auto-add new topics from recap reply", () => {
  it("exports autoAddRecapTopicToCurriculum with the documented signature", () => {
    expect(dbSrc).toContain("export async function autoAddRecapTopicToCurriculum(opts:");
    expect(dbSrc).toContain("subjectSlug: string;");
    expect(dbSrc).toContain("topic: string;");
    expect(dbSrc).toContain("dateISO: string;");
    expect(dbSrc).toContain("sourceLabel?: string;");
  });

  it("includes life-skills + social-emotional in the subject map (→ Specials)", () => {
    const idx = dbSrc.indexOf("RECAP_SUBJ_MAP_TO_TITLE");
    expect(idx).toBeGreaterThan(0);
    const slice = dbSrc.slice(idx, idx + 800);
    expect(slice).toContain('"life-skills": "Specials"');
    expect(slice).toContain('"social-emotional": "Specials"');
    expect(slice).toContain('"social-studies": "Social"');
    expect(slice).toContain('art: "Specials"');
  });

  it("short-circuits when subject or topic is invalid", () => {
    const idx = dbSrc.indexOf("autoAddRecapTopicToCurriculum");
    const slice = dbSrc.slice(idx, idx + 2500);
    expect(slice).toContain("if (!subjectTitle || !opts.topic.trim())");
    expect(slice).toContain("return { topicId: null, created: false");
  });

  it("inserts with status='covered', last_covered_source=sourceLabel, RECAP- prefix code", () => {
    const idx = dbSrc.indexOf("RECAP-${opts.dateISO}");
    expect(idx).toBeGreaterThan(0);
    const slice = dbSrc.slice(idx - 200, idx + 800);
    expect(slice).toContain("INSERT INTO curriculumTopics");
    expect(slice).toContain("\"covered\"");
    expect(slice).toContain("last_covered_source");
  });

  it("recap-reply handler calls autoAddRecapTopicToCurriculum after Drive enqueue", () => {
    const enqueueIdx = schedSrc.indexOf("queueOffPlanTopicForDriveSync");
    const autoIdx = schedSrc.indexOf("autoAddRecapTopicToCurriculum");
    expect(enqueueIdx).toBeGreaterThan(0);
    expect(autoIdx).toBeGreaterThan(enqueueIdx);
    const slice = schedSrc.slice(autoIdx, autoIdx + 600);
    expect(slice).toContain("subjectSlug: e.subjectSlug");
    expect(slice).toContain("topic: e.topic");
    expect(slice).toContain("sourceLabel: source");
    expect(slice).toContain("catch (curErr)");
  });
});
