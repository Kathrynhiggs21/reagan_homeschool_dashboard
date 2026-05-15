import { describe, it, expect } from "vitest";
import {
  makeKiwiRotationCounterState,
  advanceKiwiRotationCounter,
  readKiwiRotationCounter,
  resetKiwiRotationCounter,
} from "./_lib/kiwiBlessedLineRotationCounter";

describe("kiwiBlessedLineRotationCounter — per-panel rotation seed", () => {
  it("empty state → counter 0 for any panel", () => {
    const s = makeKiwiRotationCounterState();
    expect(readKiwiRotationCounter(s, "today")).toBe(0);
    expect(readKiwiRotationCounter(s, "kiwi")).toBe(0);
  });

  it("advance increments by 1 and returns the new seed", () => {
    const r1 = advanceKiwiRotationCounter(makeKiwiRotationCounterState(), "today");
    expect(r1.nextSeed).toBe(1);
    const r2 = advanceKiwiRotationCounter(r1.state, "today");
    expect(r2.nextSeed).toBe(2);
  });

  it("counters are per-panel (today advance doesn't affect kiwi)", () => {
    let state = makeKiwiRotationCounterState();
    state = advanceKiwiRotationCounter(state, "today").state;
    state = advanceKiwiRotationCounter(state, "today").state;
    expect(readKiwiRotationCounter(state, "today")).toBe(2);
    expect(readKiwiRotationCounter(state, "kiwi")).toBe(0);
  });

  it("reset clears just the chosen panel", () => {
    let state = makeKiwiRotationCounterState();
    state = advanceKiwiRotationCounter(state, "today").state;
    state = advanceKiwiRotationCounter(state, "kiwi").state;
    const after = resetKiwiRotationCounter(state, "today");
    expect(readKiwiRotationCounter(after, "today")).toBe(0);
    expect(readKiwiRotationCounter(after, "kiwi")).toBe(1);
  });

  it("input state is not mutated", () => {
    const initial = makeKiwiRotationCounterState();
    initial.counterByPanel.today = 5;
    const snap = JSON.stringify(initial);
    advanceKiwiRotationCounter(initial, "today");
    expect(JSON.stringify(initial)).toBe(snap);
  });

  it("null / undefined state → starts from empty", () => {
    expect(advanceKiwiRotationCounter(null, "today").nextSeed).toBe(1);
    expect(advanceKiwiRotationCounter(undefined, "today").nextSeed).toBe(1);
  });

  it("panel lookup is case-insensitive + whitespace-tolerant", () => {
    let state = makeKiwiRotationCounterState();
    state = advanceKiwiRotationCounter(state, "Today").state;
    expect(readKiwiRotationCounter(state, "TODAY")).toBe(1);
    state = advanceKiwiRotationCounter(state, "  today  ").state;
    expect(readKiwiRotationCounter(state, "today")).toBe(2);
  });

  it("empty panel coerces to today", () => {
    const r = advanceKiwiRotationCounter(makeKiwiRotationCounterState(), "");
    expect(r.state.counterByPanel.today).toBe(1);
  });

  it("malformed state values sanitized away", () => {
    const malformed = {
      counterByPanel: {
        today: "bad" as unknown as number,
        kiwi: -5,
        bookshelf: NaN as unknown as number,
        notebook: 7,
      },
    } as Parameters<typeof advanceKiwiRotationCounter>[0];
    const r = advanceKiwiRotationCounter(malformed, "today");
    expect(r.nextSeed).toBe(1);
    expect(readKiwiRotationCounter(r.state, "kiwi")).toBe(0);
    expect(readKiwiRotationCounter(r.state, "bookshelf")).toBe(0);
    expect(readKiwiRotationCounter(r.state, "notebook")).toBe(7);
  });

  it("seeds are stable / monotonic across many advances", () => {
    let state = makeKiwiRotationCounterState();
    const seeds: number[] = [];
    for (let i = 0; i < 25; i++) {
      const r = advanceKiwiRotationCounter(state, "today");
      seeds.push(r.nextSeed);
      state = r.state;
    }
    expect(seeds[0]).toBe(1);
    expect(seeds[24]).toBe(25);
    // monotonic + dense (no gaps)
    for (let i = 1; i < seeds.length; i++) {
      expect(seeds[i]).toBe(seeds[i - 1] + 1);
    }
  });

  it("is deterministic — same input → same output", () => {
    const r1 = advanceKiwiRotationCounter(makeKiwiRotationCounterState(), "today");
    const r2 = advanceKiwiRotationCounter(makeKiwiRotationCounterState(), "today");
    expect(r1).toEqual(r2);
  });
});
