import { describe, it, expect } from "vitest";
import { parseIcs, eventForDateString } from "./_lib/icsParser";

const sample = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VEVENT
UID:abc-123@example.com
SUMMARY:Soccer practice
LOCATION:Kuhlman Field
DTSTART:20260504T230000Z
DTEND:20260505T003000Z
DESCRIPTION:Bring water bottle.
END:VEVENT
BEGIN:VEVENT
UID:bday-2026
SUMMARY:Mom birthday
DTSTART;VALUE=DATE:20260615
END:VEVENT
BEGIN:VEVENT
UID:weekly-tue
SUMMARY:Tutoring with Marcy
DTSTART:20260505T130000Z
DTEND:20260505T140000Z
RRULE:FREQ=WEEKLY;BYDAY=TU;COUNT=4
END:VEVENT
END:VCALENDAR`;

describe("icsParser", () => {
  it("parses a basic UTC-stamped VEVENT", () => {
    const events = parseIcs(sample, {
      windowStart: new Date("2026-05-01T00:00:00Z"),
      windowEnd: new Date("2026-07-01T00:00:00Z"),
    });
    const soccer = events.find((e) => e.summary === "Soccer practice");
    expect(soccer).toBeDefined();
    expect(soccer!.location).toBe("Kuhlman Field");
    expect(soccer!.allDay).toBe(false);
    expect(soccer!.startsAt.toISOString()).toBe("2026-05-04T23:00:00.000Z");
    expect(soccer!.endsAt!.toISOString()).toBe("2026-05-05T00:30:00.000Z");
  });

  it("parses an all-day event", () => {
    const events = parseIcs(sample, {
      windowStart: new Date("2026-05-01T00:00:00Z"),
      windowEnd: new Date("2026-07-01T00:00:00Z"),
    });
    const bday = events.find((e) => e.summary === "Mom birthday");
    expect(bday).toBeDefined();
    expect(bday!.allDay).toBe(true);
    expect(eventForDateString(bday!)).toBe("2026-06-15");
  });

  it("expands a WEEKLY RRULE with COUNT=4", () => {
    const events = parseIcs(sample, {
      windowStart: new Date("2026-05-01T00:00:00Z"),
      windowEnd: new Date("2026-07-01T00:00:00Z"),
    });
    const tutoring = events.filter((e) => e.summary === "Tutoring with Marcy");
    expect(tutoring.length).toBe(4);
    // All on Tuesday
    for (const e of tutoring) {
      expect(e.startsAt.getUTCDay()).toBe(2);
    }
  });

  it("skips events outside the window", () => {
    const events = parseIcs(sample, {
      windowStart: new Date("2027-01-01T00:00:00Z"),
      windowEnd: new Date("2027-12-31T00:00:00Z"),
    });
    expect(events.length).toBe(0);
  });

  it("unfolds line-continued summaries", () => {
    const folded = `BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:f1\nSUMMARY:Lo\n ng title spanning lines\nDTSTART:20260504T130000Z\nEND:VEVENT\nEND:VCALENDAR`;
    const events = parseIcs(folded, {
      windowStart: new Date("2026-05-01T00:00:00Z"),
      windowEnd: new Date("2026-07-01T00:00:00Z"),
    });
    expect(events[0].summary).toBe("Long title spanning lines");
  });
});
