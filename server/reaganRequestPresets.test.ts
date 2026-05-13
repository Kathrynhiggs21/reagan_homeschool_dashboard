/**
 * Push 96 (2026-05-13) — Reagan request preset list contract.
 *
 * Locks the three preset kinds — assignment, adventure, schedule —
 * which the KidRequestsCard surfaces as big-button presets. Schedule
 * changes route to approvals.submit; assignments + adventures don't.
 */
import { describe, it, expect } from "vitest";
import {
  REAGAN_REQUEST_PRESETS,
  presetForKind,
  approvalKindForRequest,
} from "./_lib/reaganRequestPresets";

describe("Push 96 — Reagan request presets", () => {
  it("exactly three presets in canonical order", () => {
    expect(REAGAN_REQUEST_PRESETS.map((p) => p.kind)).toEqual([
      "assignment",
      "adventure",
      "schedule",
    ]);
  });

  it("each preset has emoji, label ≤ 28 chars, helperText, defaultMessage", () => {
    for (const p of REAGAN_REQUEST_PRESETS) {
      expect(p.emoji.length).toBeGreaterThan(0);
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.label.length).toBeLessThanOrEqual(28);
      expect(p.helperText.length).toBeGreaterThan(0);
      expect(p.defaultMessage.length).toBeGreaterThan(0);
    }
  });

  it("presetForKind returns the matching preset", () => {
    expect(presetForKind("assignment").label).toContain("assignment");
    expect(presetForKind("adventure").label).toContain("adventure");
    expect(presetForKind("schedule").label).toContain("schedule");
  });

  it("presetForKind throws on unknown kind", () => {
    expect(() => presetForKind("nope" as any)).toThrow();
  });

  it("approvalKindForRequest: schedule → schedule_change (queue routing)", () => {
    expect(approvalKindForRequest("schedule")).toBe("schedule_change");
  });

  it("approvalKindForRequest: assignment + adventure → null (inbox only)", () => {
    expect(approvalKindForRequest("assignment")).toBeNull();
    expect(approvalKindForRequest("adventure")).toBeNull();
  });

  it("schedule preset's helper text reminds Reagan that adults must say yes", () => {
    const p = presetForKind("schedule");
    expect(p.helperText.toLowerCase()).toMatch(/mom|grandma|yes/);
  });

  it("default messages are templates with at least one blank ___", () => {
    for (const p of REAGAN_REQUEST_PRESETS) {
      expect(p.defaultMessage).toContain("___");
    }
  });
});
