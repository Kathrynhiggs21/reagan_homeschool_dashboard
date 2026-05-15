import { describe, it, expect } from "vitest";
import {
  pruneDoodles,
  __FOR_TEST__,
  type DoodleEntry,
  type PrunerInput,
} from "./_lib/notebookDoodleArchivePruner";

const TODAY = "2026-05-14";

function e(id: string, over: Partial<DoodleEntry> = {}): DoodleEntry {
  return {
    id,
    createdIso: "2026-05-01",
    lastViewedIso: "2026-05-01",
    isPinned: false,
    isFavorite: false,
    adultMark: "none",
    junkMarkedIso: null,
    ...over,
  };
}

function input(over: Partial<PrunerInput> = {}): PrunerInput {
  return { entries: [], isoDateLocal: TODAY, ...over };
}

describe("Push 199 — notebookDoodleArchivePruner", () => {
  it("default action is keep", () => {
    const r = pruneDoodles(input({ entries: [e("a", { lastViewedIso: TODAY })] }));
    expect(r.decisions[0].action).toBe("keep");
    expect(r.counts).toEqual({ keep: 1, archive: 0, delete: 0 });
  });

  it("pinned doodle never moves even if very old", () => {
    const r = pruneDoodles(
      input({
        entries: [e("a", { isPinned: true, lastViewedIso: "2020-01-01" })],
      }),
    );
    expect(r.decisions[0].action).toBe("keep");
    expect(r.decisions[0].reason).toBe("pinned");
  });

  it("kid favorite never moves even if very old", () => {
    const r = pruneDoodles(
      input({
        entries: [e("a", { isFavorite: true, lastViewedIso: "2020-01-01" })],
      }),
    );
    expect(r.decisions[0].action).toBe("keep");
    expect(r.decisions[0].reason).toBe("kid favorite");
  });

  it("adult-marked keep_forever never moves", () => {
    const r = pruneDoodles(
      input({
        entries: [
          e("a", { adultMark: "keep_forever", lastViewedIso: "2010-01-01" }),
        ],
      }),
    );
    expect(r.decisions[0].action).toBe("keep");
  });

  it("auto-archives after 90+ days inactive", () => {
    const r = pruneDoodles(
      input({ entries: [e("a", { lastViewedIso: "2026-02-01" })] }),
    );
    expect(r.decisions[0].action).toBe("archive");
    expect(r.decisions[0].reason).toMatch(/inactive .* >= 90d/);
  });

  it("89-day-inactive doodle stays kept (boundary)", () => {
    const r = pruneDoodles(
      input({ entries: [e("a", { lastViewedIso: "2026-02-15" })] }),
    );
    expect(r.decisions[0].action).toBe("keep");
  });

  it("custom archiveAfterDays overrides default", () => {
    const r = pruneDoodles(
      input({
        entries: [e("a", { lastViewedIso: "2026-05-04" })],
        archiveAfterDays: 7,
      }),
    );
    expect(r.decisions[0].action).toBe("archive");
  });

  it("adult-marked junk under 30d grace = archive (NOT delete)", () => {
    const r = pruneDoodles(
      input({
        entries: [
          e("a", { adultMark: "junk", junkMarkedIso: "2026-05-01" }),
        ],
      }),
    );
    expect(r.decisions[0].action).toBe("archive");
    expect(r.decisions[0].reason).toMatch(/grace/);
  });

  it("adult-marked junk over 30d grace = delete", () => {
    const r = pruneDoodles(
      input({
        entries: [
          e("a", { adultMark: "junk", junkMarkedIso: "2026-04-01" }),
        ],
      }),
    );
    expect(r.decisions[0].action).toBe("delete");
  });

  it("adult-marked junk WITHOUT junkMarkedIso defaults to archive", () => {
    const r = pruneDoodles(
      input({
        entries: [e("a", { adultMark: "junk", junkMarkedIso: null })],
      }),
    );
    expect(r.decisions[0].action).toBe("archive");
  });

  it("favorite beats junk mark — kid wins", () => {
    const r = pruneDoodles(
      input({
        entries: [
          e("a", {
            isFavorite: true,
            adultMark: "junk",
            junkMarkedIso: "2025-01-01",
          }),
        ],
      }),
    );
    expect(r.decisions[0].action).toBe("keep");
    expect(r.decisions[0].reason).toBe("kid favorite");
  });

  it("pinned beats EVERYTHING including junk mark", () => {
    const r = pruneDoodles(
      input({
        entries: [
          e("a", {
            isPinned: true,
            adultMark: "junk",
            junkMarkedIso: "2024-01-01",
          }),
        ],
      }),
    );
    expect(r.decisions[0].action).toBe("keep");
    expect(r.decisions[0].reason).toBe("pinned");
  });

  it("counts aggregate across mixed input", () => {
    const r = pruneDoodles(
      input({
        entries: [
          e("k1", { lastViewedIso: TODAY }),
          e("k2", { isFavorite: true, lastViewedIso: "2020-01-01" }),
          e("a1", { lastViewedIso: "2026-01-01" }),
          e("d1", { adultMark: "junk", junkMarkedIso: "2026-01-01" }),
        ],
      }),
    );
    expect(r.counts).toEqual({ keep: 2, archive: 1, delete: 1 });
  });

  it("daysBetween handles full ISO + bare date", () => {
    expect(__FOR_TEST__.daysBetween("2026-05-01", "2026-05-14")).toBe(13);
    expect(
      __FOR_TEST__.daysBetween(
        "2026-05-01T08:00:00Z",
        "2026-05-14T08:00:00Z",
      ),
    ).toBe(13);
  });

  it("daysBetween returns 0 for unparseable input (safety)", () => {
    expect(__FOR_TEST__.daysBetween("nope", "2026-05-14")).toBe(0);
    expect(__FOR_TEST__.daysBetween("2026-05-14", "nope")).toBe(0);
  });

  it("deterministic — same input ⇒ identical output", () => {
    const entries = [
      e("a", { lastViewedIso: "2026-01-01" }),
      e("b", { isPinned: true }),
    ];
    const a = pruneDoodles(input({ entries }));
    const c = pruneDoodles(input({ entries }));
    expect(a).toEqual(c);
  });

  it("empty input ⇒ no decisions, all counts zero", () => {
    const r = pruneDoodles(input({ entries: [] }));
    expect(r.decisions).toEqual([]);
    expect(r.counts).toEqual({ keep: 0, archive: 0, delete: 0 });
  });

  it("custom hardDeleteJunkAfterDays overrides default", () => {
    const r = pruneDoodles(
      input({
        entries: [
          e("a", { adultMark: "junk", junkMarkedIso: "2026-05-01" }),
        ],
        hardDeleteJunkAfterDays: 7,
      }),
    );
    expect(r.decisions[0].action).toBe("delete");
  });

  it("decision reason is informative for adult audit logs", () => {
    const r = pruneDoodles(
      input({
        entries: [
          e("a", { lastViewedIso: "2025-01-01" }),
          e("b", { isPinned: true }),
        ],
      }),
    );
    expect(r.decisions[0].reason).toMatch(/inactive/);
    expect(r.decisions[1].reason).toMatch(/pinned/);
  });
});
