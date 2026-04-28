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
});
