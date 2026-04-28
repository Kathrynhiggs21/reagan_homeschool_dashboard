import type { Express, Request, Response } from "express";
import * as db from "./db";

/**
 * Registers a public iCalendar feed:
 *   GET /api/calendar.ics  → text/calendar with all Reagan's scheduled blocks +
 *   timeline events + pinned whiteboard notes that have a showOnDate.
 *
 * Add this URL to Google Calendar → "Other calendars" → "From URL" and it
 * will auto-refresh every few hours.
 */

function pad(n: number): string { return n.toString().padStart(2, "0"); }

function toIcsDateLocal(d: Date): string {
  // YYYYMMDDTHHmmss (floating local time — Google Calendar will treat as calendar time)
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    "T" +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

function toIcsDateOnly(d: Date | string): string {
  const dd = typeof d === "string" ? new Date(d) : d;
  return dd.getFullYear().toString() + pad(dd.getMonth() + 1) + pad(dd.getDate());
}

function escText(s: string): string {
  return String(s || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export function registerCalendarFeed(app: Express) {
  app.get("/api/calendar.ics", async (_req: Request, res: Response) => {
    try {
      const lines: string[] = [];
      lines.push("BEGIN:VCALENDAR");
      lines.push("VERSION:2.0");
      lines.push("PRODID:-//Reagan's Classroom//Homeschool Dashboard//EN");
      lines.push("CALSCALE:GREGORIAN");
      lines.push("METHOD:PUBLISH");
      lines.push("X-WR-CALNAME:Reagan's Classroom");
      lines.push("X-WR-CALDESC:Daily schedule + timeline events + pinned notes");
      lines.push("X-WR-TIMEZONE:America/New_York");

      // === Timeline events (have real dates) ===
      try {
        const events: any[] = await db.listTimelineEvents?.(500) ?? [];
        for (const e of events) {
          const d = e.date instanceof Date ? e.date : new Date(e.date);
          if (isNaN(d.getTime())) continue;
          const ymd = toIcsDateOnly(d);
          lines.push("BEGIN:VEVENT");
          lines.push(`UID:timeline-${e.id}@reagans-classroom`);
          lines.push(`DTSTAMP:${toIcsDateLocal(new Date())}Z`);
          lines.push(`DTSTART;VALUE=DATE:${ymd}`);
          // DTEND exclusive — next day
          const end = new Date(d); end.setDate(end.getDate() + 1);
          lines.push(`DTEND;VALUE=DATE:${toIcsDateOnly(end)}`);
          lines.push(`SUMMARY:${escText(e.title || "Event")}`);
          if (e.body) lines.push(`DESCRIPTION:${escText(e.body)}`);
          if (e.tag) lines.push(`CATEGORIES:${escText(e.tag)}`);
          lines.push("END:VEVENT");
        }
      } catch {}

      // === Pinned/dated whiteboard notes ===
      try {
        const notes: any[] = await db.listWhiteboardNotes({ includeArchived: false });
        for (const n of notes) {
          if (!n.showOnDate) continue;
          const dStr = n.showOnDate instanceof Date
            ? n.showOnDate.toISOString().slice(0, 10)
            : String(n.showOnDate).slice(0, 10);
          const d = new Date(dStr + "T09:00:00");
          if (isNaN(d.getTime())) continue;
          lines.push("BEGIN:VEVENT");
          lines.push(`UID:note-${n.id}@reagans-classroom`);
          lines.push(`DTSTAMP:${toIcsDateLocal(new Date())}Z`);
          lines.push(`DTSTART;VALUE=DATE:${toIcsDateOnly(d)}`);
          const end = new Date(d); end.setDate(end.getDate() + 1);
          lines.push(`DTEND;VALUE=DATE:${toIcsDateOnly(end)}`);
          lines.push(`SUMMARY:${escText((n.emoji ? n.emoji + " " : "") + (n.title || "Note"))}`);
          if (n.body) lines.push(`DESCRIPTION:${escText(`From ${n.authorName || "parent"}: ${n.body}`)}`);
          lines.push("CATEGORIES:Whiteboard");
          lines.push("END:VEVENT");
        }
      } catch {}

      // === Today's schedule blocks (one-time entries, Reagan regenerates each day) ===
      try {
        const todayPlan = await (db as any).getOrCreateTodayPlan?.();
        if (todayPlan?.id) {
          const blocks: any[] = await db.listBlocksForPlan(todayPlan.id);
          const today = new Date();
          const y = today.getFullYear(), m = today.getMonth(), day = today.getDate();
          let defaultStartMin = 9 * 60; // 9:00 AM default
          for (const b of blocks) {
            let hh = Math.floor(defaultStartMin / 60), mm = defaultStartMin % 60;
            if (b.startTime) {
              const [h2, m2] = String(b.startTime).split(":").map((x: string) => parseInt(x, 10));
              if (Number.isFinite(h2)) { hh = h2; mm = m2 || 0; }
            }
            const start = new Date(y, m, day, hh, mm, 0);
            const end = new Date(start.getTime() + ((b.minutes || 30) * 60 * 1000));
            lines.push("BEGIN:VEVENT");
            lines.push(`UID:block-${b.id}@reagans-classroom`);
            lines.push(`DTSTAMP:${toIcsDateLocal(new Date())}Z`);
            lines.push(`DTSTART:${toIcsDateLocal(start)}`);
            lines.push(`DTEND:${toIcsDateLocal(end)}`);
            lines.push(`SUMMARY:${escText(b.title || b.slug || "Block")}`);
            if (b.description) lines.push(`DESCRIPTION:${escText(b.description)}`);
            if (b.slug) lines.push(`CATEGORIES:${escText(b.slug)}`);
            lines.push("END:VEVENT");
            defaultStartMin += (b.minutes || 30) + 5;
          }
        }
      } catch {}

      lines.push("END:VCALENDAR");
      const body = lines.join("\r\n") + "\r\n";
      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader("Content-Disposition", 'inline; filename="reagan.ics"');
      res.setHeader("Cache-Control", "public, max-age=300");
      res.send(body);
    } catch (err: any) {
      console.error("calendar feed error", err);
      res.status(500).send("Calendar feed error");
    }
  });
}
