/**
 * Push 117 (2026-05-13) — Printable schedule render-plan contract.
 */
import { describe, it, expect } from "vitest";
import { planPrintableSchedule } from "./_lib/printableScheduleRenderPlan";

const SAMPLE_BLOCKS = [
  { startHHMM: "09:00", durationMin: 30, label: "Morning circle" },
  { startHHMM: "07:30", durationMin: 45, label: "Math", subject: "math" },
  { startHHMM: "10:00", durationMin: 60, label: "Reading", locked: true },
];

describe("Push 117 — Printable schedule render-plan", () => {
  it("self-hides when dateIso is missing", () => {
    const r = planPrintableSchedule({
      dateIso: "",
      blocks: SAMPLE_BLOCKS,
    });
    expect(r.shouldShow).toBe(false);
    expect(r.emptyReason).toBe("no-date");
  });

  it("self-hides when no valid blocks remain", () => {
    const r = planPrintableSchedule({
      dateIso: "2026-05-13",
      blocks: [
        { startHHMM: "bad", durationMin: 0, label: "" } as any,
        null as any,
      ],
    });
    expect(r.shouldShow).toBe(false);
    expect(r.emptyReason).toBe("no-blocks");
  });

  it("blocks are sorted by start time and formatted with duration", () => {
    const r = planPrintableSchedule({
      dateIso: "2026-05-13",
      blocks: SAMPLE_BLOCKS,
    });
    expect(r.shouldShow).toBe(true);
    expect(r.blocks.map((b) => b.line)).toEqual([
      "07:30  Math (45 min)",
      "09:00  Morning circle (30 min)",
      "10:00  Reading (60 min)",
    ]);
    expect(r.blocks[2].locked).toBe(true);
  });

  it("header title uses Reagan + pretty date", () => {
    const r = planPrintableSchedule({
      dateIso: "2026-05-13",
      blocks: SAMPLE_BLOCKS,
    });
    expect(r.header.title).toBe("Reagan's Schedule — Wed May 13");
  });

  it("custom kidName flows into header", () => {
    const r = planPrintableSchedule({
      dateIso: "2026-05-13",
      kidName: "R.",
      blocks: SAMPLE_BLOCKS,
    });
    expect(r.header.title.startsWith("R.'s Schedule —")).toBe(true);
  });

  it("tutor line included when tutorOfDay provided", () => {
    const r = planPrintableSchedule({
      dateIso: "2026-05-13",
      blocks: SAMPLE_BLOCKS,
      tutorOfDay: { name: "Madison", window: "9:00–11:30" },
    });
    expect(r.header.tutorLine).toBe("Tutor today: Madison (9:00–11:30)");
  });

  it("tutor line omits window when missing", () => {
    const r = planPrintableSchedule({
      dateIso: "2026-05-13",
      blocks: SAMPLE_BLOCKS,
      tutorOfDay: { name: "Sophie" },
    });
    expect(r.header.tutorLine).toBe("Tutor today: Sophie");
  });

  it("resources are mapped with kind label, optional URL, and filtered for blanks", () => {
    const r = planPrintableSchedule({
      dateIso: "2026-05-13",
      blocks: SAMPLE_BLOCKS,
      resources: [
        { kind: "worksheet", title: "Fractions practice" },
        { kind: "video", title: "Mitosis intro", url: "https://k.example/mitosis" },
        { kind: "lesson", title: "" },
        { kind: "link", title: "   " },
        null as any,
      ],
    });
    expect(r.resources).toEqual([
      "Worksheet — Fractions practice",
      "Video — Mitosis intro (https://k.example/mitosis)",
    ]);
  });

  it("noteLines defaults to 6 and clamps non-finite/negative to 6, large to 40", () => {
    expect(
      planPrintableSchedule({ dateIso: "2026-05-13", blocks: SAMPLE_BLOCKS })
        .noteLines,
    ).toBe(6);
    expect(
      planPrintableSchedule({
        dateIso: "2026-05-13",
        blocks: SAMPLE_BLOCKS,
        noteLines: -3,
      }).noteLines,
    ).toBe(6);
    expect(
      planPrintableSchedule({
        dateIso: "2026-05-13",
        blocks: SAMPLE_BLOCKS,
        noteLines: 10,
      }).noteLines,
    ).toBe(10);
    expect(
      planPrintableSchedule({
        dateIso: "2026-05-13",
        blocks: SAMPLE_BLOCKS,
        noteLines: 999,
      }).noteLines,
    ).toBe(40);
  });

  it("footer carries IEP paper-trail framing + submit-picture reminder", () => {
    const r = planPrintableSchedule({
      dateIso: "2026-05-13",
      blocks: SAMPLE_BLOCKS,
    });
    expect(r.footer).toMatch(/IEP paper-trail/);
    expect(r.footer).toMatch(/submit a picture/);
  });

  it("ignores blocks with non-finite duration / blank label / bad time", () => {
    const r = planPrintableSchedule({
      dateIso: "2026-05-13",
      blocks: [
        { startHHMM: "07:30", durationMin: 30, label: "Math" },
        { startHHMM: "07:30", durationMin: NaN, label: "Math2" } as any,
        { startHHMM: "7:30", durationMin: 30, label: "Math3" } as any,
        { startHHMM: "08:00", durationMin: 30, label: "  " },
      ],
    });
    expect(r.blocks.map((b) => b.line)).toEqual([
      "07:30  Math (30 min)",
    ]);
  });

  it("kidName whitespace-only falls back to Reagan", () => {
    const r = planPrintableSchedule({
      dateIso: "2026-05-13",
      kidName: "   ",
      blocks: SAMPLE_BLOCKS,
    });
    expect(r.header.title.startsWith("Reagan's Schedule")).toBe(true);
  });
});
