import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { renderDayLogMarkdown } from "./scheduledSync";

describe("Slice 4.5 — daily recap + day log contracts", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "scheduledSync.ts"),
    "utf-8",
  );

  it("registers /api/scheduled/daily-recap-send", () => {
    expect(src).toContain('app.post("/api/scheduled/daily-recap-send"');
  });

  it("registers /api/scheduled/daily-recap-send/pending", () => {
    expect(src).toContain('app.get("/api/scheduled/daily-recap-send/pending"');
  });

  it("registers /api/scheduled/daily-recap-reply", () => {
    expect(src).toContain('app.post("/api/scheduled/daily-recap-reply"');
  });

  it("registers /api/scheduled/daily-log-rebuild", () => {
    expect(src).toContain('app.post("/api/scheduled/daily-log-rebuild"');
  });

  it("daily-recap-send guards on existing actual entries", () => {
    expect(src).toContain("countActualForDate");
    expect(src).toContain("actual-entries-exist");
  });

  it("daily-recap-send guards on already-answered (first reply wins)", () => {
    expect(src).toContain("isRecapAlreadyAnswered");
    expect(src).toContain("already-answered");
  });

  it("daily-recap-send fans out to Mom + Grandma + active tutors", () => {
    expect(src).toContain('"marcy.spear@gmail.com"');
    expect(src).toContain('"spear.cpt@gmail.com"');
    expect(src).toContain("listTutors");
  });

  it("daily-recap-reply uses LLM JSON-schema extraction", () => {
    expect(src).toContain("invokeLLM");
    expect(src).toContain("recap_entries");
    expect(src).toContain("offPlan");
  });

  it("daily-recap-reply maps email → source label", () => {
    expect(src).toContain('"grandma-recap"');
    expect(src).toContain('"mom-input"');
    expect(src).toContain('"tutor-note"');
  });

  it("daily-log-rebuild enqueues to Drive via push queue", () => {
    // Slice 4.5 refactor: route inserts into drivePushQueue directly with the
    // canonical "day_log" target instead of the legacy daily_schedule alias.
    // The behavioral contract (a row is inserted into drivePushQueue when
    // /api/scheduled/daily-log-rebuild runs) is exercised end-to-end by
    // server/dayLogRebuildRoute.test.ts using a real DB.
    expect(src).toMatch(/(?:db|dbInst)\.insert\(drivePushQueue\)/);
    expect(src).toContain('"day_log"');
  });
});

describe("renderDayLogMarkdown", () => {
  it("renders header + planned + actual sections", () => {
    const md = renderDayLogMarkdown(
      "2026-05-12",
      [{ startTime: "09:00", durationMin: 30, title: "Fractions Practice", subject: { name: "Math", slug: "math" } }],
      [{ subjectSlug: "math", topic: "Fractions Practice", minutesSpent: 25, source: "kiwi-listened", notes: "engaged" }],
    );
    expect(md).toContain("# Reagan — Day Log — 2026-05-12");
    expect(md).toContain("## Planned");
    expect(md).toContain("Math — Fractions Practice");
    expect(md).toContain("## Actual");
    expect(md).toContain("source: kiwi-listened");
  });

  it("renders empty Planned + Actual gracefully", () => {
    const md = renderDayLogMarkdown("2026-05-12", [], []);
    expect(md).toContain("(no planned blocks)");
    expect(md).toContain("(no actual entries yet");
  });
});
