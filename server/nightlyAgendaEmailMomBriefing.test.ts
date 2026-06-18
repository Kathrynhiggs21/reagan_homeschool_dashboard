import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = readFileSync(resolve(__dirname, "scheduledSync.ts"), "utf-8");

describe("Push 162 — wire buildDailyMomBriefing into nightly-agenda-email", () => {
  it("imports buildDailyMomBriefing", () => {
    expect(SRC).toMatch(/import\s*\{\s*buildDailyMomBriefing\s*\}\s*from\s*["']\.\/_lib\/dailyMomBriefing["']/);
  });

  it("calls buildDailyMomBriefing inside the nightly-agenda-email handler", () => {
    const idx = SRC.indexOf("/api/scheduled/nightly-agenda-email");
    expect(idx).toBeGreaterThan(-1);
    const handlerSlice = SRC.slice(idx, idx + 20000);
    expect(handlerSlice).toMatch(/buildDailyMomBriefing\s*\(\s*\{[\s\S]*schoolDayISO\s*:\s*forDate/);
    expect(handlerSlice).toMatch(/kidName\s*:\s*payload\.studentName/);
    expect(handlerSlice).toMatch(/worksheetsAttached\s*:\s*perBlockAttachments\.length/);
  });

  it("emits momBriefing on the response with exactly the published shape", () => {
    const idx = SRC.indexOf("/api/scheduled/nightly-agenda-email");
    const handlerSlice = SRC.slice(idx, idx + 20000);
    expect(handlerSlice).toMatch(/momBriefing\s*:\s*momBriefing\s*\?/);
    expect(handlerSlice).toMatch(/schoolDayISO\s*:\s*momBriefing\.schoolDayISO/);
    expect(handlerSlice).toMatch(/markdownBody\s*:\s*momBriefing\.markdownBody/);
    expect(handlerSlice).toMatch(/notificationHeadline\s*:\s*momBriefing\.notificationHeadline/);
    expect(handlerSlice).toMatch(/moodBand\s*:\s*momBriefing\.moodRollup\.band/);
    expect(handlerSlice).toMatch(/plannedVsActualLine\s*:\s*momBriefing\.plannedVsActualLine/);
  });

  it("buildDailyMomBriefing call is wrapped in try/catch so missing data never crashes the handler", () => {
    const idx = SRC.indexOf("buildDailyMomBriefing(");
    expect(idx).toBeGreaterThan(-1);
    const before = SRC.slice(Math.max(0, idx - 200), idx);
    expect(before).toMatch(/try\s*\{/);
  });

  it("derives totalMinutesPlanned from payload.blocks (sum of durationMin)", () => {
    expect(SRC).toMatch(/totalMinutesPlanned\s*:\s*\(payload\.blocks[\s\S]{0,80}reduce\([\s\S]{0,200}durationMin/);
  });
});
