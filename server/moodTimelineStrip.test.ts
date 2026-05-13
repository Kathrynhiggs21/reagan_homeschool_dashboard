/**
 * Push 90 (2026-05-13) — Mood timeline strip contract.
 *
 * Locks:
 *   - Empty input → cells filled but every zone is null (hasAny=false).
 *     The component uses hasAny=false to self-hide. NO INFO → NO RENDER.
 *   - Default window is 8a..4p (8 cells).
 *   - Entries map to the correct local hour using tzOffsetMin.
 *   - When multiple entries hit the same hour, the latest wins.
 *   - Entries outside the day window are filtered out.
 *   - Zone → color mapping matches the agreed palette
 *     (green=#22c55e, yellow=#eab308, red=#ef4444).
 */
import { describe, it, expect } from "vitest";
import {
  buildMoodTimelineStrip,
  zoneToColor,
  type MoodLogInput,
} from "./_lib/moodTimelineStrip";

const LOCAL_DATE = "2026-05-13";
// EDT = UTC-4 → tzOffsetMin = -240
const TZ = -240;

function utcMsForLocal(dateIso: string, hour: number, minute = 0): number {
  // local = UTC + tzOffsetMin minutes → UTC = local - tzOffsetMin
  // Build the local clock date then subtract the offset.
  const [y, m, d] = dateIso.split("-").map(Number);
  const localUtcMs = Date.UTC(y, m - 1, d, hour, minute, 0);
  return localUtcMs - TZ * 60_000;
}

describe("Push 90 — buildMoodTimelineStrip", () => {
  it("default window is 8a..4p (8 cells)", () => {
    const out = buildMoodTimelineStrip([], {
      localDateIso: LOCAL_DATE,
      tzOffsetMin: TZ,
    });
    expect(out.cells).toHaveLength(8);
    expect(out.cells[0].hour).toBe(8);
    expect(out.cells[0].hourLabel).toBe("8a");
    expect(out.cells[7].hour).toBe(15);
    expect(out.cells[7].hourLabel).toBe("3p");
  });

  it("empty input → hasAny=false (component self-hides)", () => {
    const out = buildMoodTimelineStrip([], {
      localDateIso: LOCAL_DATE,
      tzOffsetMin: TZ,
    });
    expect(out.hasAny).toBe(false);
    for (const c of out.cells) expect(c.zone).toBeNull();
  });

  it("places an entry into the correct local hour", () => {
    const rows: MoodLogInput[] = [
      { loggedAtMs: utcMsForLocal(LOCAL_DATE, 10, 15), zone: "green", note: "feeling good" },
    ];
    const out = buildMoodTimelineStrip(rows, {
      localDateIso: LOCAL_DATE,
      tzOffsetMin: TZ,
    });
    const cell = out.cells.find((c) => c.hour === 10)!;
    expect(cell.zone).toBe("green");
    expect(cell.note).toBe("feeling good");
    expect(out.hasAny).toBe(true);
  });

  it("latest entry wins when the same hour has multiple logs", () => {
    const rows: MoodLogInput[] = [
      { loggedAtMs: utcMsForLocal(LOCAL_DATE, 11, 5), zone: "yellow", note: "wobbly" },
      { loggedAtMs: utcMsForLocal(LOCAL_DATE, 11, 45), zone: "green", note: "recovered" },
    ];
    const out = buildMoodTimelineStrip(rows, {
      localDateIso: LOCAL_DATE,
      tzOffsetMin: TZ,
    });
    const cell = out.cells.find((c) => c.hour === 11)!;
    expect(cell.zone).toBe("green");
    expect(cell.note).toBe("recovered");
  });

  it("entries outside the window are ignored", () => {
    const rows: MoodLogInput[] = [
      { loggedAtMs: utcMsForLocal(LOCAL_DATE, 6, 0), zone: "red", note: "very early" },
      { loggedAtMs: utcMsForLocal(LOCAL_DATE, 17, 0), zone: "red", note: "after window" },
      { loggedAtMs: utcMsForLocal("2026-05-12", 10, 0), zone: "red", note: "yesterday" },
    ];
    const out = buildMoodTimelineStrip(rows, {
      localDateIso: LOCAL_DATE,
      tzOffsetMin: TZ,
    });
    expect(out.hasAny).toBe(false);
  });

  it("zone → color palette is locked", () => {
    expect(zoneToColor("green")).toBe("#22c55e");
    expect(zoneToColor("yellow")).toBe("#eab308");
    expect(zoneToColor("red")).toBe("#ef4444");
    expect(zoneToColor(null)).toBe("#3f3a30");
  });

  it("custom window (10a..2p) honored", () => {
    const out = buildMoodTimelineStrip([], {
      localDateIso: LOCAL_DATE,
      tzOffsetMin: TZ,
      startHour: 10,
      endHour: 14,
    });
    expect(out.cells).toHaveLength(4);
    expect(out.cells[0].hour).toBe(10);
    expect(out.cells[3].hour).toBe(13);
  });

  it("misordered start/end coerced safely (never empty)", () => {
    const out = buildMoodTimelineStrip([], {
      localDateIso: LOCAL_DATE,
      tzOffsetMin: TZ,
      startHour: 12,
      endHour: 9,
    });
    expect(out.cells.length).toBeGreaterThan(0);
  });
});
