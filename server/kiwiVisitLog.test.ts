import { describe, it, expect } from "vitest";
import {
  todayVisitKey,
  recordVisit,
  summarizeVisits,
  describeVisits,
  type VisitEntry,
} from "@shared/kiwiCharacter";

describe("Kiwi visit log helpers", () => {
  it("todayVisitKey uses local Y-M-D (not UTC) and the kiwi_visits_ prefix", () => {
    const d = new Date(2026, 5, 19, 23, 30); // local June 19, 2026 (month is 0-based)
    expect(todayVisitKey(d)).toBe("kiwi_visits_2026-06-19");
    // zero-padding
    const d2 = new Date(2026, 0, 3, 1, 0);
    expect(todayVisitKey(d2)).toBe("kiwi_visits_2026-01-03");
  });

  it("recordVisit appends entries in order", () => {
    let log: VisitEntry[] = [];
    log = recordVisit(log, "lychee", 100);
    log = recordVisit(log, "ducks", 200);
    log = recordVisit(log, "lychee", 300);
    expect(log).toEqual([
      { guest: "lychee", ts: 100 },
      { guest: "ducks", ts: 200 },
      { guest: "lychee", ts: 300 },
    ]);
  });

  it("recordVisit caps the log length to avoid unbounded growth", () => {
    let log: VisitEntry[] = [];
    for (let i = 0; i < 60; i++) log = recordVisit(log, "lychee", i, 50);
    expect(log.length).toBe(50);
    // The oldest entries are dropped; newest kept.
    expect(log[log.length - 1]).toEqual({ guest: "lychee", ts: 59 });
    expect(log[0]).toEqual({ guest: "lychee", ts: 10 });
  });

  it("summarizeVisits counts per guest, lists unique guests in first-seen order, tracks total + lastTs", () => {
    const log: VisitEntry[] = [
      { guest: "lychee", ts: 100 },
      { guest: "ducks", ts: 250 },
      { guest: "lychee", ts: 400 },
    ];
    const s = summarizeVisits(log);
    expect(s.guests).toEqual(["lychee", "ducks"]);
    expect(s.counts).toEqual({ lychee: 2, ducks: 1 });
    expect(s.total).toBe(3);
    expect(s.lastTs).toBe(400);
  });

  it("summarizeVisits ignores unknown guest values defensively", () => {
    const log = [
      { guest: "lychee", ts: 1 },
      { guest: "alien" as any, ts: 2 },
    ] as VisitEntry[];
    const s = summarizeVisits(log);
    expect(s.guests).toEqual(["lychee"]);
    expect(s.counts.lychee).toBe(1);
  });

  it("describeVisits produces friendly text for empty and populated logs", () => {
    expect(describeVisits(summarizeVisits([]))).toMatch(/no visitors/i);
    const one = summarizeVisits([{ guest: "lychee", ts: 1 }]);
    expect(describeVisits(one)).toMatch(/Lychee/);
    const many = summarizeVisits([
      { guest: "lychee", ts: 1 },
      { guest: "lychee", ts: 2 },
      { guest: "ducks", ts: 3 },
    ]);
    const text = describeVisits(many);
    expect(text).toMatch(/Lychee/);
    expect(text).toMatch(/duck squad/);
    expect(text).toMatch(/2/); // lychee count appears
  });
});
