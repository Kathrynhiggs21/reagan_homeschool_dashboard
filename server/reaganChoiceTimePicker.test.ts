import { describe, it, expect } from "vitest";
import { pickReaganChoiceTime, type ChoiceOption } from "./_lib/reaganChoiceTimePicker";

const POOL: ChoiceOption[] = [
  { id: "bird-vid", label: "Watch a bird video", location: "indoor", energy: "low", durationMin: 15, tags: ["screen", "calm"] },
  { id: "art", label: "Paint at the table", location: "indoor", energy: "low", durationMin: 25, needsAdult: true, tags: ["art"] },
  { id: "yard-bird", label: "Bird-watch in the yard", location: "outdoor", energy: "low", durationMin: 20, tags: ["outside"] },
  { id: "bike", label: "Ride your bike", location: "outdoor", energy: "high", durationMin: 25, tags: ["outside"] },
  { id: "fort", label: "Build a fort", location: "indoor", energy: "medium", durationMin: 30, tags: ["build"] },
  { id: "lego", label: "Lego time", location: "indoor", energy: "medium", durationMin: 20, tags: ["build"] },
  { id: "library", label: "Library run", location: "outdoor", energy: "medium", durationMin: 45, needsCar: true, needsAdult: true },
  { id: "puzzle", label: "Big puzzle", location: "indoor", energy: "low", durationMin: 30, tags: ["calm"] },
];

describe("Push 164 — pickReaganChoiceTime", () => {
  it("rejects bad input", () => {
    expect(() => pickReaganChoiceTime(null as any)).toThrow();
    expect(() => pickReaganChoiceTime({ schoolDayISO: "bad", studentName: "R", pool: [], availableMinutes: 10 } as any)).toThrow();
  });

  it("returns 3 picks by default", () => {
    const r = pickReaganChoiceTime({
      schoolDayISO: "2026-05-15",
      studentName: "Reagan",
      pool: POOL,
      availableMinutes: 30,
    });
    expect(r.picks.length).toBe(3);
    expect(r.headline).toMatch(/Reagan/);
    expect(r.headline).toMatch(/30 min/);
  });

  it("filters out options too long for availableMinutes", () => {
    const r = pickReaganChoiceTime({
      schoolDayISO: "2026-05-15",
      studentName: "Reagan",
      pool: POOL,
      availableMinutes: 18,
    });
    for (const p of r.picks) expect(p.durationMin).toBeLessThanOrEqual(18);
    expect(r.filteredReason ?? "").toMatch(/too long/);
  });

  it("hides outdoor options when weatherIsWet", () => {
    const r = pickReaganChoiceTime({
      schoolDayISO: "2026-05-15",
      studentName: "Reagan",
      pool: POOL,
      availableMinutes: 60,
      weatherIsWet: true,
    });
    for (const p of r.picks) expect(p.location).not.toBe("outdoor");
    expect(r.filteredReason ?? "").toMatch(/wet weather/);
  });

  it("hides options that need an adult when momIsHome=false", () => {
    const r = pickReaganChoiceTime({
      schoolDayISO: "2026-05-15",
      studentName: "Reagan",
      pool: POOL,
      availableMinutes: 60,
      momIsHome: false,
    });
    for (const p of r.picks) expect(p.needsAdult ?? false).toBe(false);
  });

  it("hides options that need the car when carIsAvailable=false", () => {
    const r = pickReaganChoiceTime({
      schoolDayISO: "2026-05-15",
      studentName: "Reagan",
      pool: POOL,
      availableMinutes: 60,
      carIsAvailable: false,
    });
    for (const p of r.picks) expect(p.needsCar ?? false).toBe(false);
  });

  it("hides high-energy options when mood is tired or frustrated", () => {
    for (const m of ["tired", "frustrated"] as const) {
      const r = pickReaganChoiceTime({
        schoolDayISO: "2026-05-15",
        studentName: "Reagan",
        pool: POOL,
        availableMinutes: 60,
        moodBand: m,
      });
      for (const p of r.picks) expect(p.energy).not.toBe("high");
      expect(r.filteredReason ?? "").toMatch(new RegExp(m));
    }
  });

  it("blocks the same pick 3 days in a row", () => {
    const r = pickReaganChoiceTime({
      schoolDayISO: "2026-05-15",
      studentName: "Reagan",
      pool: POOL,
      availableMinutes: 60,
      pickedYesterdayId: "lego",
      pickedDayBeforeId: "lego",
    });
    expect(r.picks.find((p) => p.id === "lego")).toBeUndefined();
    expect(r.filteredReason ?? "").toMatch(/3 days in a row/);
  });

  it("does NOT block when only yesterday matches (just 2 in a row)", () => {
    // Force determinism: with no other filters and a 60-min budget, the
    // shuffler must include lego in the 3 picks at least sometimes — but
    // the key behavioural assertion is "it's not banned".
    const r = pickReaganChoiceTime({
      schoolDayISO: "2026-05-15",
      studentName: "Reagan",
      pool: POOL,
      availableMinutes: 60,
      pickedYesterdayId: "lego",
      pickedDayBeforeId: "puzzle",
    });
    // Either lego is in the picks, OR another option is — both are allowed.
    expect(r.filteredReason ?? "").not.toMatch(/3 days in a row/);
  });

  it("is deterministic — same input gives same picks across calls", () => {
    const args = {
      schoolDayISO: "2026-05-15",
      studentName: "Reagan",
      pool: POOL,
      availableMinutes: 30,
    };
    const a = pickReaganChoiceTime(args);
    const b = pickReaganChoiceTime(args);
    expect(a.picks.map((p) => p.id)).toEqual(b.picks.map((p) => p.id));
  });

  it("different ISO day gives different picks", () => {
    const a = pickReaganChoiceTime({ schoolDayISO: "2026-05-15", studentName: "Reagan", pool: POOL, availableMinutes: 30 });
    const b = pickReaganChoiceTime({ schoolDayISO: "2026-05-16", studentName: "Reagan", pool: POOL, availableMinutes: 30 });
    expect(a.picks.map((p) => p.id)).not.toEqual(b.picks.map((p) => p.id));
  });

  it("returns empty picks + clear headline when nothing fits", () => {
    const r = pickReaganChoiceTime({
      schoolDayISO: "2026-05-15",
      studentName: "Reagan",
      pool: POOL,
      availableMinutes: 5, // every option is longer than 5
    });
    expect(r.picks.length).toBe(0);
    expect(r.headline).toMatch(/no choice-time options/i);
  });

  it("recent picks get pushed to the back but not banned", () => {
    const recent = ["bird-vid", "art", "yard-bird"]; // mark 3 as recent
    const r = pickReaganChoiceTime({
      schoolDayISO: "2026-05-15",
      studentName: "Reagan",
      pool: POOL,
      availableMinutes: 60,
      recentlyPickedIds: recent,
    });
    // First pick should be NOT in recent (fresh comes first).
    expect(recent).not.toContain(r.picks[0].id);
  });

  it("pickCount is clamped to 1..5", () => {
    expect(pickReaganChoiceTime({ schoolDayISO: "2026-05-15", studentName: "Reagan", pool: POOL, availableMinutes: 60, pickCount: 0 }).picks.length).toBeGreaterThanOrEqual(1);
    expect(pickReaganChoiceTime({ schoolDayISO: "2026-05-15", studentName: "Reagan", pool: POOL, availableMinutes: 60, pickCount: 99 }).picks.length).toBeLessThanOrEqual(5);
  });
});
