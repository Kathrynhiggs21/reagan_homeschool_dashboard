import { describe, it, expect } from "vitest";
import {
  topicsForSignal,
  buildInterestProfile,
  mergeIntoStored,
  topInterestLabels,
  unlockedWearables,
  parseTakeoutWatchHistory,
  INTEREST_THEMES,
  type RawSignal,
  type StoredInterest,
} from "../shared/interestEngine";

describe("interestEngine — matching", () => {
  it("maps a clear bird title to the birds topic", () => {
    expect(topicsForSignal({ text: "My budgie did a trick!", source: "liked" })).toContain("birds");
  });

  it("matches against channel name too", () => {
    const t = topicsForSignal({ text: "ep 12", channel: "Bearded Dragon World", source: "subscription" });
    expect(t).toContain("reptiles");
  });

  it("a single video can hit multiple themes", () => {
    const t = topicsForSignal({ text: "How to draw a parrot", source: "liked" });
    expect(t).toContain("art");
    expect(t).toContain("birds");
  });

  it("unmapped content contributes to NO topic (never invents one)", () => {
    expect(topicsForSignal({ text: "asdf qwerty zzz", source: "liked" })).toEqual([]);
  });

  it("empty text yields nothing", () => {
    expect(topicsForSignal({ text: "", source: "liked" })).toEqual([]);
  });

  it("counts a topic only once per signal even if two keywords match", () => {
    // "dog" and "puppy" both map to animals; should still be a single hit topic
    const t = topicsForSignal({ text: "cute puppy and dog", source: "liked" });
    expect(t.filter((x) => x === "animals").length).toBe(1);
  });
});

describe("interestEngine — frequency/recurrence ranking", () => {
  it("ranks the topic she keeps coming back to highest", () => {
    const signals: RawSignal[] = [
      { text: "budgie morning routine", source: "watch_history" },
      { text: "parakeet tricks", source: "watch_history" },
      { text: "best bird toys", source: "watch_history" },
      { text: "my cockatiel sings", source: "watch_history" },
      { text: "how to draw a flower", source: "liked" }, // single art hit, heavier source
    ];
    const profile = buildInterestProfile(signals);
    expect(profile[0].topic).toBe("birds"); // 4 recurring weak hits beat 1 strong hit
    expect(profile[0].hits).toBe(4);
  });

  it("subscription/liked outweigh a single watch on equal hit counts", () => {
    const a = buildInterestProfile([{ text: "minecraft survival", source: "subscription" }]);
    const b = buildInterestProfile([{ text: "roblox obby", source: "watch_history" }]);
    expect(a[0].weight).toBeGreaterThan(b[0].weight);
  });

  it("recurrence bonus is capped so one topic cannot run away", () => {
    const many: RawSignal[] = Array.from({ length: 100 }, (_, i) => ({ text: `minecraft clip ${i}`, source: "watch_history" }));
    const profile = buildInterestProfile(many);
    // base 100*1 + capped bonus 40 = 140
    expect(profile[0].weight).toBe(140);
  });

  it("collects up to 6 sample titles", () => {
    const many: RawSignal[] = Array.from({ length: 10 }, (_, i) => ({ text: `bird video ${i}`, source: "liked" }));
    const profile = buildInterestProfile(many);
    expect(profile[0].samples.length).toBe(6);
  });
});

