import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, and } from "drizzle-orm";
import {
  getDb,
  ensurePlanForDate,
  recordActualEntry,
  queueOffPlanTopicForDriveSync,
} from "./db";
import {
  buildDayLogMarkdown,
  formatDayLogMarkdown,
  loadDayLogPayload,
  dayLogFileName,
  dayLogSubpath,
} from "./_lib/dayLogBuilder";
import {
  actualAgendaEntries,
  topicsCoveredOffPlan,
  drivePushQueue,
} from "../drizzle/schema";

/**
 * REAL-DB integration: day-log builder + day-log-rebuild route.
 *
 * Proves:
 *  - loadDayLogPayload reads planned + actual + off-plan from live tables
 *  - formatDayLogMarkdown renders the right sections deterministically
 *  - buildDayLogMarkdown(date) returns identical output to format(payload)
 *  - filename + subpath helpers produce the canonical Drive path
 */

const TEST_DATE = "2031-05-20"; // weekday: Tuesday
const TEST_SUBJECT = "math";
const TEST_TOPIC = `INT_DAYLOG_${Date.now()}`;

describe("Slice 4.5 — dayLogBuilder real-DB integration", () => {
  beforeAll(async () => {
    const db = getDb();
    // Clean residue from prior runs.
    await db.delete(actualAgendaEntries).where(eq(actualAgendaEntries.dateISO, TEST_DATE));
    await db.delete(topicsCoveredOffPlan).where(eq(topicsCoveredOffPlan.dateISO, TEST_DATE));
    await db
      .delete(drivePushQueue)
      .where(eq(drivePushQueue.targetSubpath as any, "2031-05" as any));
  });

  afterAll(async () => {
    const db = getDb();
    await db.delete(actualAgendaEntries).where(eq(actualAgendaEntries.dateISO, TEST_DATE));
    await db.delete(topicsCoveredOffPlan).where(eq(topicsCoveredOffPlan.dateISO, TEST_DATE));
    await db
      .delete(drivePushQueue)
      .where(eq(drivePushQueue.targetSubpath as any, "2031-05" as any));
  });

  it("dayLogFileName + dayLogSubpath produce canonical path parts", () => {
    expect(dayLogFileName(TEST_DATE)).toBe(`${TEST_DATE} - Day Log.md`);
    expect(dayLogSubpath(TEST_DATE)).toBe("2031-05");
  });

  it("loadDayLogPayload reflects DB state (plan + actual + off-plan)", async () => {
    // Seed: ensure a plan, record one actual entry, record one off-plan topic.
    await ensurePlanForDate(TEST_DATE);
    await recordActualEntry({
      dateISO: TEST_DATE,
      plannedBlockId: null,
      subjectSlug: TEST_SUBJECT as any,
      topic: TEST_TOPIC,
      minutesSpent: 25,
      source: "mom-input" as any,
      notes: "integration test entry",
      createdBy: null,
    } as any);
    const md = `# off-plan probe\n\nthe details.\n`;
    await queueOffPlanTopicForDriveSync(TEST_DATE, "art", `${TEST_TOPIC}_off`, null, md);

    const payload = await loadDayLogPayload(TEST_DATE);
    expect(payload.dateISO).toBe(TEST_DATE);
    expect(payload.planExists).toBe(true);
    expect(payload.isWeekend).toBe(false);
    expect(payload.actualEntries.length).toBeGreaterThanOrEqual(1);
    const ours = payload.actualEntries.find((e) => e.topic === TEST_TOPIC);
    expect(ours).toBeDefined();
    expect(ours!.minutesSpent).toBe(25);
    expect(ours!.subjectSlug).toBe(TEST_SUBJECT);
    expect(ours!.source).toBe("mom-input");
    expect(payload.totalActualMinutes).toBeGreaterThanOrEqual(25);
    expect(payload.offPlanTopics.some((o) => o.topic === `${TEST_TOPIC}_off`)).toBe(true);
  });

  it("formatDayLogMarkdown renders Planned/Actual/Off-plan sections deterministically", async () => {
    const payload = await loadDayLogPayload(TEST_DATE);
    const md = formatDayLogMarkdown(payload);

    expect(md).toContain(`# Day Log — ${TEST_DATE}`);
    expect(md).toContain("## Planned");
    expect(md).toContain("## Actual");
    expect(md).toContain(TEST_TOPIC);
    expect(md).toContain("25 min");
    expect(md).toContain("mom-input");
    expect(md).toContain("## Off-plan topics covered");
    expect(md).toContain(`${TEST_TOPIC}_off`);

    // Determinism: same payload → same string.
    const md2 = formatDayLogMarkdown(payload);
    expect(md2).toBe(md);
  });

  it("buildDayLogMarkdown(date) === formatDayLogMarkdown(loadDayLogPayload(date))", async () => {
    const direct = await buildDayLogMarkdown(TEST_DATE);
    const composed = formatDayLogMarkdown(await loadDayLogPayload(TEST_DATE));
    expect(direct).toBe(composed);
  });

  it("Saturday gets the weekend banner", async () => {
    // 2031-05-24 is a Saturday.
    const sat = "2031-05-24";
    const payload = await loadDayLogPayload(sat);
    expect(payload.isWeekend).toBe(true);
    const md = formatDayLogMarkdown(payload);
    expect(md).toContain("Weekend — no school day.");
  });
});
