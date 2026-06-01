/**
 * Push 46 (2026-05-13) — Settings → Daily Recap panel.
 *
 * Note: a separate test file (server/dailyRecap.test.ts) already covers the
 * INBOUND daily-recap-send/reply workflow. This file covers the new OUTBOUND
 * end-of-day digest panel + composer. Pure source-level contract; no DB.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { formatDailyRecapHtml } from "./db";

const repoRoot = path.resolve(__dirname, "..");

function readSrc(rel: string): string {
  return readFileSync(path.join(repoRoot, rel), "utf8");
}

describe("Push 46 — Daily Recap panel (outbound)", () => {
  it("formatDailyRecapHtml renders headline numbers + every entry", () => {
    const html = formatDailyRecapHtml({
      dateISO: "2026-05-13",
      studentName: "Reagan",
      plannedTotal: 5,
      plannedComplete: 3,
      totalActualMinutes: 95,
      actualEntries: [
        { subjectSlug: "math", topic: "Decimals review", minutesSpent: 30, source: "planned-block" },
        { subjectSlug: "ela",  topic: "Wonder ch. 12",   minutesSpent: 25, source: "kiwi-listened", notes: "loved it" },
      ],
      offPlanTopics: [{ subjectSlug: "art", topic: "Watercolor mixing" }],
      prefs: { includeKiwi: false, includeMood: false },
    });
    expect(html).toContain("Reagan's Day Recap");
    expect(html).toContain("2026-05-13");
    expect(html).toContain("<b>3/5</b>");
    expect(html).toContain("<b>95 min</b>");
    expect(html).toContain("Decimals review");
    expect(html).toContain("Wonder ch. 12");
    expect(html).toContain("(kiwi-listened)");
    expect(html).toContain("loved it");
    expect(html).toContain("Watercolor mixing");
    expect(html).not.toContain("Kiwi listening focus");
    expect(html).not.toContain("Mood through the day");
  });

  it("gates Kiwi + Mood sections on prefs", () => {
    const html = formatDailyRecapHtml({
      dateISO: "2026-05-13",
      studentName: "Reagan",
      plannedTotal: 0,
      plannedComplete: 0,
      totalActualMinutes: 0,
      actualEntries: [],
      offPlanTopics: [],
      kiwiFocus: [{ subjectSlug: "math", minutes: 12 }],
      moodHistogram: [1, 2, 3, 4, 5, 6],
      prefs: { includeKiwi: true, includeMood: true },
    });
    expect(html).toContain("Kiwi listening focus");
    expect(html).toContain("<b>math</b>");
    expect(html).toContain("12 min");
    expect(html).toContain("Mood through the day");
  });

  it("escapes HTML in topic + notes", () => {
    const html = formatDailyRecapHtml({
      dateISO: "2026-05-13",
      studentName: "Reagan",
      plannedTotal: 1,
      plannedComplete: 0,
      totalActualMinutes: 10,
      actualEntries: [
        { subjectSlug: "science", topic: "<script>x</script>", minutesSpent: 10, notes: "a & b" },
      ],
      offPlanTopics: [],
      prefs: { includeKiwi: false, includeMood: false },
    });
    expect(html).not.toMatch(/<script>x<\/script>/);
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("a &amp; b");
  });

  it("registers a dailyRecap router with get/set/preview", () => {
    const routers = readSrc("server/routers.ts");
    const idx = routers.indexOf("dailyRecap: router({");
    expect(idx, "dailyRecap router must exist").toBeGreaterThan(0);
    const slice = routers.slice(idx, idx + 1800);
    expect(slice).toMatch(/get:\s*protectedProcedure\.query/);
    expect(slice).toMatch(/set:\s*protectedProcedure/);
    expect(slice).toMatch(/preview:\s*protectedProcedure/);
    expect(slice.match(/ctx\.user\.role/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it("Settings mounts <DailyRecapCard /> (tab consolidated into Email tab)", () => {
    // v3.28 (2026-06-01): the Recap tab was folded into the Email tab so
    // recipients + agenda toggle + daily recap + catch-up queue all live
    // in one place. The DailyRecapCard is still mounted; the standalone
    // tab no longer exists.
    const settings = readSrc("client/src/pages/Settings.tsx");
    expect(settings).toContain("<DailyRecapCard />");
    expect(settings).toContain("function DailyRecapCard()");
    expect(settings).toMatch(/dailyRecap\?\.get\?\.useQuery/);
    expect(settings).toMatch(/dailyRecap\?\.preview\?\.useQuery/);
    expect(settings).toMatch(/dailyRecap\?\.set\?\.useMutation/);
  });

  it("db exports the recap pref helpers + previewer", () => {
    const dbSrc = readSrc("server/db.ts");
    expect(dbSrc).toMatch(/export\s+async\s+function\s+getDailyRecapPrefs/);
    expect(dbSrc).toMatch(/export\s+async\s+function\s+setDailyRecapPrefs/);
    expect(dbSrc).toMatch(/export\s+async\s+function\s+previewDailyRecap/);
    expect(dbSrc).toContain('"recap.enabled"');
    expect(dbSrc).toContain('"recap.sendTimeET"');
    expect(dbSrc).toContain('"recap.recipients"');
  });
});
