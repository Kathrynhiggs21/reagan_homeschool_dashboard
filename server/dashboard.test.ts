import { describe, it, expect } from "vitest";
import * as db from "./db";

describe("Reagan Dashboard core helpers", () => {
  it("wellness score returns valid shape", async () => {
    const w: any = await db.wellnessScore(7);
    expect(w).toBeTruthy();
    expect(typeof w.anxietyScore).toBe("number");
  });

  it("listSubjects returns seeded subjects", async () => {
    const subs = await db.listSubjects();
    expect(subs.length).toBeGreaterThan(0);
    const slugs = subs.map((s: any) => s.slug);
    expect(slugs).toContain("math");
    expect(slugs).toContain("ela");
    expect(slugs).toContain("science");
  });

  it("listAdventures returns seeded adventures", async () => {
    const advs = await db.listAdventures();
    expect(advs.length).toBeGreaterThan(20);
  });

  it("getProfile returns Animal Whisperer", async () => {
    const p = await db.getProfile();
    expect(p).toBeTruthy();
    expect(p?.studentName?.toLowerCase()).toContain("reagan");
  });

  it("listAnimals returns Reagan's pets", async () => {
    const animals = await db.listAnimals();
    expect(animals.length).toBeGreaterThan(0);
  });

  it("listBadges returns badges", async () => {
    const badges = await db.listBadges();
    expect(badges.length).toBeGreaterThan(0);
  });

  it("ensurePlanForDate creates a plan idempotently", async () => {
    const date = "2030-01-01";
    const p1 = await db.ensurePlanForDate(date);
    const p2 = await db.ensurePlanForDate(date);
    expect(p1?.id).toBe(p2?.id);
  });

  it("knowledge listing works", async () => {
    const k = await db.listKnowledge(true);
    expect(Array.isArray(k)).toBe(true);
  });
});