describe("interestEngine — merge over time", () => {
  it("accumulates weight + hits across syncs", () => {
    const existing: StoredInterest[] = [{ topic: "birds", label: "Birds", weight: 10, hits: 3, samples: ["a"] }];
    const fresh = buildInterestProfile([
      { text: "budgie", source: "liked" },
      { text: "parrot", source: "liked" },
    ]);
    const merged = mergeIntoStored(existing, fresh);
    const birds = merged.find((m) => m.topic === "birds")!;
    expect(birds.hits).toBe(5);
    expect(birds.weight).toBeGreaterThan(10);
  });

  it("adds brand-new topics not previously stored", () => {
    const merged = mergeIntoStored([], buildInterestProfile([{ text: "roblox adopt me", source: "subscription" }]));
    expect(merged.some((m) => m.topic === "roblox")).toBe(true);
  });

  it("does not duplicate samples on merge", () => {
    const existing: StoredInterest[] = [{ topic: "birds", label: "Birds", weight: 4, hits: 1, samples: ["budgie clip"] }];
    const fresh = buildInterestProfile([{ text: "budgie clip", source: "liked" }]);
    const merged = mergeIntoStored(existing, fresh);
    const birds = merged.find((m) => m.topic === "birds")!;
    expect(birds.samples.filter((s) => s === "budgie clip").length).toBe(1);
  });
});

describe("interestEngine — derived outputs", () => {
  const profile: StoredInterest[] = [
    { topic: "birds", label: "Birds", weight: 50, hits: 10, samples: [] },
    { topic: "art", label: "Art & Drawing", weight: 30, hits: 6, samples: [] },
    { topic: "sports", label: "Sports", weight: 8, hits: 2, samples: [] },
  ];

  it("top labels respect ranking and N", () => {
    expect(topInterestLabels(profile, 2)).toEqual(["Birds", "Art & Drawing"]);
  });

  it("unlocked wearables come from the top interests' themes", () => {
    const unlocks = unlockedWearables(profile, 3);
    expect(unlocks).toContain("wings_butterfly"); // birds
    expect(unlocks).toContain("wand_star");        // art
    expect(unlocks).toContain("jersey");           // sports
  });
});

describe("interestEngine — Takeout parsing", () => {
  it("parses watch-history rows, stripping 'Watched ' and reading channel", () => {
    const json = [
      { title: "Watched How to draw a budgie", subtitles: [{ name: "Art For Kids" }] },
      { title: "Watched Minecraft survival ep 3", subtitles: [{ name: "GamerKid" }] },
    ];
    const signals = parseTakeoutWatchHistory(json);
    expect(signals).toHaveLength(2);
    expect(signals[0].text).toBe("How to draw a budgie");
    expect(signals[0].channel).toBe("Art For Kids");
    expect(signals[0].source).toBe("watch_history");
  });

  it("skips ad rows and removed/private videos", () => {
    const json = [
      { title: "Watched a video that has been removed" },
      { title: "Watched Sponsored thing", details: [{ name: "From Google Ads" }] },
      { title: "Watched bird documentary" },
    ];
    const signals = parseTakeoutWatchHistory(json);
    expect(signals).toHaveLength(1);
    expect(signals[0].text).toBe("bird documentary");
  });

  it("tolerates non-array / junk input", () => {
    expect(parseTakeoutWatchHistory(null)).toEqual([]);
    expect(parseTakeoutWatchHistory({})).toEqual([]);
    expect(parseTakeoutWatchHistory([null, 42, "x", {}])).toEqual([]);
  });

  it("an imported history flows end-to-end into a ranked profile", () => {
    const json = Array.from({ length: 5 }, (_, i) => ({ title: `Watched budgie clip ${i}`, subtitles: [{ name: "Bird Lover" }] }));
    const profile = buildInterestProfile(parseTakeoutWatchHistory(json));
    expect(profile[0].topic).toBe("birds");
    expect(profile[0].hits).toBe(5);
  });
});

describe("interestEngine — catalog integrity", () => {
  it("every theme has a unique topic slug and at least one keyword", () => {
    const slugs = new Set<string>();
    for (const t of INTEREST_THEMES) {
      expect(t.keywords.length).toBeGreaterThan(0);
      expect(slugs.has(t.topic)).toBe(false);
      slugs.add(t.topic);
    }
  });

  it("every theme has a label and emoji", () => {
    for (const t of INTEREST_THEMES) {
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.emoji.length).toBeGreaterThan(0);
    }
  });
});
