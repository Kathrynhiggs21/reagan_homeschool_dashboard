/**
 * Push 70 (2026-05-13) — Sunday digest HTML renderer contract.
 *
 * Pin the structural sections + the Mom-only route shape so future
 * refactors don't quietly drop a section.
 */
import { describe, it, expect } from "vitest";
import { renderSundayDigestHtml } from "./_lib/sundayDigestRenderer";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROUTERS = readFileSync(join(__dirname, "routers.ts"), "utf8");

const samplePayload = {
  weekStart: "2026-05-04T00:00:00.000Z",
  weekEnd: "2026-05-10T23:59:59.000Z",
  levelUps: [{ title: "Mastered long division", category: "math" }],
  tutorSessionsCount: 2,
  flagsCount: 1,
  moodArc: { hard: 1, ok: 3, easy: 5, total: 9 },
  whatHelped: [
    { helper: "Tucker the dog nearby", count: 3 },
    { helper: "Short Pomodoros", count: 2 },
  ],
  subjectSummary: [
    { subject: "math", avgConfidence: 78, avgLevel: 3.2, skillsTracked: 12 },
    { subject: "ela", avgConfidence: 85, avgLevel: 3.6, skillsTracked: 10 },
  ],
  ihAlignment: [{ subject: "math", topic: "Decimals" }],
  generatedAt: "2026-05-11T19:00:00.000Z",
};

describe("renderSundayDigestHtml — sections", () => {
  it("returns a complete HTML doctype", () => {
    const html = renderSundayDigestHtml(samplePayload);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("</html>");
  });

  it("includes header with date range and student name", () => {
    const html = renderSundayDigestHtml(samplePayload, { studentName: "Reagan" });
    expect(html).toContain("Reagan's week");
    // Locale-tolerant: accept any month/day rendering, just confirm the year.
    expect(html).toMatch(/2026/);
  });

  it("emits all 4 sections (Highlights, Subjects, What helped, IH alignment)", () => {
    const html = renderSundayDigestHtml(samplePayload);
    expect(html).toContain("Highlights");
    expect(html).toContain("Subjects");
    expect(html).toContain("What helped");
    expect(html).toContain("Indian Hill 5th-grade topics this week");
  });

  it("renders subject rows from subjectSummary", () => {
    const html = renderSundayDigestHtml(samplePayload);
    expect(html).toMatch(/<td>math<\/td><td>3\.2<\/td>/);
    expect(html).toMatch(/<td>ela<\/td><td>3\.6<\/td>/);
  });

  it("renders summer banner only when opts.summerActive=true", () => {
    const off = renderSundayDigestHtml(samplePayload);
    const on = renderSundayDigestHtml(samplePayload, { summerActive: true });
    expect(off).not.toContain("Summer mode");
    expect(on).toContain("Summer mode");
  });

  it("escapes HTML in user-supplied strings", () => {
    const dirty = {
      ...samplePayload,
      whatHelped: [{ helper: "<script>alert('x')</script>", count: 1 }],
    };
    const html = renderSundayDigestHtml(dirty);
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("handles empty sections with a calm 'No data' line", () => {
    const empty = {
      weekStart: "2026-05-04T00:00:00.000Z",
      weekEnd: "2026-05-10T23:59:59.000Z",
    };
    const html = renderSundayDigestHtml(empty);
    expect(html).toContain("No subject data this week.");
    expect(html).toContain("No notes captured yet.");
    expect(html).toContain("No mirrored topics this week.");
  });
});

describe("digest.previewHtml route — Mom + Grandma contract", () => {
  it("is registered under digest router", () => {
    expect(ROUTERS).toMatch(/previewHtml:\s*familyAdminProcedure/);
  });

  it("opens the gate to Mom + Grandma via familyAdminProcedure", () => {
    expect(ROUTERS).toContain("previewHtml: familyAdminProcedure");
    expect(ROUTERS).toContain("Mom + Grandma");
  });

  it("surfaces a recipients list with both Mom and Grandma", () => {
    expect(ROUTERS).toContain("spear.cpt@gmail.com");
    expect(ROUTERS).toContain("marcy.spear@gmail.com");
  });

  it("calls renderSundayDigestHtml with the live payload", () => {
    expect(ROUTERS).toContain("renderSundayDigestHtml");
    expect(ROUTERS).toContain("buildWeeklyDigestPayload");
  });

  it("accepts an optional summerActive boolean", () => {
    expect(ROUTERS).toMatch(/summerActive:\s*z\.boolean\(\)\.optional\(\)/);
  });
});

describe("renderSundayDigestHtml — recipients line", () => {
  it("renders both Mom and Grandma when passed as recipients", () => {
    const html = renderSundayDigestHtml(samplePayload, {
      recipients: ["spear.cpt@gmail.com", "marcy.spear@gmail.com"],
    });
    expect(html).toContain("Recipients:");
    expect(html).toContain("spear.cpt@gmail.com");
    expect(html).toContain("marcy.spear@gmail.com");
  });

  it("omits the Recipients line entirely when none are passed (no-info rule)", () => {
    const html = renderSundayDigestHtml(samplePayload);
    expect(html).not.toContain("Recipients:");
  });

  it("escapes HTML in recipient addresses", () => {
    const html = renderSundayDigestHtml(samplePayload, {
      recipients: ["<bad>@example.com"],
    });
    expect(html).not.toContain("<bad>@example.com");
    expect(html).toContain("&lt;bad&gt;@example.com");
  });
});
