/**
 * Push 121 (2026-05-13) — Calendar-week assignment summary contract.
 *
 * Locks in the per-subject coverage + missing-school-day signals + headline
 * heuristic for the Mom-tier "This Week" view and Sunday digest.
 *
 * Helper under test: server/_lib/calendarWeekAssignmentSummary.ts
 *   summarizeCalendarWeek({ weekStartIso, rows }) -> CalendarWeekSummary
 *
 * Week math is fixed in UTC and uses Mon = 1 ... Fri = 5 as school days.
 * I'm picking 2026-05-11 (Monday) as the canonical anchor so all dates
 * below are easy to read.
 *
 * Status semantics under test:
 *   - completed       counts toward coverage + minutes + days-with-work
 *   - in-progress     same
 *   - missed          counts only as a per-subject `missed` tally
 *   - skipped         ignored entirely (no coverage credit, no missed)
 *   - scheduled       ignored entirely
 *
 * Out-of-week rows, unknown subjects, unknown statuses, malformed rows,
 * and bad weekStart input are all silently dropped.
 */

import { describe, it, expect } from "vitest";
import {
  summarizeCalendarWeek,
  type AssignmentRow,
} from "./_lib/calendarWeekAssignmentSummary";

const MON = "2026-05-11"; // Monday
const TUE = "2026-05-12";
const WED = "2026-05-13";
const THU = "2026-05-14";
const FRI = "2026-05-15";
const SAT = "2026-05-16";
const SUN = "2026-05-17"; // end of the week
const PREV_SUN = "2026-05-10"; // out of week
const NEXT_MON = "2026-05-18"; // out of week

function row(
  dateIso: string,
  subject: string,
  status: string,
  minutes?: number,
): AssignmentRow {
  return { dateIso, subject, status, minutes } as AssignmentRow;
}

