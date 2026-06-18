import { describe, it, expect } from "vitest";
import { layoutBlocks, type AgendaBlockLite } from "@/components/AgendaCalendarStrip";

/**
 * 2026-05-30 — `layoutBlocks` decides where each agenda block lands on the
 * Schedule page's calendar strip. Critical for the "agenda as a calendar
 * layer" feature so timed blocks stay where they belong and untimed blocks
 * still get a sensible spot.
 */
describe("AgendaCalendarStrip.layoutBlocks", () => {
  const startHour = 7;
  const endHour = 18;

  it("places timed blocks at their startTime relative to the timeline origin", () => {
    const blocks: AgendaBlockLite[] = [
      { id: 1, title: "Math", startTime: "09:00", durationMin: 30 },
      { id: 2, title: "ELA", startTime: "10:30", durationMin: 25 },
    ];
    const placed = layoutBlocks(blocks, startHour, endHour);
    expect(placed).toHaveLength(2);
    // 09:00 - 07:00 = 2h = 120 min from origin
    expect(placed[0].startMin).toBe(120);
    expect(placed[0].endMin).toBe(150);
    // 10:30 - 07:00 = 3h30m = 210 min from origin
    expect(placed[1].startMin).toBe(210);
    expect(placed[1].endMin).toBe(235);
  });

  it("flows untimed blocks sequentially starting at 10 AM (summer default)", () => {
    const blocks: AgendaBlockLite[] = [
      { id: 1, title: "First", durationMin: 30 },
      { id: 2, title: "Second", durationMin: 20 },
    ];
    const placed = layoutBlocks(blocks, startHour, endHour);
    // 10:00 - 07:00 = 180 min
    expect(placed[0].startMin).toBe(180);
    expect(placed[0].endMin).toBe(210);
    // Next block flows 5 min after the first (30 + 5 = 35 → starts at 215)
    expect(placed[1].startMin).toBe(215);
    expect(placed[1].endMin).toBe(235);
  });

  it("flows untimed blocks AFTER timed blocks, not on top of them", () => {
    const blocks: AgendaBlockLite[] = [
      { id: 1, title: "Untimed first", durationMin: 30 },
      { id: 2, title: "Timed late", startTime: "14:00", durationMin: 30 },
    ];
    const placed = layoutBlocks(blocks, startHour, endHour);
    expect(placed).toHaveLength(2);
    // After sorting by startMin, the untimed block (which flows after timed)
    // should sit AFTER the 14:00 block.
    const timed = placed.find((p) => p.title === "Timed late")!;
    const untimed = placed.find((p) => p.title === "Untimed first")!;
    expect(untimed.startMin).toBeGreaterThanOrEqual(timed.endMin + 5);
  });

  it("clamps blocks that overrun the visible window to fit inside it", () => {
    const blocks: AgendaBlockLite[] = [
      { id: 1, title: "Late late", startTime: "17:30", durationMin: 240 },
    ];
    const placed = layoutBlocks(blocks, startHour, endHour);
    const visibleSpan = (endHour - startHour) * 60;
    expect(placed[0].endMin).toBeLessThanOrEqual(visibleSpan);
  });

  it("normalizes the legacy `minutes` field to `durationMin`", () => {
    const blocks: AgendaBlockLite[] = [
      { id: 1, title: "Legacy", startTime: "09:00", minutes: 45 },
    ];
    const placed = layoutBlocks(blocks, startHour, endHour);
    expect(placed[0].endMin - placed[0].startMin).toBe(45);
  });

  it("sorts the output array by startMin so DOM order matches visual order", () => {
    const blocks: AgendaBlockLite[] = [
      { id: 1, title: "Late", startTime: "11:00", durationMin: 30 },
      { id: 2, title: "Early", startTime: "08:00", durationMin: 30 },
      { id: 3, title: "Mid", startTime: "10:00", durationMin: 30 },
    ];
    const placed = layoutBlocks(blocks, startHour, endHour);
    expect(placed.map((p) => p.title)).toEqual(["Early", "Mid", "Late"]);
  });

  it("never produces a zero-or-negative-height bar", () => {
    const blocks: AgendaBlockLite[] = [
      { id: 1, title: "Tiny", startTime: "09:00", durationMin: 0 as any },
    ];
    const placed = layoutBlocks(blocks, startHour, endHour);
    expect(placed[0].endMin).toBeGreaterThan(placed[0].startMin);
  });
});
