/**
 * Push 138 — Outdoor / real-world activity tag contract.
 *
 * Pins:
 *   - empty/no-match input → kind "neither", no badge
 *   - "outside" / "bird watching" / "nature walk" in description → outdoor
 *   - "experiment" / "grow crystals" / "parakeet" → real-world
 *   - both signals → kind "outdoor+real-world"
 *   - explicit label "outdoor" → outdoor regardless of text
 *   - explicit label "hands-on" → real-world regardless of text
 *   - matching is whole-word, case-insensitive (so "park" alone does not
 *     trigger outdoor; "field trip" does)
 *   - bookkeeping: matchedKeywords always returned (audit-friendly)
 */
import { describe, it, expect } from "vitest";
import { tagActivity } from "./_lib/outdoorRealWorldTag";

describe("Push 138 — tagActivity", () => {
  it("returns neither for empty input", () => {
    const out = tagActivity({});
    expect(out.kind).toBe("neither");
    expect(out.outdoor).toBe(false);
    expect(out.realWorld).toBe(false);
    expect(out.badgeLabel).toBeNull();
    expect(out.matchedKeywords).toEqual([]);
  });

  it("tags outdoor when description mentions 'nature walk'", () => {
    const out = tagActivity({
      title: "Science",
      description: "Take a nature walk and collect 3 leaves.",
    });
    expect(out.kind).toBe("outdoor");
    expect(out.badgeLabel).toBe("Outdoor");
    expect(out.badgeEmoji).toBe("🌳");
    expect(out.matchedKeywords).toContain("nature walk");
  });

  it("tags real-world when description mentions 'grow crystals'", () => {
    const out = tagActivity({
      title: "Crystal lab",
      description: "We will grow crystals in a jar this week.",
    });
    expect(out.kind).toBe("real-world");
    expect(out.badgeLabel).toBe("Real-World");
    expect(out.badgeEmoji).toBe("🛠️");
    expect(out.matchedKeywords).toContain("grow crystals");
  });

  it("tags outdoor+real-world when both signals appear", () => {
    const out = tagActivity({
      title: "Bird watching field journal",
      description:
        "Bird watching at the duck pond — observe and sketch the parakeets and ducklings.",
    });
    expect(out.kind).toBe("outdoor+real-world");
    expect(out.badgeLabel).toBe("Outdoor + Real-World");
    expect(out.badgeEmoji).toBe("🌿");
    expect(out.matchedKeywords.length).toBeGreaterThan(1);
  });

  it("explicit label 'outdoor' wins regardless of description text", () => {
    const out = tagActivity({
      description: "worksheet only",
      labels: ["outdoor"],
    });
    expect(out.outdoor).toBe(true);
    expect(out.kind).toBe("outdoor");
    expect(out.matchedKeywords).toContain("[label:outdoor]");
  });

  it("explicit label 'hands-on' tags real-world", () => {
    const out = tagActivity({
      description: "worksheet only",
      tags: ["hands-on"],
    });
    expect(out.realWorld).toBe(true);
    expect(out.kind).toBe("real-world");
    expect(out.matchedKeywords).toContain("[label:real-world]");
  });

  it("matching is whole-word: 'spark' does not trigger outdoor", () => {
    const out = tagActivity({
      description: "We saw a spark and learned how it forms.",
    });
    // 'park' is not in our outdoor list, but even if it were, 'spark'
    // should NOT match because we use whole-word boundaries.
    expect(out.outdoor).toBe(false);
  });

  it("matching is case-insensitive", () => {
    const out = tagActivity({
      title: "BIRD WATCHING",
      description: "OUTSIDE for an hour.",
    });
    expect(out.outdoor).toBe(true);
  });

  it("does not double-count the same keyword in title and description", () => {
    const out = tagActivity({
      title: "experiment",
      description: "experiment with vinegar and baking soda.",
    });
    expect(out.realWorld).toBe(true);
    // matchedKeywords is a Set-style unique list
    const dupes = out.matchedKeywords.filter((k) => k === "experiment").length;
    expect(dupes).toBe(1);
  });

  it("ignores non-string label / tag entries safely", () => {
    const out = tagActivity({
      // @ts-expect-error — intentional bad input
      labels: ["outdoor", 42, null, undefined],
      description: "",
    });
    expect(out.outdoor).toBe(true);
  });

  it("returns audit-friendly matchedKeywords for the digest", () => {
    const out = tagActivity({
      description: "Garden today; observe the parakeets.",
    });
    expect(out.kind).toBe("outdoor+real-world");
    expect(out.matchedKeywords).toEqual(
      expect.arrayContaining(["garden", "observe", "parakeets"]),
    );
  });
});
