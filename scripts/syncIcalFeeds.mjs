/**
 * One-shot script to sync all icalFeeds entries.
 * Run: node scripts/syncIcalFeeds.mjs
 */
import { createConnection } from "mysql2/promise";
import { parseIcs, eventForDateString } from "../server/_lib/icsParser.js";

const db = await createConnection(process.env.DATABASE_URL);

const [feeds] = await db.query("SELECT id, label, url FROM icalFeeds WHERE enabled = 1");

for (const feed of feeds) {
  console.log(`\nSyncing "${feed.label}" (id=${feed.id})…`);
  try {
    const r = await fetch(feed.url, { headers: { Accept: "text/calendar" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const text = await r.text();
    const events = parseIcs(text);
    console.log(`  Parsed ${events.length} events`);

    // Clear old events for this feed
    await db.query("DELETE FROM icalEvents WHERE feedId = ?", [feed.id]);

    // Insert fresh events
    for (const e of events) {
      const forDate = eventForDateString(e);
      await db.query(
        `INSERT INTO icalEvents (feedId, uid, summary, location, description, startsAt, endsAt, allDay, forDate, rawSnippet)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE summary=VALUES(summary), startsAt=VALUES(startsAt), endsAt=VALUES(endsAt), forDate=VALUES(forDate)`,
        [
          feed.id,
          e.uid,
          e.summary,
          e.location ?? null,
          e.description ?? null,
          e.startsAt ?? null,
          e.endsAt ?? null,
          e.allDay ? 1 : 0,
          forDate ?? null,
          e.rawSnippet ?? null,
        ]
      );
    }

    await db.query(
      "UPDATE icalFeeds SET lastSyncStatus='ok', lastSyncedAt=NOW(), eventsCached=? WHERE id=?",
      [events.length, feed.id]
    );
    console.log(`  ✓ Synced ${events.length} events`);
  } catch (err) {
    console.error(`  ✗ Failed: ${err.message}`);
    await db.query(
      "UPDATE icalFeeds SET lastSyncStatus='failed', lastSyncError=? WHERE id=?",
      [err.message, feed.id]
    );
  }
}

await db.end();
console.log("\nDone.");
