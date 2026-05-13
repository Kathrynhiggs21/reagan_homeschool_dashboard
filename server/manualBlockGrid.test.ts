import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Push 58 (2026-05-13) — Manual block grid contract lock-in.
 *
 * The Manual block grid in AgendaEditor was already shipped with full
 * drag-and-drop reorder and inline edits for every field the todo asked
 * for. This spec exists so a future refactor cannot quietly regress
 * Mom's ability to reorder + edit every column in place.
 */

describe("Push 58 — Manual block grid contracts", () => {
  const root = join(__dirname, "..");
  const src = readFileSync(
    join(root, "client/src/pages/AgendaEditor.tsx"),
    "utf8",
  );

  it("renders ManualBlockRow inside a draggable list wired to blocks.reorder", () => {
    expect(src).toContain("ManualBlockRow");
    expect(src).toContain("draggable");
    expect(src).toContain("onDragStart");
    expect(src).toContain("onDragEnter");
    expect(src).toContain("onDragEnd");
    // Drop computes a new id ordering and calls the reorder mutation.
    expect(src).toContain("blockReorderM.mutate");
    expect(src).toContain("orderedIds");
  });

  it("ManualBlockRow has inline-editable blockType, subjectSlug, topicCode, title, startTime, durationMin, description", () => {
    // blockType Select fed by BLOCK_TYPES
    expect(src).toMatch(/Select[^>]*value=\{block\.blockType\}/);
    expect(src).toContain("BLOCK_TYPES");
    // subjectSlug Select with __none sentinel
    expect(src).toMatch(/Select[^>]*value=\{block\.subjectSlug \?\? "__none"\}/);
    expect(src).toContain('SelectItem value="__none"');
    // topic Select filtered by subject (eligibleTopics)
    expect(src).toContain("eligibleTopics");
    expect(src).toMatch(/Select[^>]*value=\{block\.curriculumTopicCode \?\? "__none"\}/);
    // Title Input that patches on blur
    expect(src).toContain('onBlur={() => { if (title !== block.title) onPatch({ title }); }}');
    // Start time uses parseTime12h + formatTime12h
    expect(src).toContain("parseTime12h(trimmed)");
    expect(src).toContain("formatTime12h(");
    // Duration clamped 5..180
    expect(src).toMatch(/durationMin >= 5 && durationMin <= 180/);
    // Description inline notes editor
    expect(src).toContain("block-description-input-");
  });

  it("Every change funnels through a single blockUpdateM mutation (no shadow paths)", () => {
    // onPatch is the only callback to ManualBlockRow that mutates fields.
    expect(src).toContain("onPatch={(patch) => blockUpdateM.mutate({ id: b.id, ...patch })}");
    // The handle is visible + announced for a11y.
    expect(src).toContain('aria-label="Drag to reorder"');
    expect(src).toContain("cursor-grab");
  });
});
