import { describe, it, expect } from "vitest";
import {
  resolveKiwiDayCharacter,
  matchEventCostume,
  resolveHoliday,
  stableHash,
  kiwiProjectForTick,
  ALL_PROJECT_KINDS,
  DEFAULT_FAVORITE_SHOW,
} from "../shared/kiwiCharacter";

describe("kiwiCharacter — deterministic resolver", () => {
  it("returns the same character for the same date + context (stable all day)", () => {
    const a = resolveKiwiDayCharacter("2026-09-15", { eventTitles: ["Math"] });
    const b = resolveKiwiDayCharacter("2026-09-15", { eventTitles: ["Math"] });
    expect(a).toEqual(b);
  });

  it("varies the funny line across different dates", () => {
    const lines = new Set<string>();
    for (let d = 1; d <= 20; d++) {
      const iso = `2026-09-${String(d).padStart(2, "0")}`;
      lines.add(resolveKiwiDayCharacter(iso, {}).funnyLine);
    }
    // Not all identical — the bank rotates by date.
    expect(lines.size).toBeGreaterThan(1);
  });

  it("defaults to everyday costume with no events/holidays", () => {
    const c = resolveKiwiDayCharacter("2026-09-15", {});
    expect(c.costume).toBe("none");
    expect(c.reason).toBe("everyday");
  });
});

describe("kiwiCharacter — calendar event costumes", () => {
  it("maps soccer to a jersey", () => {
    expect(resolveKiwiDayCharacter("2026-09-15", { eventTitles: ["Soccer practice 5pm"] }).costume).toBe("jersey");
  });
  it("maps doctor/dentist to a lab coat", () => {
    expect(resolveKiwiDayCharacter("2026-09-15", { eventTitles: ["Dentist checkup"] }).costume).toBe("labcoat");
  });
  it("prioritizes injury/cast over a doctor visit", () => {
    // 'cast' rule is ordered before 'labcoat', and both keywords present.
    const c = resolveKiwiDayCharacter("2026-09-15", { eventTitles: ["Doctor for broken arm cast"] });
    expect(c.costume).toBe("cast");
  });
  it("maps swim to swim goggles", () => {
    expect(resolveKiwiDayCharacter("2026-09-15", { eventTitles: ["Swim lessons"] }).costume).toBe("swim");
  });
  it("maps birthday to a party hat", () => {
    expect(resolveKiwiDayCharacter("2026-09-15", { eventTitles: ["Reagan birthday party"] }).costume).toBe("partyhat");
  });
  it("calendar event beats a holiday on the same day", () => {
    // Dec 25 is a holiday, but a soccer event should win (event has priority).
    const c = resolveKiwiDayCharacter("2026-12-25", { eventTitles: ["Soccer game"] });
    expect(c.costume).toBe("jersey");
    expect(c.reason).toBe("calendar-event");
  });
});

describe("kiwiCharacter — holidays", () => {
  it("resolves Christmas to Santa", () => {
    expect(resolveHoliday(12, 25)?.costume).toBe("santa");
  });
  it("resolves Halloween range to witch", () => {
    expect(resolveHoliday(10, 31)?.costume).toBe("witch");
    expect(resolveHoliday(10, 30)?.costume).toBe("witch");
  });
  it("resolves Valentine's to heart", () => {
    expect(resolveHoliday(2, 14)?.costume).toBe("heart");
  });
  it("returns null for a normal day", () => {
    expect(resolveHoliday(9, 15)).toBeNull();
  });
  it("uses holiday costume when no event and reason=holiday", () => {
    const c = resolveKiwiDayCharacter("2026-07-04", {});
    expect(c.costume).toBe("firework");
    expect(c.reason).toBe("holiday");
  });
});

describe("kiwiCharacter — vacation + guest birds", () => {
  it("marks vacation when onVacation and no event/holiday", () => {
    const c = resolveKiwiDayCharacter("2026-09-15", { onVacation: true });
    expect(c.costume).toBe("vacation");
    expect(c.reason).toBe("vacation");
    expect(c.onVacation).toBe(true);
  });
  it("detects a guest bird from an explicit flag", () => {
    const c = resolveKiwiDayCharacter("2026-09-15", { birdVisit: true });
    expect(["lychee", "blue", "daffy", "honk"]).toContain(c.guestBird);
  });
  it("detects a guest bird from an event title", () => {
    const c = resolveKiwiDayCharacter("2026-09-15", { eventTitles: ["Visit from friend"] });
    expect(c.guestBird).not.toBeNull();
  });
  it("has no guest bird on an ordinary day", () => {
    expect(resolveKiwiDayCharacter("2026-09-15", { eventTitles: ["Math"] }).guestBird).toBeNull();
  });
});

describe("kiwiCharacter — favorite show label injection", () => {
  it("injects a custom show label into showfan lines", () => {
    const c = resolveKiwiDayCharacter("2026-09-15", {
      eventTitles: ["Tracker premiere tonight"],
      favoriteShowLabel: "Tracker",
    });
    expect(c.costume).toBe("showfan");
    expect(c.funnyLine.toLowerCase()).not.toContain("the show");
  });
  it("exposes a sensible default show label", () => {
    expect(DEFAULT_FAVORITE_SHOW.length).toBeGreaterThan(0);
  });
});

describe("kiwiCharacter — matchEventCostume helper", () => {
  it("is case-insensitive and substring-based", () => {
    expect(matchEventCostume(["SOCCER!!!"])?.costume).toBe("jersey");
    expect(matchEventCostume(["nothing here"])).toBeNull();
  });
});

describe("kiwiCharacter — stableHash", () => {
  it("is deterministic and non-negative", () => {
    expect(stableHash("abc")).toBe(stableHash("abc"));
    expect(stableHash("abc")).toBeGreaterThanOrEqual(0);
  });
  it("differs for different inputs", () => {
    expect(stableHash("abc")).not.toBe(stableHash("abd"));
  });
});

describe("kiwiCharacter — slow ambient projects", () => {
  it("clamps the stage within bounds", () => {
    const p0 = kiwiProjectForTick("nest", 0);
    expect(p0.stage).toBe(0);
    const pBig = kiwiProjectForTick("nest", 999);
    expect(pBig.stage).toBe(pBig.totalStages - 1);
  });
  it("returns a line for every project kind", () => {
    for (const kind of ALL_PROJECT_KINDS) {
      const p = kiwiProjectForTick(kind, 1);
      expect(typeof p.line).toBe("string");
      expect(p.line.length).toBeGreaterThan(0);
    }
  });
});
