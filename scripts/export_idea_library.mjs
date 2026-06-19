// Export the full Idea Library (adventures) to JSON for the printable Idea Book PDF.
// Usage: node scripts/export_idea_library.mjs > /tmp/idea_library.json
import mysql from "mysql2/promise";
const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }
const c = await mysql.createConnection(url + (url.includes("?") ? "&" : "?") + 'ssl={"rejectUnauthorized":false}');
const [rows] = await c.query(
  `SELECT id, title, emoji, kind, category, description, instructions,
          setting, energyLevel, minDurationMin, maxDurationMin, materials,
          wishlistStatus, isFavorite
   FROM adventures
   ORDER BY isFavorite DESC, id DESC, title ASC`,
);
process.stdout.write(JSON.stringify(rows, null, 2));
await c.end();
