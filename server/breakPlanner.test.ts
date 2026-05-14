import { describe, it, expect } from "vitest";
import { pickReaganBreak } from "./_lib/breakPlanner";

const BASE = {
  iso: "2026-05-15",
  name: "Reagan",
  mood: "okay" as const,
  weather: "sunny-cool" as const,
  hourOfDay: 11,
  adultPresent: true,
};

describe("Push 170 — pickReaganBreak", () => {
  it("rejects bad input", () => {
    expect(() => pickReaganBreak(null as any)).toThrow();
    expect(() => pickReaganBreak({ ...BASE, iso: "bad" })).toThrow();
    expect(() => pickReaganBreak({ ...BASE, name: "" })).toThrow();
    expect(() => pickReaganBreak({ ...BASE, hourOfDay: 99 })).toThrow();
  });

  it("returns a suggestion under normal conditions", () => {
    const r = pickReaganBreak(BASE);
    expect(r.suggestion).not.toBeNull();
    expect(r.candidatePool.length).toBeGreaterThan(0);
  });

  it("never suggests outdoor when weather is rainy", () => {
    const r = pickReaganBreak({ ...BASE, weather: "rainy" });
    expect(r.candidatePool).not.toContain("outdoor");
  });

  it("never suggests outdoor when no adult present", () => {
    const r = pickReaganBreak({ ...BASE, adultPresent: false });
    expect(r.candidatePool).not.toContain("outdoor");
  });

  it("never suggests outdoor at night", () => {
    const r = pickReaganBreak({ ...BASE, hourOfDay: 21 });
    expect(r.candidatePool).not.toContain("outdoor");
  });

  it("never suggests petting when no pets", () => {
    const r = pickReaganBreak({ ...BASE, pets: [] });
    expect(r.candidatePool).not.toContain("petting");
  });

  it("hard-veto removes a kind from the pool", () => {
    const r = pickReaganBreak({ ...BASE, vetoKinds: ["snack"] });
    expect(r.candidatePool).not.toContain("snack");
  });

  it("frustrated mood favors music/art/outdoor", () => {
    const r = pickReaganBreak({ ...BASE, mood: "frustrated" });
    expect(["music", "art", "outdoor", "petting"]).toContain(r.suggestion!.kind);
  });

  it("tired mood favors snack/water/stretch", () => {
    const r = pickReaganBreak({ ...BASE, mood: "tired" });
    expect(["snack", "water", "stretch"]).toContain(r.suggestion!.kind);
  });

  it("avoids recent kinds when possible", () => {
    const r = pickReaganBreak({
      ...BASE,
      mood: "tired",
      recentBreakKinds: ["snack", "water", "stretch"],
    });
    expect(["snack", "water", "stretch"]).not.toContain(r.suggestion!.kind);
  });

  it("kid line is never timed", () => {
    const r = pickReaganBreak(BASE);
    expect(r.suggestion!.kidLine).not.toMatch(/\d+\s*(min|minute|second|sec)/i);
    expect(r.suggestion!.kidLine).not.toMatch(/timer|countdown/i);
  });

  it("is deterministic", () => {
    const a = pickReaganBreak(BASE);
    const b = pickReaganBreak(BASE);
    expect(b).toEqual(a);
  });

  it("returns null suggestion when every kind vetoed", () => {
    const all = ["outdoor","art","snack","stretch","music","petting","water","free-play"] as const;
    const r = pickReaganBreak({ ...BASE, vetoKinds: [...all] });
    expect(r.suggestion).toBeNull();
  });

  it("petting only available when matching pet present", () => {
    const r = pickReaganBreak({ ...BASE, mood: "tired", pets: ["dog"] });
    expect(r.candidatePool).toContain("petting");
  });
});
