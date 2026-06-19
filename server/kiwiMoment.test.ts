import { describe, it, expect } from "vitest";
import {
  resolveKiwiMoment,
  resolveKiwiSocial,
  getTimeSegment,
  DUCK_VISIT_LINES,
  LYCHEE_FOLLOW_LINES,
  LYCHEE_BICKER_LINES,
  LYCHEE_PREEN_LINES,
  LYCHEE_FLYOFF_LINES,
  LYCHEE_BERRY_LINES,
  LYCHEE_SYNCHOP_LINES,
} from "../shared/kiwiCharacter";

// A plain everyday date with no special costume/guest so the moment engine is
// free to rotate mood + idle lines by time of day. (Far from holidays.)
const EVERYDAY = "2026-09-16";

describe("getTimeSegment", () => {
  it("maps hours to the correct day segment", () => {
    expect(getTimeSegment(6)).toBe("dawn");
    expect(getTimeSegment(9)).toBe("morning");
    expect(getTimeSegment(12)).toBe("midday");
    expect(getTimeSegment(15)).toBe("afternoon");
    expect(getTimeSegment(18)).toBe("evening");
    expect(getTimeSegment(23)).toBe("night");
    expect(getTimeSegment(2)).toBe("night");
  });

  it("is robust to out-of-range / negative hours", () => {
    expect(getTimeSegment(26)).toBe(getTimeSegment(2)); // wraps
    expect(getTimeSegment(-2)).toBe(getTimeSegment(22));
  });
});

describe("resolveKiwiMoment", () => {
  it("is deterministic for the same date+hour", () => {
    const a = resolveKiwiMoment(EVERYDAY, {}, 9);
    const b = resolveKiwiMoment(EVERYDAY, {}, 9);
    expect(a.idleLine).toBe(b.idleLine);
    expect(a.mood).toBe(b.mood);
    expect(a.funnyLine).toBe(b.funnyLine);
    expect(a.segment).toBe(b.segment);
  });

  it("reports the segment + hour it was resolved for", () => {
    const m = resolveKiwiMoment(EVERYDAY, {}, 18);
    expect(m.hour).toBe(18);
    expect(m.segment).toBe("evening");
  });

  it("rotates the idle line across the day on an ordinary day", () => {
    const hours = [6, 9, 12, 15, 18, 22];
    const lines = hours.map((h) => resolveKiwiMoment(EVERYDAY, {}, h).idleLine);
    const unique = new Set(lines);
    // The look should visibly change through the day rather than being frozen
    // to one line all day (the old bug this engine fixes).
    expect(unique.size).toBeGreaterThanOrEqual(3);
  });

  it("rotates the mood across segments too", () => {
    const hours = [6, 9, 12, 15, 18, 22];
    const moods = hours.map((h) => resolveKiwiMoment(EVERYDAY, {}, h).mood);
    expect(new Set(moods).size).toBeGreaterThanOrEqual(2);
  });

  it("always returns non-empty idle + funny lines for every hour", () => {
    for (let h = 0; h < 24; h++) {
      const m = resolveKiwiMoment(EVERYDAY, {}, h);
      expect(m.idleLine.length).toBeGreaterThan(0);
      expect(m.funnyLine.length).toBeGreaterThan(0);
    }
  });
});

describe("resolveKiwiSocial", () => {
  it("is deterministic for the same date+hour", () => {
    const a = resolveKiwiSocial(EVERYDAY, 10);
    const b = resolveKiwiSocial(EVERYDAY, 10);
    expect(a).toEqual(b);
  });

  it("only ever yields the known guest ids and stable window index", () => {
    for (let h = 0; h < 24; h++) {
      const s = resolveKiwiSocial(EVERYDAY, h);
      expect([null, "lychee", "ducks"]).toContain(s.guestId);
      if (s.guestId !== null) expect(s.line.length).toBeGreaterThan(0);
      const expectedWindow = Math.floor((((h % 24) + 24) % 24) / 2);
      expect(s.windowIndex).toBe(expectedWindow);
    }
  });

  it("Lychee visits OFTEN across a month of windows", () => {
    let lychee = 0;
    let total = 0;
    for (let d = 1; d <= 28; d++) {
      const date = `2026-09-${String(d).padStart(2, "0")}`;
      for (let h = 0; h < 24; h += 2) {
        total++;
        if (resolveKiwiSocial(date, h).guestId === "lychee") lychee++;
      }
    }
    expect(lychee / total).toBeGreaterThan(0.4);
  });

  it("ducks are RARE compared to Lychee but do appear", () => {
    let ducks = 0;
    let lychee = 0;
    for (let d = 1; d <= 28; d++) {
      const date = `2026-09-${String(d).padStart(2, "0")}`;
      for (let h = 0; h < 24; h += 2) {
        const g = resolveKiwiSocial(date, h).guestId;
        if (g === "ducks") ducks++;
        if (g === "lychee") lychee++;
      }
    }
    expect(ducks).toBeGreaterThan(0);
    expect(ducks).toBeLessThan(lychee);
  });

  it("duck visits carry the waddle beat + a real duck line", () => {
    let found = false;
    for (let d = 1; d <= 60 && !found; d++) {
      const date = `2026-09-${String(((d - 1) % 28) + 1).padStart(2, "0")}`;
      const month = 9 + Math.floor((d - 1) / 28);
      const iso = `2026-${String(month).padStart(2, "0")}-${String(((d - 1) % 28) + 1).padStart(2, "0")}`;
      for (let h = 0; h < 24; h += 2) {
        const s = resolveKiwiSocial(iso, h);
        if (s.guestId === "ducks") {
          expect(s.beat).toBe("waddle");
          expect(DUCK_VISIT_LINES).toContain(s.line);
          found = true;
          break;
        }
      }
      void date;
    }
    expect(found).toBe(true);
  });

  it("Lychee beats use the matching banter bank", () => {
    const banks: Record<string, string[]> = {
      follow: LYCHEE_FOLLOW_LINES,
      bicker: LYCHEE_BICKER_LINES,
      preen: LYCHEE_PREEN_LINES,
      flyoff: LYCHEE_FLYOFF_LINES,
      sharedberry: LYCHEE_BERRY_LINES,
      synchop: LYCHEE_SYNCHOP_LINES,
      chatter: LYCHEE_FOLLOW_LINES, // chatter falls back to the follow bank
    };
    for (let d = 1; d <= 14; d++) {
      const date = `2026-09-${String(d).padStart(2, "0")}`;
      for (let h = 0; h < 24; h += 2) {
        const s = resolveKiwiSocial(date, h);
        if (s.guestId === "lychee" && s.beat) {
          expect(banks[s.beat]).toContain(s.line);
        }
      }
    }
  });
});
