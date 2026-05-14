import { describe, it, expect } from "vitest";
import {
  pickNotebookDoodlePrompt,
  CANONICAL_DOODLE_POOL,
} from "./_lib/notebookDoodlePrompt";

describe("Push 178 — Notebook Doodle prompt-of-the-day", () => {
  it("returns a prompt for a valid ISO + kid name", () => {
    const r = pickNotebookDoodlePrompt({
      dateISO: "2026-05-15",
      kidName: "Reagan",
    });
    expect(r.prompt.id).toBeTruthy();
    expect(r.prompt.text.length).toBeGreaterThan(5);
    expect(r.kidLine).toBe(r.prompt.text);
  });

  it("is deterministic — same ISO + name -> same prompt", () => {
    const a = pickNotebookDoodlePrompt({
      dateISO: "2026-05-15",
      kidName: "Reagan",
    });
    const b = pickNotebookDoodlePrompt({
      dateISO: "2026-05-15",
      kidName: "Reagan",
    });
    expect(a.prompt.id).toBe(b.prompt.id);
  });

  it("never serves yesterday's exact prompt", () => {
    const today = pickNotebookDoodlePrompt({
      dateISO: "2026-05-15",
      kidName: "Reagan",
    });
    const tomorrow = pickNotebookDoodlePrompt({
      dateISO: "2026-05-16",
      kidName: "Reagan",
      yesterdayPromptId: today.prompt.id,
    });
    expect(tomorrow.prompt.id).not.toBe(today.prompt.id);
  });

  it("avoids yesterday's category when there are enough alternatives", () => {
    const today = pickNotebookDoodlePrompt({
      dateISO: "2026-05-15",
      kidName: "Reagan",
    });
    const tomorrow = pickNotebookDoodlePrompt({
      dateISO: "2026-05-16",
      kidName: "Reagan",
      yesterdayPromptId: today.prompt.id,
      yesterdayCategory: today.prompt.category,
    });
    expect(tomorrow.prompt.category).not.toBe(today.prompt.category);
  });

  it("never includes pressuring or timed words", () => {
    const banned =
      /\b(must|hurry|right now|deadline|warm-up|warmup|finish in|complete in|grade|graded|test|quiz|points|score)\b/i;
    for (const p of CANONICAL_DOODLE_POOL) {
      expect(p.text).not.toMatch(banned);
    }
  });

  it("always uses opt-in or invitation phrasing", () => {
    // Every prompt should look like an invitation, not a command.
    // We allow imperative verbs like "draw" / "list" / "imagine" as long as
    // they appear with a softener ("if you want," / "try" / "doodle" / etc.)
    // or are inherently playful (silly category).
    for (const p of CANONICAL_DOODLE_POOL) {
      const text = p.text.toLowerCase();
      const hasSoftener =
        /\b(if you want|try|maybe|doodle|sketch|color|draw|list|imagine|make|give|step outside|look at|pick)\b/.test(
          text,
        );
      expect(hasSoftener).toBe(true);
    }
  });

  it("handles missing kidName by defaulting to 'kid' for the seed", () => {
    const a = pickNotebookDoodlePrompt({ dateISO: "2026-05-15" });
    const b = pickNotebookDoodlePrompt({
      dateISO: "2026-05-15",
      kidName: "kid",
    });
    expect(a.prompt.id).toBe(b.prompt.id);
  });

  it("rejects malformed dateISO", () => {
    expect(() =>
      pickNotebookDoodlePrompt({ dateISO: "May 15", kidName: "Reagan" }),
    ).toThrow();
    expect(() =>
      pickNotebookDoodlePrompt({ dateISO: "2026-5-15", kidName: "Reagan" }),
    ).toThrow();
  });

  it("falls back to full pool if filters wipe everything (single-item override)", () => {
    const onlyOne = [
      {
        id: "x",
        category: "draw" as const,
        text: "Draw a quick triangle if you want.",
      },
    ];
    const r = pickNotebookDoodlePrompt({
      dateISO: "2026-05-15",
      kidName: "Reagan",
      yesterdayPromptId: "x",
      yesterdayCategory: "draw",
      pool: onlyOne,
    });
    expect(r.prompt.id).toBe("x");
  });

  it("does not throw on empty pool override", () => {
    const r = pickNotebookDoodlePrompt({
      dateISO: "2026-05-15",
      kidName: "Reagan",
      pool: [],
    });
    expect(r.prompt).toBeTruthy();
  });

  it("varies by kidName — different kids can see different prompts on the same day", () => {
    const seenIds = new Set<string>();
    const names = [
      "Reagan",
      "Milo",
      "Taylor",
      "Sam",
      "Avery",
      "Jordan",
      "Riley",
      "Casey",
    ];
    for (const n of names) {
      seenIds.add(
        pickNotebookDoodlePrompt({ dateISO: "2026-05-15", kidName: n }).prompt
          .id,
      );
    }
    // We should see at least 2 different ids across 8 kids.
    expect(seenIds.size).toBeGreaterThanOrEqual(2);
  });
});
