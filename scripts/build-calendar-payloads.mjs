/**
 * Read scripts/pilot-blocks.json and emit one MCP create_events payload file
 * per day:  scripts/cal-payload-<date>.json
 *
 * Each event:
 *   summary    = "[Reagan Homeschool] <title>"
 *   start/end  = RFC3339 with -04:00 (EDT, America/New_York in late June)
 *   description = original description + a stable idempotency tag line
 *   reminders  = [10]  (10 min before)
 *
 * Late June 2026 is EDT (UTC-04:00). Hard-coded offset is correct for the
 * whole pilot window (no DST change between 6/17 and 6/30).
 */
import { readFileSync, writeFileSync } from "node:fs";

const blocks = JSON.parse(readFileSync(new URL("./pilot-blocks.json", import.meta.url), "utf8"));
const OFFSET = "-04:00"; // EDT for all of 6/17..6/30/2026

function addMinutes(hhmm, mins) {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + mins;
  const hh = String(Math.floor(total / 60) % 24).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

const byDate = new Map();
for (const b of blocks) {
  if (!b.startTime) continue; // skip blocks with no clock time
  const start = `${b.date}T${b.startTime}:00${OFFSET}`;
  const endHHMM = addMinutes(b.startTime, Math.max(1, b.durationMin || 30));
  const end = `${b.date}T${endHHMM}:00${OFFSET}`;
  const desc = `${b.description || ""}\n\n— dashboardBlockId=${b.id} • Reagan Homeschool Dashboard (auto-sync)`;
  const ev = {
    summary: `[Reagan Homeschool] ${b.title}`.slice(0, 250),
    description: desc.slice(0, 4000),
    start_time: start,
    end_time: end,
    calendar_id: "primary",
    reminders: [10],
  };
  if (!byDate.has(b.date)) byDate.set(b.date, []);
  byDate.get(b.date).push(ev);
}

let totalEvents = 0;
const dates = [];
for (const [date, events] of byDate) {
  writeFileSync(new URL(`./cal-payload-${date}.json`, import.meta.url), JSON.stringify({ events }, null, 2));
  totalEvents += events.length;
  dates.push(`${date}: ${events.length}`);
}
console.log(`Wrote ${byDate.size} day-payloads, ${totalEvents} events total`);
dates.forEach((d) => console.log("  " + d));
