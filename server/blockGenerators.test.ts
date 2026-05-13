/**
 * Push 67 (2026-05-13) — Slice 4 per-type block generators contract.
 *
 * Pure-function tests, no DB. We pin the shape (rectangular GeneratedBlock)
 * and the page/chapter math so the agenda assembler + nightly PDF can
 * keep depending on a predictable contract.
 */
import { describe, it, expect } from "vitest";
import {
  buildReadingBlock,
  buildAdventureBlock,
  buildPracticeBlock,
  OWNED_BOOKS,
  type GeneratedBlock,
} from "./_lib/blockGenerators";

function isRectangular(b: GeneratedBlock): boolean {
  return (
    typeof b.kind === "string" &&
    typeof b.title === "string" &&
    Array.isArray(b.instructions) &&
    typeof b.printable === "string" &&
    typeof b.operable === "object" &&
    b.operable !== null
  );
}

describe("buildReadingBlock — owned-book page math", () => {
  it("returns rectangular GeneratedBlock shape", () => {
    const r = buildReadingBlock({ bookSlug: "spectrum-science-5", startPage: 90 });
    expect(isRectangular(r)).toBe(true);
    expect(r.kind).toBe("reading");
  });

  it("workbook span defaults to 2 pages and renders 'pg.X–Y'", () => {
    const r = buildReadingBlock({ bookSlug: "spectrum-science-5", startPage: 90 });
    expect(r.title).toContain("Spectrum Science Grade 5");
    expect(r.title).toMatch(/pg\.90.{1,3}91/);
    expect(r.printable).toMatch(/pg\.90.{1,3}91/);
  });

  it("novel defaults to 1 chapter and renders 'ch.X'", () => {
    const r = buildReadingBlock({ bookSlug: "tuck-everlasting", startPage: 4 });
    expect(r.title).toMatch(/ch\.4/);
    // span=1 → no range dash
    expect(r.title).not.toMatch(/ch\.4–/);
  });

  it("clamps to totalPages when book has a known end", () => {
    const total = OWNED_BOOKS["180-days-language-5"].totalPages!;
    const r = buildReadingBlock({ bookSlug: "180-days-language-5", startPage: total - 1, pagesPerDay: 5 });
    // 5 requested but only 2 available → end at total
    expect(r.title).toContain(`–${total}`);
  });

  it("books with unknown totalPages still build (Michael's World)", () => {
    const r = buildReadingBlock({ bookSlug: "michaels-world", startPage: 31, pagesPerDay: 3 });
    expect(r.title).toMatch(/Michael's World/);
    expect(r.title).toMatch(/ch\.31.{1,3}33/);
  });

  it("printable line starts with the 📖 emoji adapter recognizes", () => {
    const r = buildReadingBlock({ bookSlug: "tuck-everlasting", startPage: 1 });
    expect(r.printable.startsWith("📖")).toBe(true);
  });

  it("operable URL is empty for physical books (no link to fake)", () => {
    const r = buildReadingBlock({ bookSlug: "tuck-everlasting", startPage: 1 });
    expect(r.operable.url).toBeUndefined();
  });

  it("throws on unknown book slug", () => {
    expect(() => buildReadingBlock({ bookSlug: "made-up" as any, startPage: 1 })).toThrow();
  });
});

describe("buildAdventureBlock — numbered steps + safety chip", () => {
  it("returns rectangular shape with numbered steps", () => {
    const r = buildAdventureBlock({ theme: "nature-scavenger", durationMin: 25 });
    expect(isRectangular(r)).toBe(true);
    expect(r.kind).toBe("adventure");
    // First entry is the safety chip, then numbered steps
    expect(r.instructions[1]).toMatch(/^1\./);
    expect(r.instructions[2]).toMatch(/^2\./);
  });

  it("respects outdoorOk=false by warning indoor-only", () => {
    const r = buildAdventureBlock({ theme: "nature-scavenger", outdoorOk: false });
    expect(r.instructions[0]).toContain("Indoor-only");
  });

  it("indoor recipes never display indoor-only warning", () => {
    const r = buildAdventureBlock({ theme: "library-trip" });
    expect(r.instructions[0]).not.toContain("Indoor-only");
  });

  it("supply list is exposed on operable for kid card render", () => {
    const r = buildAdventureBlock({ theme: "cooking-fractions" });
    expect(r.operable.supplyList?.length).toBeGreaterThan(0);
  });

  it("title includes duration in minutes", () => {
    const r = buildAdventureBlock({ theme: "bird-watching", durationMin: 15 });
    expect(r.title).toMatch(/15 min/);
  });

  it("duration is clamped to >=10 minutes", () => {
    const r = buildAdventureBlock({ theme: "bird-watching", durationMin: 3 });
    expect(r.title).toMatch(/10 min/);
  });
});

describe("buildPracticeBlock — primary + backups from PRACTICE_LIBRARY", () => {
  it("returns rectangular shape with primary + backup array", () => {
    const r = buildPracticeBlock({ subject: "math", seed: "2026-05-13" });
    expect(isRectangular(r)).toBe(true);
    expect(r.primary).toBeDefined();
    expect(Array.isArray(r.backups)).toBe(true);
  });

  it("same seed => same primary", () => {
    const a = buildPracticeBlock({ subject: "math", seed: "stable" });
    const b = buildPracticeBlock({ subject: "math", seed: "stable" });
    expect(a.primary.slug).toBe(b.primary.slug);
  });

  it("respects explicit primaryDrillSlug if it exists in the subject pool", () => {
    const r = buildPracticeBlock({ subject: "math", primaryDrillSlug: "khan-long-division" });
    expect(r.primary.slug).toBe("khan-long-division");
  });

  it("backups never include the primary drill", () => {
    const r = buildPracticeBlock({ subject: "math", seed: "x", backupSize: 5 });
    expect(r.backups.some((b) => b.slug === r.primary.slug)).toBe(false);
  });

  it("backups default to 3 when not specified", () => {
    const r = buildPracticeBlock({ subject: "math", seed: "x" });
    expect(r.backups.length).toBeLessThanOrEqual(3);
  });

  it("operable.url is the primary drill's url (one-click jump-in)", () => {
    const r = buildPracticeBlock({ subject: "math", primaryDrillSlug: "khan-long-division" });
    expect(r.operable.url).toMatch(/khanacademy\.org/);
  });

  it("printable line mentions provider + minutes + coins", () => {
    const r = buildPracticeBlock({ subject: "science", seed: "s1" });
    expect(r.printable).toMatch(/coins/);
    expect(r.printable).toMatch(/\d+m/);
  });

  it("throws on subject with no drills", () => {
    expect(() => buildPracticeBlock({ subject: "made-up" as any })).toThrow();
  });
});
