/**
 * v2.32 (2026-05-18) — Calendar identity surface lock.
 *
 * Closes one open Calendar todo: "Settings → Accounts & Emails panel
 * surfaces calendar ID + owner email" — the canonical Google Calendar
 * (`o81tqeb4425ej2k9il7lhmooh4@group.calendar.google.com`, owned by
 * `spear.cpt@gmail.com`) is now visible on the Calendar tab so Mom +
 * Grandma can confirm the dashboard is wired to the same calendar they
 * subscribe to in Google.
 *
 * Source-pattern checks against the actual files; no live DB.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DB_TS = readFileSync(resolve(__dirname, "db.ts"), "utf-8");
const ROUTERS_TS = readFileSync(resolve(__dirname, "routers.ts"), "utf-8");
const CARD_TSX = readFileSync(
  resolve(__dirname, "../client/src/components/CalendarSyncCard.tsx"),
  "utf-8",
);

describe("v2.32 — calendar.id + calendar.id.ownerEmail app_settings defaults", () => {
  it("seeds calendar.id with the canonical group calendar ID", () => {
    expect(DB_TS).toMatch(/"calendar\.id":\s*"o81tqeb4425ej2k9il7lhmooh4@group\.calendar\.google\.com"/);
  });

  it("seeds calendar.id.ownerEmail with spear.cpt@gmail.com (Mom's account)", () => {
    expect(DB_TS).toMatch(/"calendar\.id\.ownerEmail":\s*"spear\.cpt@gmail\.com"/);
  });

  it("keeps the existing calendar.ownerEmail (ICS subscriber) row intact", () => {
    expect(DB_TS).toMatch(/"calendar\.ownerEmail":\s*"reaganhiggs910@gmail\.com"/);
  });
});

describe("v2.32 — prefs.getPublic ALLOW set permits calendar identity reads", () => {
  // Slice out just the getPublic ALLOW set so we don't accidentally match
  // strings that appear elsewhere in the file (defaults, other allowlists).
  const allowStart = ROUTERS_TS.indexOf("Public-safe key allowlist");
  const allowEnd = ROUTERS_TS.indexOf("absence:YYYY-MM-DD", allowStart);
  expect(allowStart).toBeGreaterThan(0);
  expect(allowEnd).toBeGreaterThan(allowStart);
  const allowSlice = ROUTERS_TS.slice(allowStart, allowEnd);

  it("includes calendar.id in the public allowlist", () => {
    expect(allowSlice).toMatch(/"calendar\.id"/);
  });

  it("includes calendar.id.ownerEmail in the public allowlist", () => {
    expect(allowSlice).toMatch(/"calendar\.id\.ownerEmail"/);
  });

  it("still includes the legacy calendar.ownerEmail key", () => {
    expect(allowSlice).toMatch(/"calendar\.ownerEmail"/);
  });
});

describe("v2.32 — CalendarSyncCard surfaces calendar ID + owner email", () => {
  it("queries prefs.get for calendar.id", () => {
    expect(CARD_TSX).toMatch(/key:\s*"calendar\.id"/);
  });

  it("queries prefs.get for calendar.id.ownerEmail", () => {
    expect(CARD_TSX).toMatch(/key:\s*"calendar\.id\.ownerEmail"/);
  });

  it("renders a calendar-identity-block container", () => {
    expect(CARD_TSX).toMatch(/data-testid="calendar-identity-block"/);
  });

  it("renders a calendar-id-row with the live calendar ID code element", () => {
    expect(CARD_TSX).toMatch(/data-testid="calendar-id-row"/);
    // The card should render the calendarId variable, not a hard-coded
    // string — that way Mom can edit it via prefs without a code change.
    expect(CARD_TSX).toMatch(/\{calendarId\}/);
  });

  it("renders a calendar-id-owner-row with the live owner email", () => {
    expect(CARD_TSX).toMatch(/data-testid="calendar-id-owner-row"/);
    expect(CARD_TSX).toMatch(/\{calendarOwnerEmail\}/);
  });

  it("provides a Copy button for the calendar ID", () => {
    expect(CARD_TSX).toMatch(/data-testid="calendar-id-copy-btn"/);
    expect(CARD_TSX).toMatch(/copyCalendarId/);
  });

  it("provides an 'Open in Google' link to the calendar settings page", () => {
    expect(CARD_TSX).toMatch(/data-testid="calendar-id-google-link"/);
    expect(CARD_TSX).toMatch(/calendar\.google\.com/);
    // The link must encode the calendarId so Mom lands on the right calendar.
    expect(CARD_TSX).toMatch(/encodeURIComponent\(calendarId\)/);
  });

  it("falls back to the canonical calendar ID when the prefs query is loading / empty", () => {
    // Defensive default so the UI never shows blank if the DB row was wiped.
    expect(CARD_TSX).toMatch(/o81tqeb4425ej2k9il7lhmooh4@group\.calendar\.google\.com/);
  });

  it("falls back to spear.cpt@gmail.com for the owner account default", () => {
    expect(CARD_TSX).toMatch(/spear\.cpt@gmail\.com/);
  });

  it("preserves the existing ICS subscriber (calendar-owner-row) display", () => {
    // Push 66's ICS-subscriber row must still ship; v2.32 only adds rows.
    expect(CARD_TSX).toMatch(/data-testid="calendar-owner-row"/);
    expect(CARD_TSX).toMatch(/ICS subscriber/);
  });

  it("warns adults that switching the ID rewires sync (so they don't change it casually)", () => {
    expect(CARD_TSX).toMatch(/Changing the ID rewires sync|rewires sync/);
  });
});
