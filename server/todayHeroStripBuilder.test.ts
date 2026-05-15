import { describe, it, expect } from "vitest";
import {
  buildTodayHeroStrip,
  __FOR_TEST__,
  type HeroInput,
} from "./_lib/todayHeroStripBuilder";

const baseInput: HeroInput = {
  praiseHeadline: "You came back. That counts.",
  praisePillar: "feel_safe",
  appChips: [
    { appKey: "khan", label: "Khan Academy" },
    { appKey: "ixl", label: "IXL" },
    { appKey: "pear_classes", label: "Pear Classes" },
  ],
};

describe("Push 202 — todayHeroStripBuilder", () => {
  it("uses praiseHeadline by default", () => {
    const r = buildTodayHeroStrip(baseInput);
    expect(r.headline).toBe("You came back. That counts.");
  });

  it("overrideHeadline takes precedence over praiseHeadline", () => {
    const r = buildTodayHeroStrip({
      ...baseInput,
      overrideHeadline: "Cap reached for today — well played.",
    });
    expect(r.headline).toBe("Cap reached for today — well played.");
  });

  it("falls back to a friendly default when both headlines are empty", () => {
    const r = buildTodayHeroStrip({ ...baseInput, praiseHeadline: "" });
    expect(r.headline.length).toBeGreaterThan(0);
  });

  it("source defaults to 'default' when praiseContext is omitted", () => {
    const r = buildTodayHeroStrip(baseInput);
    expect(r.source).toBe("default");
  });

  it("source mirrors praiseContext when provided", () => {
    const r = buildTodayHeroStrip({ ...baseInput, praiseContext: "great_day" });
    expect(r.source).toBe("great_day");
  });

  it("pillar mirrors praisePillar", () => {
    const r = buildTodayHeroStrip({
      ...baseInput,
      praisePillar: "you_are_smart",
    });
    expect(r.pillar).toBe("you_are_smart");
  });

  it("chips are at most MAX_CHIPS (4)", () => {
    const lots = Array.from({ length: 12 }, (_, i) => ({
      appKey: `app_${i}`,
      label: `App ${i}`,
    }));
    const r = buildTodayHeroStrip({ ...baseInput, appChips: lots });
    expect(r.chips.length).toBeLessThanOrEqual(__FOR_TEST__.MAX_CHIPS);
  });

  it("badge chip is first when present", () => {
    const r = buildTodayHeroStrip({
      ...baseInput,
      recentBadge: { id: "first_finished_book", label: "First book finished" },
    });
    expect(r.chips[0].kind).toBe("badge");
    expect(r.chips[0].badgeId).toBe("first_finished_book");
  });

  it("book chip comes after badge but before apps", () => {
    const r = buildTodayHeroStrip({
      ...baseInput,
      recentBadge: { id: "b1", label: "Badge 1" },
      recentBook: { title: "Frog and Toad" },
    });
    expect(r.chips[0].kind).toBe("badge");
    expect(r.chips[1].kind).toBe("book");
    expect(r.chips[1].label).toBe("Frog and Toad");
  });

  it("doodle chip comes after book but before apps", () => {
    const r = buildTodayHeroStrip({
      ...baseInput,
      recentBook: { title: "Frog and Toad" },
      recentDoodle: { promptLabel: "A friendly dragon" },
    });
    const kinds = r.chips.map((c) => c.kind);
    expect(kinds.indexOf("book")).toBeLessThan(kinds.indexOf("doodle"));
    expect(kinds.indexOf("doodle")).toBeLessThan(kinds.indexOf("app"));
  });

  it("dedupes app chips by appKey", () => {
    const r = buildTodayHeroStrip({
      ...baseInput,
      appChips: [
        { appKey: "khan", label: "Khan Academy" },
        { appKey: "khan", label: "Khan Academy DUP" },
        { appKey: "ixl", label: "IXL" },
      ],
    });
    const keys = r.chips.filter((c) => c.kind === "app").map((c) => c.appKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("skips app chips with empty appKey or label", () => {
    const r = buildTodayHeroStrip({
      ...baseInput,
      appChips: [
        { appKey: "", label: "Empty Key" },
        { appKey: "valid", label: "" },
        { appKey: "khan", label: "Khan Academy" },
      ],
    });
    const apps = r.chips.filter((c) => c.kind === "app");
    expect(apps.length).toBe(1);
    expect(apps[0].appKey).toBe("khan");
  });

  it("blocked IHSD email suppresses ALL app chips", () => {
    const r = buildTodayHeroStrip({
      ...baseInput,
      kidEmail: __FOR_TEST__.BLOCKED_EMAIL,
    });
    const apps = r.chips.filter((c) => c.kind === "app");
    expect(apps.length).toBe(0);
  });

  it("blocked IHSD email is matched case-insensitively", () => {
    const r = buildTodayHeroStrip({
      ...baseInput,
      kidEmail: __FOR_TEST__.BLOCKED_EMAIL.toUpperCase(),
    });
    const apps = r.chips.filter((c) => c.kind === "app");
    expect(apps.length).toBe(0);
  });

  it("blocked IHSD email still allows badge/book/doodle chips (kid feedback safety)", () => {
    const r = buildTodayHeroStrip({
      ...baseInput,
      kidEmail: __FOR_TEST__.BLOCKED_EMAIL,
      recentBadge: { id: "b1", label: "Badge 1" },
      recentBook: { title: "A book" },
    });
    const kinds = r.chips.map((c) => c.kind);
    expect(kinds).toContain("badge");
    expect(kinds).toContain("book");
  });

  it("allowed kid email still gets app chips", () => {
    const r = buildTodayHeroStrip({
      ...baseInput,
      kidEmail: "reaganhiggs910@gmail.com",
    });
    const apps = r.chips.filter((c) => c.kind === "app");
    expect(apps.length).toBeGreaterThan(0);
  });

  it("output is deterministic for the same input", () => {
    const a = buildTodayHeroStrip(baseInput);
    const b = buildTodayHeroStrip(baseInput);
    expect(a).toEqual(b);
  });

  it("empty appChips produces an empty (but valid) strip", () => {
    const r = buildTodayHeroStrip({ ...baseInput, appChips: [] });
    expect(r.chips.length).toBe(0);
    expect(r.headline.length).toBeGreaterThan(0);
  });

  it("preserves app chip 'hint' field", () => {
    const r = buildTodayHeroStrip({
      ...baseInput,
      appChips: [{ appKey: "khan", label: "Khan", hint: "Math today" }],
    });
    const app = r.chips.find((c) => c.appKey === "khan");
    expect(app?.hint).toBe("Math today");
  });

  it("composes the four-pillar set correctly", () => {
    const pillars = [
      "feel_safe",
      "understand",
      "grow_on_purpose",
      "you_are_smart",
    ] as const;
    for (const p of pillars) {
      const r = buildTodayHeroStrip({ ...baseInput, praisePillar: p });
      expect(r.pillar).toBe(p);
    }
  });

  it("MAX_CHIPS constant is 4", () => {
    expect(__FOR_TEST__.MAX_CHIPS).toBe(4);
  });

  it("BLOCKED_EMAIL is the IHSD address (canonical)", () => {
    expect(__FOR_TEST__.BLOCKED_EMAIL).toBe("reagan.higgs33@ihsd.us");
  });

  it("badge + book + doodle + app fills exactly 4 slots", () => {
    const r = buildTodayHeroStrip({
      ...baseInput,
      recentBadge: { id: "b1", label: "Badge 1" },
      recentBook: { title: "A book" },
      recentDoodle: { promptLabel: "A doodle" },
    });
    expect(r.chips.length).toBe(4);
    const kinds = r.chips.map((c) => c.kind);
    expect(kinds).toEqual(["badge", "book", "doodle", "app"]);
  });
});
