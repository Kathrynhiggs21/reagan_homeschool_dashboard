/**
 * Tests for `buildVideoBlock` and the rectangular shape of the per-type
 * generator suite.
 *
 * The contract:
 *   - Every generator returns the same `GeneratedBlock` rectangle so the
 *     PDF builder + Reagan-side block view can iterate uniformly.
 *   - `buildVideoBlock` specifically must surface `qrTarget` (the URL the
 *     QR code encodes) and a printable line that includes the trimmed
 *     URL so a human can type it if the QR fails.
 *   - Standing rule: the video URL MUST appear in the printable line so
 *     the print-and-go packet works without the dashboard.
 */
import { describe, it, expect } from "vitest";
import {
  buildVideoBlock,
  buildAdventureBlock,
  buildPracticeBlock,
  buildReadingBlock,
} from "./_lib/blockGenerators";

describe("buildVideoBlock", () => {
  it("returns a rectangular GeneratedBlock with kind === 'video'", () => {
    const r = buildVideoBlock({
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      title: "How birds find their food",
      description: "Short clip about how songbirds spot insects in winter.",
    });
    expect(r.kind).toBe("video");
    expect(r.title).toMatch(/Video:/);
    expect(Array.isArray(r.instructions)).toBe(true);
    expect(r.instructions.length).toBeGreaterThan(0);
    expect(typeof r.printable).toBe("string");
    expect(r.operable.url).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });

  it("surfaces a qrTarget identical to the input URL", () => {
    const r = buildVideoBlock({
      url: "https://edpuzzle.com/media/abc123",
      title: "Math: Fractions",
      description: "Fraction warm-up.",
    });
    expect(r.qrTarget).toBe("https://edpuzzle.com/media/abc123");
    expect(r.qrCaption).toContain("edpuzzle.com/media/abc123");
  });

  it("printable line contains the trimmed URL (no protocol, no trailing slash)", () => {
    const r = buildVideoBlock({
      url: "https://www.brainpop.com/science/cells/",
      title: "Cells",
      description: "Intro to cells.",
    });
    expect(r.printable).toContain("brainpop.com/science/cells");
    expect(r.printable).not.toContain("https://");
  });

  it("includes the minutes in the printable line when provided", () => {
    const r = buildVideoBlock({
      url: "https://example.com/v",
      title: "Bird ID",
      description: "Quick ID.",
      minutes: 7,
    });
    expect(r.printable).toContain("~7m");
  });

  it("includes the subject tag in the printable when provided", () => {
    const r = buildVideoBlock({
      url: "https://example.com/v",
      title: "Watershed",
      description: "Water cycle clip.",
      subjectTag: "Science",
    });
    expect(r.printable).toContain("[Science]");
  });

  it("instruction list ends with a debrief prompt for Reagan", () => {
    const r = buildVideoBlock({
      url: "https://example.com/v",
      title: "Ohio rivers",
      description: "Where the rivers go.",
    });
    expect(r.instructions[r.instructions.length - 1]).toMatch(/tell.*new thing/i);
  });

  it("falls back to a sane title + description when input is empty", () => {
    const r = buildVideoBlock({
      url: "https://example.com/v",
      title: "",
      description: "",
    });
    expect(r.title).toBe("Video: Video");
    expect(r.instructions[1]).toMatch(/Short video for today/i);
  });

  it("throws when url is missing", () => {
    expect(() =>
      buildVideoBlock({ url: "", title: "x", description: "y" }),
    ).toThrow(/url is required/);
  });
});

describe("Per-type generator suite — rectangular shape contract", () => {
  it("all four generators return the same baseline keys", () => {
    const video = buildVideoBlock({
      url: "https://example.com/v",
      title: "T",
      description: "D",
    });
    const adventure = buildAdventureBlock({
      theme: "bird-watching",
      durationMin: 20,
      outdoorOk: true,
    });
    const practice = buildPracticeBlock({ subject: "math", seed: "deterministic" });
    const reading = buildReadingBlock({
      bookSlug: "tuck-everlasting",
      startPage: 1,
    });
    for (const r of [video, adventure, practice, reading]) {
      expect(r).toHaveProperty("kind");
      expect(r).toHaveProperty("title");
      expect(r).toHaveProperty("instructions");
      expect(r).toHaveProperty("printable");
      expect(r).toHaveProperty("operable");
      expect(Array.isArray(r.instructions)).toBe(true);
      expect(typeof r.printable).toBe("string");
    }
  });

  it("video generator's kind is distinct from the other three", () => {
    const kinds = new Set([
      buildVideoBlock({ url: "https://x", title: "x", description: "x" }).kind,
      buildAdventureBlock({
        theme: "bird-watching",
        durationMin: 10,
        outdoorOk: true,
      }).kind,
      buildPracticeBlock({ subject: "math", seed: "x" }).kind,
      buildReadingBlock({ bookSlug: "tuck-everlasting", startPage: 1 }).kind,
    ]);
    expect(kinds.size).toBe(4);
    expect(kinds.has("video")).toBe(true);
  });
});
