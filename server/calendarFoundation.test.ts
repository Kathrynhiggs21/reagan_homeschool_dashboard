/**
 * Push 66 (2026-05-13) — Calendar foundation.
 *
 * The earlier ICS-feed work already covers the bulk of the "Reagan's
 * Homeschool calendar" todo. This contract locks the remaining pieces:
 *
 *   1. `calendar.ownerEmail` is a defined default in APP_SETTING_DEFAULTS
 *      so first read is never null, AND its default is NOT the dead
 *      @ihsd.us account.
 *   2. CalendarSyncCard surfaces the owner email row Mom asked for.
 *   3. The calendar feed source code contains no @ihsd.us strings —
 *      this is the "ihsd.us guard rejects" line in the todo.
 *   4. The feed remains exposed at `/api/calendar.ics` (regression
 *      guard for the existing calendarFeed.test.ts smoke).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DB = readFileSync(join(__dirname, "db.ts"), "utf8");
const FEED = readFileSync(join(__dirname, "calendarFeed.ts"), "utf8");
const CARD = readFileSync(
  join(__dirname, "..", "client", "src", "components", "CalendarSyncCard.tsx"),
  "utf8",
);

describe("Calendar foundation — push 66", () => {
  it("APP_SETTING_DEFAULTS has calendar.ownerEmail", () => {
    expect(DB).toMatch(/"calendar\.ownerEmail":\s*"[^"]+"/);
  });

  it("calendar.ownerEmail default is NOT the dead @ihsd.us account", () => {
    const m = /"calendar\.ownerEmail":\s*"([^"]+)"/.exec(DB);
    expect(m).toBeTruthy();
    expect(m![1]).not.toMatch(/ihsd\.us$/i);
    expect(m![1]).not.toMatch(/reagan\.higgs33/i);
  });

  it("CalendarSyncCard renders the owner email row", () => {
    expect(CARD).toContain('data-testid="calendar-owner-row"');
    expect(CARD).toMatch(/key:\s*"calendar\.ownerEmail"/);
  });

  it("calendarFeed.ts contains no @ihsd.us strings", () => {
    expect(FEED).not.toMatch(/@ihsd\.us/);
    expect(FEED).not.toMatch(/reagan\.higgs33/);
  });

  it("ICS feed still mounts at /api/calendar.ics", () => {
    expect(FEED).toContain('"/api/calendar.ics"');
  });
});
