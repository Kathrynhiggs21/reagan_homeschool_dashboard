/**
 * Push 110 (2026-05-13) — Recap email Grandma copy block contract.
 */
import { describe, it, expect } from "vitest";
import {
  composeRecapEmailBody,
  renderRecapEmailPlainText,
} from "./_lib/recapEmailCopy";

describe("Push 110 — Recap email Grandma copy", () => {
  it("noon subject is heads-up tone with kid name + family date", () => {
    const body = composeRecapEmailBody({
      cadence: "noon",
      familyDateIso: "2026-05-13",
      observedSignals: [],
    });
    expect(body.subject).toMatch(/Heads-up/);
    expect(body.subject).toContain("Reagan");
    expect(body.subject).toContain("2026-05-13");
  });

  it("evening subject is end-of-day tone", () => {
    const body = composeRecapEmailBody({
      cadence: "evening",
      familyDateIso: "2026-05-13",
      observedSignals: [],
    });
    expect(body.subject).toMatch(/End-of-day/);
  });

  it("framing never accuses Reagan of skipping — it's about missing log signal", () => {
    for (const cadence of ["noon", "evening"] as const) {
      const body = composeRecapEmailBody({
        cadence,
        familyDateIso: "2026-05-13",
        observedSignals: [],
      });
      expect(body.framing.toLowerCase()).not.toMatch(/skipped|didn't do|did not do|lazy/);
      expect(body.framing.toLowerCase()).toMatch(/log|sync|record|hasn't logged|don't have/);
    }
  });

  it("greeting is by Grandma's name", () => {
    const body = composeRecapEmailBody({
      cadence: "noon",
      familyDateIso: "2026-05-13",
      observedSignals: [],
    });
    expect(body.greeting).toBe("Hi Grandma,");
  });

  it("observedBlock is null when no signals exist, populated when present", () => {
    const empty = composeRecapEmailBody({
      cadence: "noon",
      familyDateIso: "2026-05-13",
      observedSignals: [],
    });
    expect(empty.observedBlock).toBeNull();

    const some = composeRecapEmailBody({
      cadence: "noon",
      familyDateIso: "2026-05-13",
      observedSignals: ["Mood log green at 10am", "Photo of bird walk uploaded"],
    });
    expect(some.observedBlock).toMatch(/Mood log green at 10am/);
    expect(some.observedBlock).toMatch(/Photo of bird walk uploaded/);
  });

  it("filters non-string / blank observed signals defensively", () => {
    const body = composeRecapEmailBody({
      cadence: "evening",
      familyDateIso: "2026-05-13",
      observedSignals: ["valid", "  ", "" as any, null as any, 42 as any, "another"],
    });
    expect(body.observedBlock).toMatch(/valid/);
    expect(body.observedBlock).toMatch(/another/);
    expect(body.observedBlock).not.toMatch(/42|null|^$/);
  });

  it("close references IEP paper-trail framing", () => {
    const body = composeRecapEmailBody({
      cadence: "evening",
      familyDateIso: "2026-05-13",
      observedSignals: [],
    });
    expect(body.close.toLowerCase()).toMatch(/iep meeting/);
  });

  it("nextStep tone differs between noon and evening", () => {
    const noon = composeRecapEmailBody({
      cadence: "noon",
      familyDateIso: "2026-05-13",
      observedSignals: [],
    });
    const evening = composeRecapEmailBody({
      cadence: "evening",
      familyDateIso: "2026-05-13",
      observedSignals: [],
    });
    expect(noon.nextStep).not.toBe(evening.nextStep);
    expect(noon.nextStep.toLowerCase()).toMatch(/text mom|ask reagan/);
  });

  it("kidName falls back to 'Reagan' when missing/blank", () => {
    const blank = composeRecapEmailBody({
      cadence: "noon",
      familyDateIso: "2026-05-13",
      observedSignals: [],
      kidName: "   ",
    });
    expect(blank.subject).toContain("Reagan");
    expect(blank.framing).toContain("Reagan");
  });

  it("renderRecapEmailPlainText omits observed block cleanly when null", () => {
    const body = composeRecapEmailBody({
      cadence: "noon",
      familyDateIso: "2026-05-13",
      observedSignals: [],
    });
    const text = renderRecapEmailPlainText(body);
    expect(text.startsWith("Hi Grandma,")).toBe(true);
    expect(text).toContain("paper trail");
    expect(text).not.toMatch(/What I do see/);
  });

  it("renderRecapEmailPlainText includes observed block when present", () => {
    const body = composeRecapEmailBody({
      cadence: "evening",
      familyDateIso: "2026-05-13",
      observedSignals: ["Mood log green at 10am"],
    });
    const text = renderRecapEmailPlainText(body);
    expect(text).toMatch(/What I do see/);
    expect(text).toMatch(/Mood log green/);
  });

  it("custom signature line overrides default", () => {
    const body = composeRecapEmailBody({
      cadence: "noon",
      familyDateIso: "2026-05-13",
      observedSignals: [],
      sentBy: "— sent by Mom's dashboard",
    });
    const text = renderRecapEmailPlainText(body);
    expect(text).toMatch(/sent by Mom's dashboard/);
  });
});
