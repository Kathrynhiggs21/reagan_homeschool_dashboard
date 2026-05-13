/**
 * Push 86 (2026-05-13) — Daily report renderer contract.
 *
 * Pure HTML renderer used for the off-school/tutor-day recap Grandma
 * receives. The contract locks structure + safety (escaping) + no-info
 * fallbacks so the email body stays useful even when payloads are sparse.
 */
import { describe, it, expect } from "vitest";
import {
  renderDailyReport,
  type DailyReportBlock,
  type DailyReportInput,
} from "./_lib/dailyReportRenderer";

const BASE: DailyReportInput = {
  dateISO: "2026-05-13",
  caretakerLabel: "Grandma",
  plannedBlocks: [],
  offPlanTopics: [],
};

const PLANNED: DailyReportBlock[] = [
  { subjectSlug: "math", title: "Fractions warmup", topic: "Equivalent fractions", timeLabel: "9:30 AM" },
  { subjectSlug: "ela", title: "Tuck Everlasting read-aloud", topic: "Ch. 4–5", timeLabel: "10:15 AM" },
  { subjectSlug: "science", title: "Spectrum Science p. 42", done: false },
];

const OFFPLAN: DailyReportBlock[] = [
  { subjectSlug: "social", title: "Talk about town water-source map", topic: "Local watersheds" },
];

describe("Push 86 — renderDailyReport headline + caretaker", () => {
  it("includes the friendly weekday + date", () => {
    const html = renderDailyReport({ ...BASE, plannedBlocks: PLANNED });
    expect(html).toMatch(/Reagan's day · Wed, May 13/);
  });
  it("surfaces the caretaker label ('With Grandma')", () => {
    const html = renderDailyReport({ ...BASE, caretakerLabel: "Grandma" });
    expect(html).toMatch(/With Grandma/);
  });
  it("renders ISO date as-is when format is malformed", () => {
    const html = renderDailyReport({ ...BASE, dateISO: "not-a-date" });
    expect(html).toMatch(/Reagan's day · not-a-date/);
  });
});

describe("Push 86 — mood strip", () => {
  it("renders the zone label and note when present", () => {
    const html = renderDailyReport({
      ...BASE,
      moodZone: "green",
      moodNote: "Felt focused after walk",
    });
    expect(html).toMatch(/Green zone/);
    expect(html).toMatch(/Felt focused after walk/);
  });
  it("omits mood strip when moodZone is null", () => {
    const html = renderDailyReport({ ...BASE, moodZone: null });
    expect(html).not.toMatch(/Green zone|Yellow zone|Red zone|Blue zone/);
  });
});

describe("Push 86 — planned blocks list", () => {
  it("renders each planned block with subject label + title + topic", () => {
    const html = renderDailyReport({ ...BASE, plannedBlocks: PLANNED });
    expect(html).toMatch(/<b>Math<\/b>: Fractions warmup — Equivalent fractions/);
    expect(html).toMatch(/<b>ELA<\/b>: Tuck Everlasting read-aloud — Ch\. 4–5/);
    expect(html).toMatch(/<b>Science<\/b>: Spectrum Science p\. 42/);
  });
  it("flags skipped blocks (done:false)", () => {
    const html = renderDailyReport({ ...BASE, plannedBlocks: PLANNED });
    expect(html).toMatch(/skipped/);
  });
  it("shows the time label when supplied", () => {
    const html = renderDailyReport({ ...BASE, plannedBlocks: PLANNED });
    expect(html).toMatch(/9:30 AM/);
    expect(html).toMatch(/10:15 AM/);
  });
  it("shows the empty-state fallback when no blocks recorded", () => {
    const html = renderDailyReport(BASE);
    expect(html).toMatch(/No planned blocks were recorded today/);
  });
});

describe("Push 86 — off-plan section", () => {
  it("renders an off-plan list when topics were captured", () => {
    const html = renderDailyReport({ ...BASE, offPlanTopics: OFFPLAN });
    expect(html).toMatch(/Off-plan topics covered/);
    expect(html).toMatch(/off-plan/);
    expect(html).toMatch(/Local watersheds/);
  });
  it("hides the off-plan section entirely when empty", () => {
    const html = renderDailyReport(BASE);
    expect(html).not.toMatch(/Off-plan topics covered/);
  });
});

describe("Push 86 — coins closing line", () => {
  it("includes 'She earned N coins today' when > 0", () => {
    const html = renderDailyReport({ ...BASE, coinsEarned: 7 });
    expect(html).toMatch(/She earned <b>7<\/b> coins today/);
  });
  it("uses singular form for exactly 1 coin", () => {
    const html = renderDailyReport({ ...BASE, coinsEarned: 1 });
    expect(html).toMatch(/She earned <b>1<\/b> coin today/);
  });
  it("omits the line when coinsEarned is 0 or undefined", () => {
    expect(renderDailyReport({ ...BASE, coinsEarned: 0 })).not.toMatch(
      /She earned/,
    );
    expect(renderDailyReport(BASE)).not.toMatch(/She earned/);
  });
});

describe("Push 86 — HTML safety", () => {
  it("escapes the caretaker label", () => {
    const html = renderDailyReport({
      ...BASE,
      caretakerLabel: "<script>x</script>",
    });
    expect(html).not.toMatch(/<script>x<\/script>/);
    expect(html).toMatch(/&lt;script&gt;x&lt;\/script&gt;/);
  });
  it("escapes block titles and topics", () => {
    const html = renderDailyReport({
      ...BASE,
      plannedBlocks: [
        { subjectSlug: "math", title: "<b>OOPS</b>", topic: "</li><script>" },
      ],
    });
    expect(html).not.toMatch(/<b>OOPS<\/b>/);
    expect(html).toMatch(/&lt;b&gt;OOPS&lt;\/b&gt;/);
    expect(html).toMatch(/&lt;\/li&gt;&lt;script&gt;/);
  });
  it("escapes the mood note", () => {
    const html = renderDailyReport({
      ...BASE,
      moodZone: "yellow",
      moodNote: "<img onerror=x>",
    });
    expect(html).not.toMatch(/<img onerror/);
    expect(html).toMatch(/&lt;img onerror=x&gt;/);
  });
});

describe("Push 86 — closing disclaimer", () => {
  it("includes the auto-sent + 'reply with corrections' line", () => {
    const html = renderDailyReport(BASE);
    expect(html).toMatch(/Sent automatically/);
    expect(html).toMatch(/Mom will see them/);
  });
});
