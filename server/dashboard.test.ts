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

  it("new plan auto-builds default cozy blocks", async () => {
    const date = "2030-02-15";
    const p = await db.ensurePlanForDate(date);
    expect(p).toBeTruthy();
    const blocks: any[] = await db.listBlocksForPlan(p!.id);
    expect(blocks.length).toBeGreaterThanOrEqual(7);
    expect(blocks.some((b: any) => b.title.toLowerCase().includes("choice"))).toBe(true);
  });

  it("Wednesday plan auto-builds therapy variant with appointment", async () => {
    const date = "2030-02-20"; // Wednesday
    const p = await db.ensurePlanForDate(date);
    expect(p).toBeTruthy();
    const blocks: any[] = await db.listBlocksForPlan(p!.id);
    expect(blocks.some((b: any) => b.title.toLowerCase().includes("therapy"))).toBe(true);
  });

  it("knowledge listing works", async () => {
    const k = await db.listKnowledge(true);
    expect(Array.isArray(k)).toBe(true);
  });

  it("insertStruggle persists with intensity + triggers", async () => {
    const inserted: any = await db.insertStruggle({
      subjectSlug: "math",
      description: "vitest fixture",
      intensity: "yellow",
      triggers: ["too hard"],
      copingUsed: ["a break"],
      resolved: false,
      loggedByUserId: null,
    } as any);
    void inserted;
    const list: any[] = await db.listStruggles(30);
    expect(list.some(s => s.description === "vitest fixture")).toBe(true);
  });

  it("strugglesBySubject filters", async () => {
    const list: any[] = await db.listStrugglesBySubject("math");
    expect(Array.isArray(list)).toBe(true);
  });

  it("listSpecialDays returns array", async () => {
    const list: any[] = await db.listUpcomingSpecialDays(30);
    expect(Array.isArray(list)).toBe(true);
  });

  it("badges list loads with at least one badge", async () => {
    const badges: any[] = await db.listBadges();
    expect(Array.isArray(badges)).toBe(true);
    expect(badges.length).toBeGreaterThan(0);
  });

  it("listRecipients returns family circle (Mom + Grandma)", async () => {
    const recips: any[] = await db.listRecipients();
    expect(recips.length).toBeGreaterThanOrEqual(2);
    const emails = recips.map((r: any) => (r.email || "").toLowerCase());
    expect(emails.some(e => e.includes("spear.cpt") || e.includes("marcy.spear"))).toBe(true);
  });

  it("name change regex matches several phrasings", () => {
    const phrases = [
      "call you Sunny",
      "your name is Sunny",
      "I'll call you Sunny",
      "I want to call you Sunny",
      "new name is Sunny",
    ];
    const regex = /(?:call (?:you|yourself)|your name is|i(?:'ll| will| wanna| want to)? call you|new name is|name yourself)\s+([A-Za-z][A-Za-z\- ]{1,18})/i;
    for (const p of phrases) {
      const m = p.match(regex);
      expect(m).toBeTruthy();
      expect((m as any)[1]).toMatch(/Sunny/i);
    }
  });

  it("upsertProfile can change companionName", async () => {
    const before: any = await db.getProfile();
    const original = before?.companionName || "Whisper";
    await db.upsertProfile({ companionName: "Sunny" } as any);
    const after: any = await db.getProfile();
    expect(after?.companionName).toBe("Sunny");
    // restore
    await db.upsertProfile({ companionName: original } as any);
  });

  it("today digest data composes plan + blocks + struggles", async () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const plan: any = await db.ensurePlanForDate(todayStr);
    expect(plan).toBeTruthy();
    const blocks: any[] = await db.listBlocksForPlan(plan.id);
    expect(Array.isArray(blocks)).toBe(true);
    const struggles: any[] = await db.listStruggles(7);
    expect(Array.isArray(struggles)).toBe(true);
  });
});
