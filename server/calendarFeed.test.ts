import { describe, it, expect } from "vitest";
import express from "express";
import { registerCalendarFeed } from "./calendarFeed";
import http from "http";

function listen(app: express.Express): Promise<{ port: number; close: () => void }> {
  return new Promise((resolve) => {
    const srv = http.createServer(app);
    srv.listen(0, () => {
      const addr = srv.address() as any;
      resolve({ port: addr.port, close: () => srv.close() });
    });
  });
}

async function get(port: number, path: string): Promise<{ status: number; body: string; ct: string }> {
  return new Promise((resolve, reject) => {
    http
      .get({ host: "127.0.0.1", port, path }, (res) => {
        let body = "";
        res.on("data", (d) => (body += d));
        res.on("end", () =>
          resolve({ status: res.statusCode || 0, body, ct: String(res.headers["content-type"] || "") }),
        );
      })
      .on("error", reject);
  });
}

describe("Calendar ICS feed", () => {
  it("returns valid iCalendar text", async () => {
    const app = express();
    registerCalendarFeed(app);
    const { port, close } = await listen(app);
    try {
      const r = await get(port, "/api/calendar.ics");
      expect(r.status).toBe(200);
      expect(r.ct).toContain("text/calendar");
      expect(r.body).toContain("BEGIN:VCALENDAR");
      expect(r.body).toContain("END:VCALENDAR");
      expect(r.body).toContain("X-WR-CALNAME:Reagan's Classroom");
    } finally {
      close();
    }
  });

  // Mom asked May 2026 so the Google Calendar subscription at
  // reaganschool.manus.space/api/calendar.ics shows the whole upcoming week,
  // not just today. The feed loops 14 days; UIDs must include plan.id so two
  // days that happen to share a block id can't collapse into one event.
  it("emits CRLF line endings (RFC 5545) and never returns malformed BEGIN/END pairs", async () => {
    const app = express();
    registerCalendarFeed(app);
    const { port, close } = await listen(app);
    try {
      const r = await get(port, "/api/calendar.ics");
      expect(r.body).toMatch(/\r\n/);
      const begins = (r.body.match(/BEGIN:VEVENT/g) || []).length;
      const ends = (r.body.match(/END:VEVENT/g) || []).length;
      expect(begins).toBe(ends);
      // Plan-scoped UID format — if someone reverts to UID:block-${b.id} the
      // 14-day window will start clobbering events.
      const uids = r.body.match(/UID:block-[^@\r]+/g) || [];
      for (const u of uids) {
        // "block-{plan.id}-{block.id}" => exactly two dashes after the prefix.
        const tail = u.replace(/^UID:block-/, "");
        expect(tail.split("-").length).toBeGreaterThanOrEqual(2);
      }
    } finally {
      close();
    }
  });
});
