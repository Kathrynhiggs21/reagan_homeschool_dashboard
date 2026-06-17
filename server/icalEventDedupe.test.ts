import { describe, it, expect } from "vitest";
import { dedupeIcalEvents } from "./db";

/**
 * 2026-06-17 — fixes "calendar events showing 3x" on the Schedule page.
 *
 * Root cause: the SAME real-world event can arrive from more than one
 * subscribed calendar (Family + Reagan's) AND from imported copies that
 * carry a different uid (e.g. ...@openai.local / ...@chatgpt). With two
 * feeds plus one imported copy, a single event surfaced up to 3x.
 *
 * dedupeIcalEvents collapses by uid+forDate, with a summary+startsAt
 * fallback for the rewritten-uid copies.
 */
describe("dedupeIcalEvents — schedule no longer triples events", () => {
  it("collapses the same event arriving from multiple feeds (same uid, same day)", () => {
    const rows = [
      { id: 1, feedId: 1, uid: "abc@google.com", summary: "Soccer Tryout", forDate: "2026-05-19", startsAt: new Date("2026-05-19T23:00:00Z") },
      { id: 2, feedId: 2, uid: "abc@google.com", summary: "Soccer Tryout", forDate: "2026-05-19", startsAt: new Date("2026-05-19T23:00:00Z") },
    ];
    const out = dedupeIcalEvents(rows);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(1); // first occurrence kept
  });

  it("collapses imported copies that reuse a different uid but same summary+start (the 3x case)", () => {
    const rows = [
      { id: 1, feedId: 1, uid: "abc@google.com", summary: "Tryout - CINCY/NKY - 26/27", forDate: "2026-05-19", startsAt: new Date("2026-05-19T23:00:00Z") },
      { id: 2, feedId: 2, uid: "abc@google.com", summary: "Tryout - CINCY/NKY - 26/27", forDate: "2026-05-19", startsAt: new Date("2026-05-19T23:00:00Z") },
      { id: 3, feedId: 2, uid: "xyz-20260519@openai.local", summary: "Tryout - CINCY/NKY - 26/27", forDate: "2026-05-19", startsAt: new Date("2026-05-19T23:00:00Z") },
    ];
    const out = dedupeIcalEvents(rows);
    expect(out).toHaveLength(1);
  });

  it("keeps genuinely different events on the same day", () => {
    const rows = [
      { id: 1, feedId: 2, uid: "a@google.com", summary: "Soccer Tryout", forDate: "2026-06-01", startsAt: new Date("2026-06-01T20:30:00Z") },
      { id: 2, feedId: 2, uid: "b@chatgpt", summary: "Summer Learning – Week 1", forDate: "2026-06-01", startsAt: new Date("2026-06-01T00:00:00Z") },
    ];
    const out = dedupeIcalEvents(rows);
    expect(out).toHaveLength(2);
  });

  it("keeps the same recurring event on different days (uid same, forDate differs)", () => {
    const rows = [
      { id: 1, feedId: 2, uid: "rec@google.com", summary: "No school", forDate: "2026-05-16", startsAt: new Date("2026-05-16T08:00:00Z") },
      { id: 2, feedId: 2, uid: "rec@google.com", summary: "No school", forDate: "2026-05-17", startsAt: new Date("2026-05-17T08:00:00Z") },
      { id: 3, feedId: 2, uid: "rec@google.com", summary: "No school", forDate: "2026-05-18", startsAt: new Date("2026-05-18T08:00:00Z") },
    ];
    const out = dedupeIcalEvents(rows);
    expect(out).toHaveLength(3);
  });

  it("handles empty / null fields without throwing", () => {
    const rows = [
      { id: 1, feedId: 1, uid: null, summary: null, forDate: "2026-06-01", startsAt: null },
      { id: 2, feedId: 1, uid: "", summary: "", forDate: "2026-06-01", startsAt: new Date("2026-06-01T00:00:00Z") },
    ];
    const out = dedupeIcalEvents(rows);
    // Nothing should be dropped (no shared identity), and no throw.
    expect(out.length).toBe(2);
  });
});
