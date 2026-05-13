/**
 * Push 112 (2026-05-13) — Grandma SMS digest contract.
 */
import { describe, it, expect } from "vitest";
import { renderGrandmaSmsDigest } from "./_lib/grandmaSmsDigest";

const BASE = {
  weekStartIso: "2026-05-04",
  weekEndIso: "2026-05-10",
  totalHours: 18.5,
  greenShare: 0.72,
  redShare: 0.05,
  headline: "Strong week",
};

describe("Push 112 — Grandma SMS digest", () => {
  it("renders within 160 chars when URL is omitted", () => {
    const r = renderGrandmaSmsDigest(BASE);
    expect(r.text.length).toBeLessThanOrEqual(160);
    expect(r.truncated).toBe(false);
  });

  it("includes IEP paper-trail framing tag", () => {
    const r = renderGrandmaSmsDigest(BASE);
    expect(r.text).toMatch(/IEP paper-trail/);
  });

  it("includes the date range, hours, green%, and red%", () => {
    const r = renderGrandmaSmsDigest(BASE);
    expect(r.text).toContain("2026-05-04");
    expect(r.text).toContain("2026-05-10");
    expect(r.text).toContain("18.5h");
    expect(r.text).toContain("72% green");
    expect(r.text).toContain("5% red");
  });

  it("appends short URL when total stays ≤160", () => {
    const r = renderGrandmaSmsDigest({
      ...BASE,
      dashboardUrl: "https://r.hs/wk",
    });
    expect(r.text.endsWith("https://r.hs/wk")).toBe(true);
    expect(r.text.length).toBeLessThanOrEqual(160);
  });

  it("drops URL with truncationReason=url-dropped when URL would push past 160", () => {
    const longUrl =
      "https://reagan-homeschool-very-long-domain.example/dashboard/weekly?token=abcdefghij";
    const r = renderGrandmaSmsDigest({ ...BASE, dashboardUrl: longUrl });
    expect(r.text.length).toBeLessThanOrEqual(160);
    expect(r.truncated).toBe(true);
    expect(r.truncationReason).toBe("url-dropped");
    expect(r.text.includes(longUrl)).toBe(false);
  });

  it("drops headline with truncationReason=headline-dropped when even body+headline is too long", () => {
    const r = renderGrandmaSmsDigest({
      ...BASE,
      headline: "x".repeat(140),
    });
    expect(r.text.length).toBeLessThanOrEqual(160);
    expect(r.truncated).toBe(true);
    expect(r.truncationReason).toBe("headline-dropped");
  });

  it("truncationReason omitted when no truncation occurred", () => {
    const r = renderGrandmaSmsDigest(BASE);
    expect(r.truncationReason).toBeUndefined();
  });

  it("clamps non-finite shares to ?% / 0 hours fallback for totalHours", () => {
    const r = renderGrandmaSmsDigest({
      ...BASE,
      greenShare: NaN,
      redShare: Infinity,
      totalHours: -3,
    });
    // -3 should fall back to 0.0
    expect(r.text).toContain("0.0h");
    expect(r.text).toContain("?% green");
    // Infinity is non-finite → ?%
    expect(r.text).toContain("?% red");
  });

  it("rounds shares to whole percent", () => {
    const r = renderGrandmaSmsDigest({
      ...BASE,
      greenShare: 0.666,
      redShare: 0.014,
    });
    expect(r.text).toContain("67% green");
    expect(r.text).toContain("1% red");
  });

  it("omits headline cleanly when blank string supplied", () => {
    const r = renderGrandmaSmsDigest({ ...BASE, headline: "   " });
    expect(r.text).toContain("Reagan ");
    // No trailing double space before "(IEP paper-trail)"
    expect(r.text).toMatch(/red\. \(IEP paper-trail\)/);
  });

  it("clamps share above 1 to 100%", () => {
    const r = renderGrandmaSmsDigest({ ...BASE, greenShare: 1.7 });
    expect(r.text).toContain("100% green");
  });
});
