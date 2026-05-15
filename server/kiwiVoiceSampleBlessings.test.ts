import { describe, it, expect } from "vitest";
import {
  pickKiwiBlessedLine,
  listKiwiBlessedLines,
  listKiwiBlessingPanels,
} from "./_lib/kiwiVoiceSampleBlessings";

const FORBIDDEN = /\b(yay|woohoo|great job|awesome|amazing|buddy|friend|pal|kiddo|sweetie)\b/i;

const ALL_PANELS = [
  "today",
  "kiwi",
  "schedule",
  "bookshelf",
  "notebook",
  "apps",
  "feeling",
  "stuck",
] as const;

describe("kiwiVoiceSampleBlessings — curated fallback lines", () => {
  it("listKiwiBlessingPanels returns all 8 panels", () => {
    const panels = listKiwiBlessingPanels();
    expect(panels).toHaveLength(8);
    for (const p of ALL_PANELS) {
      expect(panels).toContain(p);
    }
  });

  it("every panel has at least 3 blessed lines", () => {
    for (const p of ALL_PANELS) {
      const lines = listKiwiBlessedLines(p);
      expect(lines.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("no blessed line contains exclamation marks (adult-tone)", () => {
    for (const p of ALL_PANELS) {
      for (const line of listKiwiBlessedLines(p)) {
        expect(line).not.toContain("!");
      }
    }
  });

  it("no blessed line contains forbidden voice words", () => {
    for (const p of ALL_PANELS) {
      for (const line of listKiwiBlessedLines(p)) {
        expect(line).not.toMatch(FORBIDDEN);
      }
    }
  });

  it("no blessed line contains emoji or unicode pictographs", () => {
    const emojiCharCode = /[\uD800-\uDFFF]/;
    for (const p of ALL_PANELS) {
      for (const line of listKiwiBlessedLines(p)) {
        expect(line).not.toMatch(emojiCharCode);
      }
    }
  });

  it("every blessed line has <= 2 sentences", () => {
    for (const p of ALL_PANELS) {
      for (const line of listKiwiBlessedLines(p)) {
        const sentences = line
          .split(/(?<=[.!?])\s+/)
          .filter((s) => s.length > 0);
        expect(sentences.length).toBeLessThanOrEqual(2);
      }
    }
  });

  it("deterministic — same panel + seed → same line", () => {
    const a = pickKiwiBlessedLine({ panel: "today", rotationSeed: 7 });
    const b = pickKiwiBlessedLine({ panel: "today", rotationSeed: 7 });
    expect(a).toBe(b);
  });

  it("different seeds cycle through the pool", () => {
    const lines = new Set<string>();
    for (let i = 0; i < 6; i += 1) {
      lines.add(pickKiwiBlessedLine({ panel: "today", rotationSeed: i }));
    }
    // 3-line pool → seed 0..5 should produce all 3 unique lines
    expect(lines.size).toBe(3);
  });

  it("unknown panel falls back to 'today' pool", () => {
    const fallback = pickKiwiBlessedLine({ panel: "marketing", rotationSeed: 0 });
    const todayFirst = listKiwiBlessedLines("today")[0];
    expect(fallback).toBe(todayFirst);
  });

  it("null panel → 'today' pool fallback", () => {
    const r = pickKiwiBlessedLine({ panel: null, rotationSeed: 0 });
    expect(r).toBe(listKiwiBlessedLines("today")[0]);
  });

  it("undefined panel → 'today' pool fallback", () => {
    const r = pickKiwiBlessedLine({ panel: undefined, rotationSeed: 0 });
    expect(r).toBe(listKiwiBlessedLines("today")[0]);
  });

  it("negative seed coerces to 0", () => {
    const a = pickKiwiBlessedLine({ panel: "today", rotationSeed: -5 });
    const b = pickKiwiBlessedLine({ panel: "today", rotationSeed: 0 });
    expect(a).toBe(b);
  });

  it("NaN seed coerces to 0", () => {
    const a = pickKiwiBlessedLine({ panel: "today", rotationSeed: NaN });
    const b = pickKiwiBlessedLine({ panel: "today", rotationSeed: 0 });
    expect(a).toBe(b);
  });

  it("case-insensitive panel lookup", () => {
    const a = pickKiwiBlessedLine({ panel: "Today", rotationSeed: 0 });
    const b = pickKiwiBlessedLine({ panel: "today", rotationSeed: 0 });
    expect(a).toBe(b);
  });

  it("feeling panel never mentions schoolwork or grades", () => {
    for (const line of listKiwiBlessedLines("feeling")) {
      expect(line.toLowerCase()).not.toMatch(/grade|test|homework|assignment/);
    }
  });

  it("schedule panel always references the dual-adult approval rule", () => {
    const lines = listKiwiBlessedLines("schedule");
    const mentions = lines.filter((l) =>
      /\b(both|mom and grandma|two|two of them)\b/i.test(l),
    );
    expect(mentions.length).toBeGreaterThan(0);
  });

  it("kiwi panel never claims to be a friend or person", () => {
    for (const line of listKiwiBlessedLines("kiwi")) {
      expect(line.toLowerCase()).not.toMatch(
        /\b(friend|pal|buddy|kiddo|sweetie|sweetheart)\b/,
      );
    }
  });

  it("apps panel never promises an app works (apps may be broken)", () => {
    for (const line of listKiwiBlessedLines("apps")) {
      expect(line.toLowerCase()).not.toMatch(/\bguaranteed|always works\b/);
    }
  });

  it("listKiwiBlessedLines returns a fresh copy each call", () => {
    const a = listKiwiBlessedLines("today");
    const b = listKiwiBlessedLines("today");
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it("listKiwiBlessedLines for unknown panel returns []", () => {
    expect(listKiwiBlessedLines("not-a-panel" as never)).toEqual([]);
  });
});
