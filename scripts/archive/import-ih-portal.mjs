import fs from "node:fs";
import mysql from "mysql2/promise";

const CSV = "/home/ubuntu/upload/IHportal_student_lo_res.csv";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("no DATABASE_URL"); process.exit(1); }
const u = new URL(DATABASE_URL);
const conn = await mysql.createConnection({
  host: u.hostname, port: Number(u.port || 3306),
  user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
  database: u.pathname.replace(/^\//, ""),
  ssl: { rejectUnauthorized: false },
});

const EMOJI = {
  "ALEKS":"🧮","Aimswebplus":"📊","Alex-PS":"📖","Alex-ES":"📖","Alex-MS":"📖","Alex-HS":"📖",
  "Amplfiy":"📚","Brainpop":"🎬","Brainpop Non Rostered":"🎬","Brainpop Jr.":"🎬",
  "Canvas":"🎨","Code.org":"💻","Dreambox SSO":"🌙","EPIC":"📖","Espark":"⚡","Final Forms":"📝",
  "Frax":"🍕","Freckle":"🦉","Gizmos":"🔬","Infercabulary":"🗣️","InfOhio":"🔎","IXL":"🎯",
  "JASON Learning":"🌊","Kids A-Z":"🅰️","Microsoft Portal":"🪟","Naviance":"🧭","Pearson TestNav":"📋",
  "PebbleGo":"🪨","Performance Matters":"📈","Printers":"🖨️","Reflex Math":"➕","Scholastic Storia":"📚",
  "Science for Us":"🔬","Star 360":"⭐","Starfall":"🌟","ThinkCentral":"🧠","Vivi":"📽️",
  "Vocabulary.com":"🔤","X2Vol":"🤝","Zearn":"➗","Adobe Apps":"🎨","Adobe Spark":"✨",
};

const CATEGORY = (name) => {
  const s = name.toLowerCase();
  if (/math|frax|zearn|reflex|aleks|dreambox|freckle/.test(s)) return "learning";
  if (/brainpop|epic|storia|pebble|kids a-z|starfall|amplfiy|storia|vocab|readworks/.test(s)) return "reading";
  if (/canvas|aimsweb|star 360|performance|pearson|testnav|final forms|naviance|infohio|printers|x2vol|microsoft|adobe spark/.test(s)) return "school";
  if (/science|gizmos|jason|code\.org/.test(s)) return "learning";
  if (/adobe|vivi/.test(s)) return "creativity";
  return "learning";
};

const skipExact = new Set(["Gmail","Google Calendar","Google Classroom","Google Drive","Google Sites","Printers"]);

const raw = fs.readFileSync(CSV, "utf8");
const rows = raw.split(/\r?\n/).map(l => l.split(",")).filter(c => c[0] && c[1] && !skipExact.has(c[0]));

const [existing] = await conn.query("SELECT name FROM appLinks");
const existingNames = new Set(existing.map(r => r.name.toLowerCase()));

function shortenUrl(raw) {
  if (raw.length <= 480) return raw;
  try { const u2 = new URL(raw); const short = u2.origin + u2.pathname; return short.length <= 480 ? short : short.slice(0, 480); } catch { return raw.slice(0, 480); }
}
let added = 0;
for (const [name, rawUrl] of rows) {
  const url = shortenUrl(rawUrl.trim());
  if (existingNames.has(name.toLowerCase())) continue;
  const emoji = EMOJI[name] || "🔗";
  const category = CATEGORY(name);
  const accountInfo = url.includes("clever.com/oauth") ? "Auto-signs in via Clever (use school Google acct)"
                    : url.includes("saml") ? "Single sign-on (use school Google acct)"
                    : "";
  await conn.execute(
    "INSERT INTO appLinks (name, url, category, emoji, description, accountInfo, sortOrder) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [name, url, category, emoji, "From IH student portal", accountInfo, 200 + added]
  );
  added++;
}
console.log(`added ${added} IH-portal app links (skipped ${rows.length - added} already-present or excluded)`);
await conn.end();
