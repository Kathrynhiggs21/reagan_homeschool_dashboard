import { describe, it, expect } from "vitest";
import {
  suggestAdventures,
  type AdventureLibraryEntry,
} from "./_lib/adventureLibrarySuggester";

const TODAY = "2026-05-15";

function mk(
  id: number,
  overrides: Partial<AdventureLibraryEntry> = {},
): AdventureLibraryEntry {
  return {
    id,
    title: `Adventure ${id}`,
    shortDescription: `Description for ${id}`,
    gradeLevel: 5,
    tags: [],
    outdoor: false,
    estimatedMinutes: 30,
    ...overrides,
  };
}

describe("adventureLibrarySuggester — house rules", () => {
  it("returns emptyLibrary flag and null primary when library is empty", () => {
    const r = suggestAdventures({
      library: [],
      todayIso: TODAY,
    });
    expect(r.emptyLibrary).toBe(true);
    expect(r.primary).toBeNull();
    expect(r.alternates).toHaveLength(0);
    expect(r.totalCandidates).toBe(0);
  });

  it("returns up to 3 suggestions (primary + 2 alternates)", () => {
    const r = suggestAdventures({
      library: [mk(1), mk(2), mk(3), mk(4), mk(5)],
      todayIso: TODAY,
    });
    expect(r.primary).not.toBeNull();
    expect(r.alternates).toHaveLength(2);
  });

  it("prefers entries with bird/animal/plant/water/outdoor tags", () => {
    const r = suggestAdventures({
      library: [
        mk(1, { tags: ["math"] }),
        mk(2, { tags: ["birds"], outdoor: true }),
        mk(3, { tags: ["history"] }),
      ],
      todayIso: TODAY,
    });
    expect(r.primary?.id).toBe(2);
    expect(r.primary?.reason).toBe("preferred_tag");
  });

  it("outdoor bonus surfaces outdoor entries even without preferred tags", () => {
    const r = suggestAdventures({
      library: [
        mk(1, { tags: ["math"] }),
        mk(2, { tags: ["history"], outdoor: true }),
      ],
      todayIso: TODAY,
    });
    expect(r.primary?.id).toBe(2);
    expect(r.primary?.reason).toBe("outdoor_bonus");
  });

  it("stacks multi-tag preferred bonus (capped at 3 hits)", () => {
    const r = suggestAdventures({
      library: [
        mk(1, { tags: ["birds"] }),
        mk(2, { tags: ["birds", "water", "outdoors", "plants"] }),
      ],
      todayIso: TODAY,
    });
    // Entry 2 stacks more tag hits → higher score → primary.
    expect(r.primary?.id).toBe(2);
  });

  it("penalizes (but never blocks) adventures done in the last 14 days", () => {
    const r1 = suggestAdventures({
      library: [
        mk(1, { tags: ["birds"], outdoor: true }),
        mk(2, { tags: ["birds"], outdoor: true }),
      ],
      todayIso: TODAY,
    });
    // Tie → lower id wins (1).
    expect(r1.primary?.id).toBe(1);

    const r2 = suggestAdventures({
      library: [
        mk(1, { tags: ["birds"], outdoor: true }),
        mk(2, { tags: ["birds"], outdoor: true }),
      ],
      history: [{ adventureId: 1, isoDate: "2026-05-10" }],
      todayIso: TODAY,
    });
    expect(r2.primary?.id).toBe(2);
    // Entry 1 is still in alternates — never blocked.
    expect(r2.alternates.map((a) => a.id)).toContain(1);
  });

  it("does NOT penalize old history beyond the 14-day window", () => {
    const r = suggestAdventures({
      library: [
        mk(1, { tags: ["birds"], outdoor: true }),
        mk(2, { tags: ["birds"], outdoor: true }),
      ],
      history: [{ adventureId: 1, isoDate: "2025-12-01" }],
      todayIso: TODAY,
    });
    // No penalty — tie still goes to id 1.
    expect(r.primary?.id).toBe(1);
  });

  it("anchors on grade match (defaults to 5)", () => {
    const r = suggestAdventures({
      library: [
        mk(1, { gradeLevel: 1, tags: ["birds"] }),
        mk(2, { gradeLevel: 5 }),
      ],
      todayIso: TODAY,
    });
    // Grade 5 entry beats off-grade even with no preferred tags? Let's see:
    // Entry 1: 1 (grade 1 → +1) + 7 (preferred tag) = 8
    // Entry 2: 10 (grade 5 anchor) = 10
    expect(r.primary?.id).toBe(2);
  });

  it("falls back gracefully when nothing matches well (all reasons low)", () => {
    const r = suggestAdventures({
      library: [mk(1, { gradeLevel: 2, tags: ["history"] })],
      todayIso: TODAY,
    });
    // Score = 1 (off-grade) + 0 (no preferred tag) = 1 → fallback
    expect(r.primary?.reason).toBe("fallback");
  });

  it("deterministic — same input twice → same output", () => {
    const args = {
      library: [mk(1, { tags: ["birds"] }), mk(2, { tags: ["water"] })],
      todayIso: TODAY,
    };
    const a = suggestAdventures(args);
    const b = suggestAdventures(args);
    expect(a).toEqual(b);
  });

  it("ties broken by id ascending", () => {
    const r = suggestAdventures({
      library: [
        mk(3, { tags: ["birds"] }),
        mk(1, { tags: ["birds"] }),
        mk(2, { tags: ["birds"] }),
      ],
      todayIso: TODAY,
    });
    expect(r.primary?.id).toBe(1);
    expect(r.alternates[0].id).toBe(2);
    expect(r.alternates[1].id).toBe(3);
  });

  it("kidLine never contains forbidden voice words", () => {
    const r = suggestAdventures({
      library: [
        mk(1, {
          shortDescription: "Watch the ducks on the creek. Calm and slow.",
          tags: ["water"],
        }),
      ],
      todayIso: TODAY,
    });
    const forbidden = /buddy|friend|yay|woohoo|great job|awesome/i;
    expect(r.primary?.kidLine).not.toMatch(forbidden);
  });

  it("kidLine strips exclamation marks from upstream descriptions", () => {
    const r = suggestAdventures({
      library: [
        mk(1, {
          shortDescription: "So fun! Try it!",
          tags: ["birds"],
        }),
      ],
      todayIso: TODAY,
    });
    expect(r.primary?.kidLine).not.toContain("!");
  });

  it("kidLine falls back to title when description is empty", () => {
    const r = suggestAdventures({
      library: [
        mk(1, { title: "Bird walk", shortDescription: "", tags: ["birds"] }),
      ],
      todayIso: TODAY,
    });
    expect(r.primary?.kidLine).toBe("Bird walk");
  });

  it("returns estimatedMinutes when present, null otherwise", () => {
    const r = suggestAdventures({
      library: [
        mk(1, { estimatedMinutes: 45, tags: ["birds"] }),
        mk(2, { estimatedMinutes: null, tags: ["birds"] }),
      ],
      todayIso: TODAY,
    });
    const ids = [r.primary?.id, ...r.alternates.map((a) => a.id)];
    const got = ids.find((i) => i === 1);
    expect(got).toBe(1);
    const e1 = [r.primary, ...r.alternates].find((x) => x?.id === 1);
    const e2 = [r.primary, ...r.alternates].find((x) => x?.id === 2);
    expect(e1?.estimatedMinutes).toBe(45);
    expect(e2?.estimatedMinutes).toBeNull();
  });

  it("malformed history is tolerated", () => {
    const r = suggestAdventures({
      library: [mk(1, { tags: ["birds"] })],
      history: undefined as unknown as [],
      todayIso: TODAY,
    });
    expect(r.primary?.id).toBe(1);
  });

  it("malformed library is tolerated", () => {
    const r = suggestAdventures({
      library: undefined as unknown as [],
      todayIso: TODAY,
    });
    expect(r.emptyLibrary).toBe(true);
  });

  it("targetGrade override is honored", () => {
    const r = suggestAdventures({
      library: [
        mk(1, { gradeLevel: 5 }),
        mk(2, { gradeLevel: 3 }),
      ],
      todayIso: TODAY,
      targetGrade: 3,
    });
    expect(r.primary?.id).toBe(2);
  });

  it("totalCandidates reflects full library size, not just suggestions", () => {
    const r = suggestAdventures({
      library: [
        mk(1, { tags: ["birds"] }),
        mk(2, { tags: ["water"] }),
        mk(3, { tags: ["plants"] }),
        mk(4, { tags: ["math"] }),
        mk(5, { tags: ["history"] }),
      ],
      todayIso: TODAY,
    });
    expect(r.totalCandidates).toBe(5);
  });
});
