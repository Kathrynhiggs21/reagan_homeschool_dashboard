import { createConnection } from "mysql2/promise";

const db = await createConnection(process.env.DATABASE_URL);

async function syncFeed(id) {
  const [[feed]] = await db.query("SELECT id, label, url FROM icalFeeds WHERE id = ?", [id]);
  if (!feed) { console.log("Feed not found:", id); return; }

  console.log("Syncing:", feed.label);
  const r = await fetch(feed.url, { headers: { Accept: "text/calendar" } });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const text = await r.text();

  const events = [];
  const blocks = text.split("BEGIN:VEVENT");
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const get = (key) => {
      const m = block.match(new RegExp(key + "[^:]*:([^\r\n]+)"));
      return m ? m[1].trim() : null;
    };
    const uid = get("UID") || ("uid-" + i);
    const summary = get("SUMMARY") || "Event";
    const dtstart = get("DTSTART") || null;
    const dtend = get("DTEND") || null;
    const location = get("LOCATION");
    const allDay = dtstart && dtstart.indexOf("T") === -1;
    let startsAt = null, endsAt = null, forDate = null;
    if (dtstart) {
      if (allDay) {
        const y = dtstart.substr(0,4), mo = dtstart.substr(4,2), d = dtstart.substr(6,2);
        forDate = y + "-" + mo + "-" + d;
        startsAt = new Date(forDate + "T00:00:00Z");
      } else {
        const clean = dtstart.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?/, "$1-$2-$3T$4:$5:$6Z");
        startsAt = new Date(clean);
        forDate = startsAt.toISOString().slice(0, 10);
      }
    }
    if (dtend) {
      if (dtend.indexOf("T") === -1) {
        endsAt = new Date(dtend.substr(0,4) + "-" + dtend.substr(4,2) + "-" + dtend.substr(6,2) + "T00:00:00Z");
      } else {
        const clean = dtend.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?/, "$1-$2-$3T$4:$5:$6Z");
        endsAt = new Date(clean);
      }
    }
    events.push({ uid, summary, location, startsAt, endsAt, allDay: Boolean(allDay), forDate });
  }

  await db.query("DELETE FROM icalEvents WHERE feedId = ?", [id]);
  for (const e of events) {
    await db.query(
      "INSERT IGNORE INTO icalEvents (feedId, uid, summary, location, startsAt, endsAt, allDay, forDate) VALUES (?,?,?,?,?,?,?,?)",
      [id, e.uid, e.summary, e.location || null, e.startsAt || null, e.endsAt || null, e.allDay ? 1 : 0, e.forDate || null]
    );
  }
  await db.query(
    "UPDATE icalFeeds SET lastSyncStatus='ok', lastSyncedAt=NOW(), eventsCached=? WHERE id=?",
    [events.length, id]
  );
  console.log("  Synced", events.length, "events for", feed.label);
}

try { await syncFeed(1); } catch(e) { console.error("Feed 1 error:", e.message); }
try { await syncFeed(2); } catch(e) { console.error("Feed 2 error:", e.message); }

await db.end();
console.log("Done.");