describe("Push 121 — summarizeCalendarWeek", () => {
  it("computes weekStart/weekEnd and emits all 5 canonical subjects in fixed order", () => {
    const out = summarizeCalendarWeek({ weekStartIso: MON, rows: [] });
    expect(out.weekStartIso).toBe(MON);
    expect(out.weekEndIso).toBe(SUN);
    expect(out.perSubject.map((s) => s.subject)).toEqual([
      "math",
      "ela",
      "science",
      "social-studies",
      "spelling",
    ]);
  });

  it("counts completed + in-progress toward coverage and minutes; missed is its own tally; skipped/scheduled ignored", () => {
    const out = summarizeCalendarWeek({
      weekStartIso: MON,
      rows: [
        row(MON, "math", "completed", 30),
        row(TUE, "math", "in-progress", 15),
        row(WED, "math", "missed"),
        row(THU, "math", "skipped", 20), // ignored entirely
        row(FRI, "math", "scheduled", 20), // ignored entirely
      ],
    });
    const math = out.perSubject.find((s) => s.subject === "math")!;
    expect(math.completed).toBe(1);
    expect(math.inProgress).toBe(1);
    expect(math.missed).toBe(1);
    expect(math.totalMinutes).toBe(45);
    expect(math.daysWithWork).toBe(2);
    expect(out.totalMinutes).toBe(45);
  });

  it("daysWithWork dedupes per subject by date", () => {
    const out = summarizeCalendarWeek({
      weekStartIso: MON,
      rows: [
        row(MON, "ela", "completed", 10),
        row(MON, "ela", "completed", 10),
        row(MON, "ela", "in-progress", 5),
      ],
    });
    const ela = out.perSubject.find((s) => s.subject === "ela")!;
    expect(ela.completed).toBe(2);
    expect(ela.inProgress).toBe(1);
    expect(ela.daysWithWork).toBe(1);
    expect(ela.totalMinutes).toBe(25);
  });

  it("drops rows outside the calendar week", () => {
    const out = summarizeCalendarWeek({
      weekStartIso: MON,
      rows: [
        row(PREV_SUN, "math", "completed", 30),
        row(NEXT_MON, "math", "completed", 30),
        row(MON, "math", "completed", 5),
      ],
    });
    const math = out.perSubject.find((s) => s.subject === "math")!;
    expect(math.completed).toBe(1);
    expect(math.totalMinutes).toBe(5);
  });

  it("missingSchoolDays = Mon–Fri days with no completed/in-progress entries", () => {
    const out = summarizeCalendarWeek({
      weekStartIso: MON,
      rows: [
        row(MON, "math", "completed", 10),
        row(WED, "ela", "in-progress", 5),
        row(SAT, "science", "completed", 60), // weekend doesn't fill anything
      ],
    });
    expect(out.missingSchoolDays).toEqual([TUE, THU, FRI]);
  });

  it("weekend has zero work but is never reported as a missing school day", () => {
    const out = summarizeCalendarWeek({
      weekStartIso: MON,
      rows: [
        row(MON, "math", "completed", 10),
        row(TUE, "math", "completed", 10),
        row(WED, "math", "completed", 10),
        row(THU, "math", "completed", 10),
        row(FRI, "math", "completed", 10),
      ],
    });
    expect(out.missingSchoolDays).toEqual([]);
  });

  it("uncoveredSubjects lists subjects that got 0 completed AND 0 in-progress", () => {
    const out = summarizeCalendarWeek({
      weekStartIso: MON,
      rows: [
        row(MON, "math", "completed", 10),
        row(TUE, "ela", "in-progress", 10),
        row(WED, "spelling", "missed"), // missed alone does NOT cover
      ],
    });
    expect(out.uncoveredSubjects.sort()).toEqual(
      ["science", "social-studies", "spelling"].sort(),
    );
  });

  it("headline: balanced when every subject got time", () => {
    const out = summarizeCalendarWeek({
      weekStartIso: MON,
      rows: [
        row(MON, "math", "completed", 30),
        row(MON, "ela", "completed", 30),
        row(TUE, "science", "completed", 30),
        row(TUE, "social-studies", "completed", 30),
        row(WED, "spelling", "in-progress", 15),
        row(THU, "math", "completed", 5),
        row(FRI, "ela", "completed", 5),
      ],
    });
    expect(out.headline).toBe("Balanced week — every subject got time");
  });

  it("headline: subject-gap when 1–2 subjects untouched", () => {
    const out = summarizeCalendarWeek({
      weekStartIso: MON,
      rows: [
        row(MON, "math", "completed", 30),
        row(TUE, "ela", "completed", 30),
        row(WED, "science", "completed", 30),
        row(THU, "social-studies", "completed", 30),
        row(FRI, "math", "completed", 30),
        // spelling untouched
      ],
    });
    expect(out.headline).toBe("Mostly-balanced week — a subject gap");
  });

  it("headline: narrow week when 3+ subjects untouched", () => {
    const out = summarizeCalendarWeek({
      weekStartIso: MON,
      rows: [
        row(MON, "math", "completed", 30),
        row(TUE, "math", "completed", 30),
        row(WED, "ela", "in-progress", 5),
      ],
    });
    expect(out.headline).toBe("Narrow week — most subjects untouched");
  });

  it("headline: light week when 3+ school days unlogged outranks subject gap", () => {
    const out = summarizeCalendarWeek({
      weekStartIso: MON,
      rows: [
        row(MON, "math", "completed", 30),
        row(TUE, "ela", "completed", 30),
      ],
    });
    expect(out.headline).toBe("Light week — three or more days unlogged");
  });

  it("headline: quiet week when zero logged minutes (even if rows exist)", () => {
    const out = summarizeCalendarWeek({
      weekStartIso: MON,
      rows: [
        row(MON, "math", "missed"),
        row(TUE, "ela", "skipped"),
        row(WED, "science", "scheduled"),
      ],
    });
    expect(out.headline).toBe("Quiet week — no logged work");
    expect(out.totalMinutes).toBe(0);
  });

  it("malformed rows, unknown subjects, and unknown statuses are silently dropped", () => {
    const out = summarizeCalendarWeek({
      weekStartIso: MON,
      rows: [
        row(MON, "math", "completed", 10),
        row(MON, "art", "completed", 30) as any, // unknown subject
        row(MON, "math", "vibing" as any, 10), // unknown status
        // @ts-expect-error - malformed row
        null,
        // @ts-expect-error - malformed row
        { dateIso: "not-a-date", subject: "math", status: "completed" },
      ],
    });
    const math = out.perSubject.find((s) => s.subject === "math")!;
    expect(math.completed).toBe(1);
    expect(math.totalMinutes).toBe(10);
  });

  it("bad weekStart input gives empty week + zero coverage but doesn't throw", () => {
    const out = summarizeCalendarWeek({
      weekStartIso: "garbage",
      rows: [row(MON, "math", "completed", 30)],
    });
    expect(out.weekStartIso).toBe("");
    expect(out.weekEndIso).toBe("");
    expect(out.totalMinutes).toBe(0);
    expect(out.missingSchoolDays).toEqual([]);
    // every canonical subject is uncovered when the week is empty.
    expect(out.uncoveredSubjects.length).toBe(5);
  });
});
