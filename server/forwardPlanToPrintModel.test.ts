import { describe, it, expect } from "vitest";
import { forwardPlanToPrintModel } from "./_lib/forwardPlanToPrintModel";
import type { PlanRow } from "./_lib/curriculumForwardPlanner";

const R = (
  date: string,
  slotIndex: number,
  subject: string,
  topicId: number,
  isBlockerFrontload = false,
): PlanRow => ({
  date,
  weekday: 0,
  slotIndex,
  subject,
  topicId,
  code: `${subject[0]}-${topicId}`,
  title: `${subject} topic ${topicId}`,
  evidence: subject === "Math" ? "Spectrum p.150" : null,
  isBlockerFrontload,
});

describe("forwardPlanToPrintModel", () => {
  it("returns an empty shape for [] input", () => {
    const m = forwardPlanToPrintModel([]);
    expect(m.dateRange).toBeNull();
    expect(m.days).toEqual([]);
    expect(m.totals).toEqual({ topics: 0, blockerTopics: 0 });
    expect(m.title).toBe("Reagan's plan");
  });

  it("groups by date, sorts slots ascending, and counts totals correctly", () => {
    const rows: PlanRow[] = [
      R("2027-09-15", 1, "ELA", 200),
      R("2027-09-13", 0, "Math", 101, true),
      R("2027-09-13", 1, "ELA", 201, true),
      R("2027-09-15", 0, "Math", 102),
      R("2027-09-14", 0, "Math", 110),
    ];
    const m = forwardPlanToPrintModel(rows);
    expect(m.days.map((d) => d.date)).toEqual([
      "2027-09-13",
      "2027-09-14",
      "2027-09-15",
    ]);
    // Slot order within a day:
    expect(m.days[0].slots.map((s) => s.slotIndex)).toEqual([0, 1]);
    expect(m.days[2].slots.map((s) => s.topicId)).toEqual([102, 200]);
    expect(m.totals).toEqual({ topics: 5, blockerTopics: 2 });
    expect(m.dateRange).toEqual({ from: "2027-09-13", to: "2027-09-15" });
  });

  it("emits short labels in the form 'Mon, Sep 13'", () => {
    // 2027-09-13 is a Monday in UTC.
    const m = forwardPlanToPrintModel([R("2027-09-13", 0, "Math", 1)]);
    expect(m.days[0].label).toBe("Mon, Sep 13");
  });

  it("title uses arrow when start != end, single date when collapsed", () => {
    const single = forwardPlanToPrintModel([R("2027-09-13", 0, "Math", 1)]);
    expect(single.title).toBe("Reagan's plan — Sep 13, 2027");
    const range = forwardPlanToPrintModel([
      R("2027-09-13", 0, "Math", 1),
      R("2027-09-24", 0, "Math", 2),
    ]);
    expect(range.title).toBe(
      "Reagan's plan — Sep 13, 2027 \u2192 Sep 24, 2027",
    );
  });

  it("respects custom title override", () => {
    const m = forwardPlanToPrintModel([R("2027-09-13", 0, "Math", 1)], {
      title: "Two-week catch-up",
    });
    expect(m.title.startsWith("Two-week catch-up")).toBe(true);
  });

  it("preserves evidence string verbatim on the printable slot", () => {
    const m = forwardPlanToPrintModel([R("2027-09-13", 0, "Math", 1, true)]);
    expect(m.days[0].slots[0].evidence).toBe("Spectrum p.150");
    expect(m.days[0].slots[0].isBlockerFrontload).toBe(true);
  });

  it("never re-orders rows globally — only within a day", () => {
    // Slot 5 with same date should stay where slotIndex puts it, not move
    // because of input order.
    const m = forwardPlanToPrintModel([
      R("2027-09-13", 5, "Specials", 999),
      R("2027-09-13", 0, "Math", 1),
    ]);
    expect(m.days[0].slots.map((s) => s.slotIndex)).toEqual([0, 5]);
  });
});
