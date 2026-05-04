/**
 * Pure-TS ICS (RFC 5545) parser for the Schedule iCal overlay.
 *
 * Scope: enough to handle real-world feeds (Google Calendar exports, school
 * district public iCal files, soccer-team feeds). It supports VEVENT blocks
 * with DTSTART, DTEND, SUMMARY, LOCATION, DESCRIPTION, UID, RRULE
 * (FREQ=WEEKLY/DAILY with BYDAY, INTERVAL, UNTIL, COUNT). It deliberately
 * does NOT support EXDATE, RECURRENCE-ID overrides, VTIMEZONE definitions
 * other than UTC/local — Google Calendar always exports UTC-stamped DTSTART
 * for non-floating events and we treat floating times as Local-Eastern (the
 * household's timezone).
 *
 * Returns expanded event instances within the requested window so the caller
 * can simply persist them as rows.
 */

export interface ParsedIcsEvent {
  uid: string;
  summary: string;
  location: string | null;
  description: string | null;
  startsAt: Date;
  endsAt: Date | null;
  allDay: boolean;
  rawSnippet: string;
}

interface RawVevent {
  raw: string;
  fields: Record<string, { value: string; params: Record<string, string> }>;
}

function unfold(text: string): string[] {
  // RFC 5545 line unfolding: a continuation line begins with a single space or tab.
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  for (const ln of lines) {
    if ((ln.startsWith(" ") || ln.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += ln.slice(1);
    } else {
      out.push(ln);
    }
  }
  return out;
}

function parseField(line: string): { name: string; params: Record<string, string>; value: string } | null {
  const colonIdx = line.indexOf(":");
  if (colonIdx === -1) return null;
  const left = line.slice(0, colonIdx);
  const value = line.slice(colonIdx + 1);
  const segs = left.split(";");
  const name = segs[0].toUpperCase();
  const params: Record<string, string> = {};
  for (let i = 1; i < segs.length; i++) {
    const eq = segs[i].indexOf("=");
    if (eq > 0) params[segs[i].slice(0, eq).toUpperCase()] = segs[i].slice(eq + 1);
  }
  return { name, params, value };
}

function unescapeText(s: string): string {
  return s.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

function parseIcsDate(value: string, params: Record<string, string>): { date: Date; allDay: boolean } {
  // VALUE=DATE → "20260504" (all-day)
  // UTC stamp → "20260504T130000Z"
  // Floating → "20260504T130000" (treat as local)
  const isAllDay = (params.VALUE ?? "").toUpperCase() === "DATE" || /^\d{8}$/.test(value);
  if (isAllDay) {
    const y = Number(value.slice(0, 4));
    const m = Number(value.slice(4, 6)) - 1;
    const d = Number(value.slice(6, 8));
    return { date: new Date(y, m, d, 0, 0, 0), allDay: true };
  }
  const utc = value.endsWith("Z");
  const core = utc ? value.slice(0, -1) : value;
  const y = Number(core.slice(0, 4));
  const m = Number(core.slice(4, 6)) - 1;
  const d = Number(core.slice(6, 8));
  const hh = Number(core.slice(9, 11) || "0");
  const mm = Number(core.slice(11, 13) || "0");
  const ss = Number(core.slice(13, 15) || "0");
  const date = utc ? new Date(Date.UTC(y, m, d, hh, mm, ss)) : new Date(y, m, d, hh, mm, ss);
  return { date, allDay: false };
}

function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const BYDAY_TO_DOW: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function expandRrule(
  base: ParsedIcsEvent,
  rrule: string,
  windowStart: Date,
  windowEnd: Date,
): ParsedIcsEvent[] {
  const params: Record<string, string> = {};
  for (const part of rrule.split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0) params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
  }
  const freq = (params.FREQ || "").toUpperCase();
  if (freq !== "DAILY" && freq !== "WEEKLY") return [base];
  const interval = Math.max(1, Number(params.INTERVAL || "1"));
  const count = params.COUNT ? Number(params.COUNT) : Infinity;
  const until = params.UNTIL ? parseIcsDate(params.UNTIL, {}).date : windowEnd;
  const byDays = (params.BYDAY || "")
    .split(",")
    .map((s) => s.replace(/^[+-]?\d+/, ""))
    .filter((s) => s in BYDAY_TO_DOW)
    .map((s) => BYDAY_TO_DOW[s]);
  const out: ParsedIcsEvent[] = [];
  const dur = base.endsAt ? base.endsAt.getTime() - base.startsAt.getTime() : 60 * 60 * 1000;
  const start = base.startsAt;
  const horizon = until < windowEnd ? until : windowEnd;
  let produced = 0;
  if (freq === "DAILY") {
    let cursor = new Date(start);
    while (cursor <= horizon && produced < count) {
      if (cursor >= windowStart) {
        out.push({
          ...base,
          startsAt: new Date(cursor),
          endsAt: new Date(cursor.getTime() + dur),
        });
        produced++;
      }
      cursor = new Date(cursor.getTime() + interval * 86400000);
    }
  } else if (freq === "WEEKLY") {
    const targetDows = byDays.length ? byDays : [start.getDay()];
    // Walk week-by-week from the start, emitting each requested DOW.
    // COUNT applies from the RRULE's first occurrence (not from windowStart);
    // the outer caller filters by windowStart/windowEnd separately.
    let weekCursor = new Date(start);
    weekCursor.setHours(start.getHours(), start.getMinutes(), start.getSeconds(), 0);
    while (weekCursor <= horizon && produced < count) {
      for (const dow of targetDows) {
        const offset = (dow - weekCursor.getDay() + 7) % 7;
        const occ = new Date(weekCursor);
        occ.setDate(occ.getDate() + offset);
        if (occ < start) continue;
        if (occ > horizon) continue;
        out.push({
          ...base,
          startsAt: new Date(occ),
          endsAt: new Date(occ.getTime() + dur),
        });
        produced++;
        if (produced >= count) break;
      }
      weekCursor = new Date(weekCursor.getTime() + interval * 7 * 86400000);
    }
  }
  return out;
}

export function parseIcs(
  text: string,
  opts: { windowStart?: Date; windowEnd?: Date; nowFallback?: Date } = {},
): ParsedIcsEvent[] {
  const now = opts.nowFallback ?? new Date();
  const windowStart = opts.windowStart ?? new Date(now.getTime() - 14 * 86400000);
  const windowEnd = opts.windowEnd ?? new Date(now.getTime() + 120 * 86400000);

  const lines = unfold(text);
  const events: ParsedIcsEvent[] = [];
  let inEvent = false;
  let block: string[] = [];
  let raw = "";

  for (const ln of lines) {
    const trimmed = ln.trim();
    if (trimmed === "BEGIN:VEVENT") { inEvent = true; block = []; raw = ""; continue; }
    if (trimmed === "END:VEVENT") {
      inEvent = false;
      const fields: Record<string, { value: string; params: Record<string, string> }> = {};
      for (const fline of block) {
        const f = parseField(fline);
        if (f) fields[f.name] = { value: f.value, params: f.params };
      }
      raw = block.join("\n");
      const dtstart = fields.DTSTART;
      if (!dtstart) continue;
      const start = parseIcsDate(dtstart.value, dtstart.params);
      const dtend = fields.DTEND;
      const end = dtend ? parseIcsDate(dtend.value, dtend.params).date : null;
      const base: ParsedIcsEvent = {
        uid: fields.UID?.value ?? `gen-${start.date.toISOString()}-${fields.SUMMARY?.value || ""}`,
        summary: unescapeText(fields.SUMMARY?.value ?? "(untitled event)"),
        location: fields.LOCATION ? unescapeText(fields.LOCATION.value) : null,
        description: fields.DESCRIPTION ? unescapeText(fields.DESCRIPTION.value) : null,
        startsAt: start.date,
        endsAt: end,
        allDay: start.allDay,
        rawSnippet: raw.slice(0, 1500),
      };
      const rrule = fields.RRULE?.value;
      if (rrule) {
        for (const inst of expandRrule(base, rrule, windowStart, windowEnd)) {
          if (inst.startsAt >= windowStart && inst.startsAt <= windowEnd) events.push(inst);
        }
      } else if (base.startsAt >= windowStart && base.startsAt <= windowEnd) {
        events.push(base);
      }
      continue;
    }
    if (inEvent) block.push(ln);
  }

  return events;
}

export function eventForDateString(e: ParsedIcsEvent): string {
  return ymdLocal(e.startsAt);
}
