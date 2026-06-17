import { describe, it, expect, vi } from "vitest";

/**
 * Tests for maybeAutoPushPilotOnWritable() — the one-time back-dated pilot
 * push that fires the moment the calendar becomes writable.
 *
 * The helper exposes injectable seams (syncRange / getFlag / setFlag) so we
 * can assert gating + idempotency deterministically, with no live DB and no
 * Calendar API. Intra-module named-import calls can't be reliably spied on,
 * which is exactly why those seams exist.
 */

import {
  maybeAutoPushPilotOnWritable,
  runCalendarSyncForRange,
  PILOT_RANGE,
  PILOT_FLAG_KEY,
  type CalendarSyncSummary,
} from "./_lib/googleCalendarSync";

function totals(over: Partial<CalendarSyncSummary> = {}): CalendarSyncSummary {
  return {
    status: "synced",
    dateISO: `${PILOT_RANGE.startISO}..${PILOT_RANGE.endISO}`,
    eventsCreated: 30,
    eventsUpdated: 0,
    eventsDeleted: 0,
    attendeesInvited: 0,
    errorCount: 0,
    ...over,
  };
}

describe("maybeAutoPushPilotOnWritable", () => {
  it("does nothing when the calendar is not writable", async () => {
    const syncRange = vi.fn();
    const getFlag = vi.fn();
    const setFlag = vi.fn();
    const res = await maybeAutoPushPilotOnWritable("read_only", {
      syncRange: syncRange as any,
      getFlag,
      setFlag,
    });
    expect(res).toEqual({ ran: false, reason: "not_writable" });
    expect(getFlag).not.toHaveBeenCalled();
    expect(syncRange).not.toHaveBeenCalled();
    expect(setFlag).not.toHaveBeenCalled();
  });

  it("does nothing when no_credentials", async () => {
    const syncRange = vi.fn();
    const res = await maybeAutoPushPilotOnWritable("no_credentials", {
      syncRange: syncRange as any,
      getFlag: vi.fn(),
      setFlag: vi.fn(),
    });
    expect(res).toEqual({ ran: false, reason: "not_writable" });
    expect(syncRange).not.toHaveBeenCalled();
  });

  it("skips when the pilot flag is already set", async () => {
    const syncRange = vi.fn();
    const getFlag = vi.fn().mockResolvedValue("2026-06-17T12:00:00.000Z");
    const setFlag = vi.fn();
    const res = await maybeAutoPushPilotOnWritable("writable", {
      syncRange: syncRange as any,
      getFlag,
      setFlag,
    });
    expect(res).toEqual({ ran: false, reason: "already_pushed" });
    expect(getFlag).toHaveBeenCalledWith(PILOT_FLAG_KEY);
    expect(syncRange).not.toHaveBeenCalled();
    expect(setFlag).not.toHaveBeenCalled();
  });

  it("pushes the 6/17–6/30 range and stamps the flag on a clean sync", async () => {
    const clean = totals();
    const syncRange = vi.fn().mockResolvedValue({ totals: clean, days: [] });
    const getFlag = vi.fn().mockResolvedValue(null); // not yet pushed
    const setFlag = vi.fn().mockResolvedValue(undefined);

    const res = await maybeAutoPushPilotOnWritable("writable", {
      syncRange: syncRange as any,
      getFlag,
      setFlag,
    });
    expect(syncRange).toHaveBeenCalledWith(PILOT_RANGE.startISO, PILOT_RANGE.endISO, {
      fetchImpl: undefined,
    });
    expect(res).toEqual({ ran: true, totals: clean });
    expect(setFlag).toHaveBeenCalledTimes(1);
    expect(setFlag.mock.calls[0][0]).toBe(PILOT_FLAG_KEY);
    expect(typeof setFlag.mock.calls[0][1]).toBe("string");
  });

  it("does NOT stamp the flag when the sync had errors (so it retries next time)", async () => {
    const errored = totals({ status: "synced_with_errors", eventsCreated: 10, errorCount: 3 });
    const syncRange = vi.fn().mockResolvedValue({ totals: errored, days: [] });
    const getFlag = vi.fn().mockResolvedValue(null);
    const setFlag = vi.fn();

    const res = await maybeAutoPushPilotOnWritable("writable", {
      syncRange: syncRange as any,
      getFlag,
      setFlag,
    });
    expect(res).toEqual({ ran: true, totals: errored });
    expect(setFlag).not.toHaveBeenCalled();
  });

  it("treats an empty-string flag as not-yet-pushed", async () => {
    const clean = totals();
    const syncRange = vi.fn().mockResolvedValue({ totals: clean, days: [] });
    const getFlag = vi.fn().mockResolvedValue("   ");
    const setFlag = vi.fn().mockResolvedValue(undefined);
    const res = await maybeAutoPushPilotOnWritable("writable", {
      syncRange: syncRange as any,
      getFlag,
      setFlag,
    });
    expect(res.ran).toBe(true);
    expect(syncRange).toHaveBeenCalledOnce();
  });

  it("does not throw if setFlag rejects (flag write is best-effort)", async () => {
    const clean = totals();
    const syncRange = vi.fn().mockResolvedValue({ totals: clean, days: [] });
    const getFlag = vi.fn().mockResolvedValue(null);
    const setFlag = vi.fn().mockRejectedValue(new Error("db down"));
    const res = await maybeAutoPushPilotOnWritable("writable", {
      syncRange: syncRange as any,
      getFlag,
      setFlag,
    });
    expect(res).toEqual({ ran: true, totals: clean });
  });

  it("exposes the canonical pilot range constants", () => {
    expect(PILOT_RANGE.startISO).toBe("2026-06-17");
    expect(PILOT_RANGE.endISO).toBe("2026-06-30");
    expect(PILOT_FLAG_KEY).toBe("calendar.pilotPushedAt");
  });
});

describe("runCalendarSyncForRange (export sanity)", () => {
  it("is a function", () => {
    expect(typeof runCalendarSyncForRange).toBe("function");
  });
});
