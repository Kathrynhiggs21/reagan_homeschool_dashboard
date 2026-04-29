import mysql from "mysql2/promise";

const url = new URL(process.env.DATABASE_URL);
const conn = await mysql.createConnection({
  host: url.hostname, port: parseInt(url.port || "4000"),
  user: url.username, password: decodeURIComponent(url.password),
  database: url.pathname.slice(1), ssl: { rejectUnauthorized: false },
});

const games = [
  { title: "Roblox",              kind: "app",     url: null, emoji: "🟥", preferredMinutes: 15, rank: 1, notes: "Pick one game and stick with it for the break." },
  { title: "Minecraft",           kind: "app",     url: null, emoji: "⛏",  preferredMinutes: 15, rank: 2, notes: "Creative mode is fine for a break — Survival can be a longer reward." },
  { title: "Toca Boca",           kind: "app",     url: null, emoji: "🎈", preferredMinutes: 10, rank: 3, notes: null },
  { title: "Drawing / sketch",    kind: "offline", url: null, emoji: "🎨", preferredMinutes: 10, rank: 4, notes: "Notebook + colored pencils." },
  { title: "Read a chapter book", kind: "offline", url: null, emoji: "📖", preferredMinutes: 10, rank: 5, notes: null },
];

for (const g of games) {
  const [exists] = await conn.query("SELECT id FROM gamePrefs WHERE title=?", [g.title]);
  if (exists.length === 0) {
    await conn.query(
      "INSERT INTO gamePrefs (title, kind, url, emoji, preferredMinutes, `rank`, notes) VALUES (?,?,?,?,?,?,?)",
      [g.title, g.kind, g.url, g.emoji, g.preferredMinutes, g.rank, g.notes]
    );
    console.log("+", g.title);
  } else {
    console.log("=", g.title, "(exists)");
  }
}

await conn.end();
process.exit(0);
