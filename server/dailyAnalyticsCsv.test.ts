/**
 * Push 34 — Daily analytics CSV contract.
 *
 * Locks in the column ordering + escape rules + null handling so Mom's
 * rolling IEP spreadsheet never breaks. ANY column rename or reorder
 * MUST bump the schema version + tests; that's the whole point of this
 * file.
 */
import { describe, it, expect } from "vitest";
import {
  buildDailyAnalyticsCsv,
  csvEscape,
  DAILY_ANALYTICS_COLUMNS,
  dailyAnalyticsFileName,
  dailyAnalyticsSubpath,
  bucketIepGoal,
  type DailyAnalyticsInputs,
} from "./_lib/dailyAnalyticsCsv";

function emptyInputs(date = "2026-05-13"): DailyAnalyticsInputs {
  return {
    dateISO: date,
    listening: null,
    kiwi: null,
    coverage: [],
    blocks: { plannedTotal: 0, completedTotal: 0, skippedTotal: 0 },
    iep: { behind: 0, onTrack: 0, ahead: 0 },
    offPlanTopicsCount: 0,
  };
}

describe("Daily analytics CSV — push 34", () => {
  it("locks the canonical 25-column header order", () => {
    expect(DAILY_ANALYTICS_COLUMNS).toEqual([
      "date",
      "blocks_planned",
      "blocks_completed",
      "blocks_skipped",
      "coverage_subjects",
      "coverage_avg_pct",
      "listening_focus_pct",
      "listening_relevant_chunks",
      "listening_dropped_chunks",
      "listening_off_task",
      "listening_distractions",
      "listening_minutes_on_task",
      "listening_top_topic",
      "avg_emotion",
      "avg_comfort",
      "avg_difficulty",
      "avg_talkativeness",
      "kiwi_interactions",
      "kiwi_user_messages",
      "kiwi_initiated_checkins",
      "kiwi_top_topic",
      "iep_behind",
      "iep_on_track",
      "iep_ahead",
      "off_plan_topics_count",
    ]);
    // No accidental dupes
    expect(new Set(DAILY_ANALYTICS_COLUMNS).size).toBe(
      DAILY_ANALYTICS_COLUMNS.length,
    );
  });

  it("renders header + single data row with CRLF terminators", () => {
    const csv = buildDailyAnalyticsCsv(emptyInputs("2026-05-13"));
    const lines = csv.split("\r\n");
    // header + data + trailing empty from final CRLF
    expect(lines.length).toBe(3);
    expect(lines[2]).toBe("");
    expect(lines[0].split(",").length).toBe(DAILY_ANALYTICS_COLUMNS.length);
    expect(lines[1].split(",").length).toBe(DAILY_ANALYTICS_COLUMNS.length);
    // First column is the date
    expect(lines[1].split(",")[0]).toBe("2026-05-13");
  });

  it("renders nulls as empty cells (no 'null' / 'undefined' strings)", () => {
    const csv = buildDailyAnalyticsCsv(emptyInputs());
    expect(csv).not.toContain("null");
    expect(csv).not.toContain("undefined");
    // 0/0 cases also stay zero (not empty)
    const dataRow = csv.split("\r\n")[1];
    const cells = dataRow.split(",");
    // blocks_planned, blocks_completed, blocks_skipped, coverage_subjects = 0
    expect(cells[1]).toBe("0");
    expect(cells[2]).toBe("0");
    expect(cells[3]).toBe("0");
    expect(cells[4]).toBe("0");
    // coverage_avg_pct is null when no rows → empty
    expect(cells[5]).toBe("");
  });

  it("renders coverage avg = round(mean(pct)) when rows exist", () => {
    const inputs = emptyInputs();
    inputs.coverage = [
      { subjectSlug: "math", total: 4, done: 3, pct: 75 },
      { subjectSlug: "ela",  total: 4, done: 2, pct: 50 },
      { subjectSlug: "sci",  total: 2, done: 2, pct: 100 },
    ];
    const csv = buildDailyAnalyticsCsv(inputs);
    const cells = csv.split("\r\n")[1].split(",");
    expect(cells[4]).toBe("3"); // coverage_subjects
    expect(cells[5]).toBe("75"); // (75+50+100)/3 = 75
  });

  it("populates listening + kiwi cells with real numbers when present", () => {
    const inputs = emptyInputs();
    inputs.listening = {
      relevantCount: 12,
      droppedCount: 3,
      focusPct: 80,
      offTask: 2,
      distractions: 1,
      topTopic: "fractions",
      avgEmotion: 30,
      avgComfort: 60,
      avgDifficulty: 40,
      avgTalkativeness: 55,
      minutesOnTask: 95,
    };
    inputs.kiwi = {
      interactions: 8,
      userMessages: 4,
      aiMessages: 4,
      kiwiInitiatedCount: 1,
      topTopic: "parakeets",
      topTopicCount: 3,
    };
    const csv = buildDailyAnalyticsCsv(inputs);
    expect(csv).toContain("80,12,3,2,1,95,fractions,30,60,40,55,8,4,1,parakeets");
  });

  it("CSV-escapes commas, quotes, and newlines per RFC 4180", () => {
    expect(csvEscape("simple")).toBe("simple");
    expect(csvEscape("with,comma")).toBe('"with,comma"');
    expect(csvEscape('has "quotes" inside')).toBe('"has ""quotes"" inside"');
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
    expect(csvEscape("")).toBe("");
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(undefined)).toBe("");
    expect(csvEscape(0)).toBe("0");
  });

  it("bucketIepGoal maps DB statuses + percent ratios into Behind/On/Ahead", () => {
    expect(bucketIepGoal({ status: "met" })).toBe("ahead");
    expect(bucketIepGoal({ status: "ahead" })).toBe("ahead");
    expect(bucketIepGoal({ currentPercent: 8, targetPercent: 8 })).toBe("ahead");
    expect(bucketIepGoal({ currentPercent: 10, targetPercent: 8 })).toBe("ahead");

    expect(bucketIepGoal({ status: "not_met" })).toBe("behind");
    expect(bucketIepGoal({ status: "at_risk" })).toBe("behind");
    expect(bucketIepGoal({ currentPercent: 2, targetPercent: 10 })).toBe("behind");

    expect(bucketIepGoal({ status: "in_progress" })).toBe("onTrack");
    expect(bucketIepGoal({ currentPercent: 6, targetPercent: 10 })).toBe("onTrack");
    expect(bucketIepGoal({})).toBe("onTrack");
  });

  it("dailyAnalyticsFileName + dailyAnalyticsSubpath produce canonical strings", () => {
    expect(dailyAnalyticsFileName("2026-05-13")).toBe(
      "2026-05-13 - Daily Analytics.csv",
    );
    expect(dailyAnalyticsSubpath("2026-05-13")).toBe("2026-05");
    expect(dailyAnalyticsSubpath("2025-12-31")).toBe("2025-12");
  });

  it("top topic strings carrying commas survive the round trip", () => {
    const inputs = emptyInputs();
    inputs.listening = {
      relevantCount: 1,
      droppedCount: 0,
      focusPct: 100,
      offTask: 0,
      distractions: 0,
      topTopic: "fractions, division, place value",
      avgEmotion: null,
      avgComfort: null,
      avgDifficulty: null,
      avgTalkativeness: null,
      minutesOnTask: 30,
    };
    const csv = buildDailyAnalyticsCsv(inputs);
    expect(csv).toContain('"fractions, division, place value"');
    // The row still has exactly N cells when re-split with a quote-aware parser.
    const dataRow = csv.split("\r\n")[1];
    // Naive split on commas would be 27; quoted field collapses it back.
    const fieldCount = parseCsvRow(dataRow).length;
    expect(fieldCount).toBe(DAILY_ANALYTICS_COLUMNS.length);
  });
});

/** Minimal RFC-4180 CSV row parser — handles quoted fields with embedded commas. */
function parseCsvRow(row: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (inQuotes) {
      if (ch === '"') {
        if (row[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === ",") {
        out.push(cur);
        cur = "";
      } else if (ch === '"') {
        inQuotes = true;
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out;
}
