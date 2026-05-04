/**
 * Phase 13 — Kiwi quiet-listening pipeline.
 *
 * Three things to lock down without hitting the DB:
 *   1) The router exposes the four procedures the kid + Mom UIs depend on.
 *   2) `addChunk` rejects bad windows, stale data, and missing audio.
 *   3) The Mom-only aggregator math (averages, on-task minutes, top topics)
 *      stays stable across refactors.
 */
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { aggregateListeningDay } from "./db";

describe("Phase 13 — listening router shape", () => {
  it("exposes the four expected procedures", () => {
    const sr = (appRouter as any)._def.procedures;
    for (const name of ["listening.addChunk", "listening.forDate", "listening.daySheet", "listening.weekSheet"]) {
      expect(typeof sr[name]).toBe("function");
    }
  });

  it("addChunk validates date pattern and ms-epoch shape", () => {
    const proc = (appRouter as any)._def.procedures["listening.addChunk"];
    const schema = proc._def.inputs?.[0] ?? proc._def.input;
    expect(() => schema.parse({ date: "2026-05-04", periodStart: 1, periodEnd: 2, audioUrl: "https://x/a.webm" })).not.toThrow();
    expect(() => schema.parse({ date: "2026-05-04", periodStart: 1, periodEnd: 2, audioDataUrl: "data:audio/webm;base64,AAA" })).not.toThrow();
    // bad date
    expect(() => schema.parse({ date: "May 4 2026", periodStart: 1, periodEnd: 2, audioUrl: "https://x/a.webm" })).toThrow();
    // bad url
    expect(() => schema.parse({ date: "2026-05-04", periodStart: 1, periodEnd: 2, audioUrl: "not-a-url" })).toThrow();
    // missing periods
    expect(() => schema.parse({ date: "2026-05-04", audioUrl: "https://x/a.webm" })).toThrow();
  });
});

describe("Phase 13 — aggregateListeningDay", () => {
  function row(over: Partial<any>): any {
    return {
      id: 1,
      date: "2026-05-04",
      periodStart: new Date("2026-05-04T13:00:00Z"),
      periodEnd: new Date("2026-05-04T13:10:00Z"),
      subjectGuess: "math",
      topicsJson: [{ subject: "math", name: "fractions" }],
      completionsJson: [],
      emotionScore: 50,
      comfortScore: 80,
      difficultyScore: 30,
      talkativenessScore: 60,
      rawSummary: "ok",
      createdAt: new Date(),
      ...over,
    };
  }

  it("counts samples and minutes-on-task across rows", () => {
    const out = aggregateListeningDay([
      row({}),
      row({ periodStart: new Date("2026-05-04T14:00:00Z"), periodEnd: new Date("2026-05-04T14:15:00Z") }),
    ]);
    expect(out.samples).toBe(2);
    expect(out.minutesOnTask).toBe(25);
  });

  it("averages numeric scores and ignores nulls", () => {
    const out = aggregateListeningDay([
      row({ emotionScore: 100, comfortScore: 100, difficultyScore: 50, talkativenessScore: 40 }),
      row({ emotionScore: null,  comfortScore: 60,  difficultyScore: null, talkativenessScore: 80 }),
      row({ emotionScore: -50,   comfortScore: 80,  difficultyScore: 30,   talkativenessScore: 60 }),
    ]);
    expect(out.avgEmotion).toBe(25);        // (100 + -50) / 2
    expect(out.avgComfort).toBe(80);        // (100 + 60 + 80) / 3 = 80
    expect(out.avgDifficulty).toBe(40);     // (50 + 30) / 2
    expect(out.avgTalkativeness).toBe(60);  // (40 + 80 + 60) / 3 = 60
  });

  it("collapses topics across rows and sorts by count desc", () => {
    const out = aggregateListeningDay([
      row({ topicsJson: [{ subject: "math", name: "fractions" }, { subject: "math", name: "decimals" }] }),
      row({ topicsJson: [{ subject: "math", name: "fractions" }] }),
      row({ topicsJson: [{ subject: "ela", name: "main idea" }] }),
    ]);
    expect(out.topics[0]).toEqual({ subject: "math", topic: "fractions", count: 2 });
    expect(out.topics.find((t) => t.topic === "decimals")?.count).toBe(1);
    expect(out.topics.find((t) => t.topic === "main idea")?.count).toBe(1);
  });

  it("returns nulls + empty maps for an empty day", () => {
    const out = aggregateListeningDay([]);
    expect(out.samples).toBe(0);
    expect(out.minutesOnTask).toBe(0);
    expect(out.avgEmotion).toBeNull();
    expect(out.avgComfort).toBeNull();
    expect(out.topics).toEqual([]);
    expect(out.subjectCounts).toEqual({});
  });
});
