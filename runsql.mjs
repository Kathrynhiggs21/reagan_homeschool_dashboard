// Tiny ad-hoc runner: node runsql.mjs "SQL HERE"
const sql = process.argv[2];
if (!sql) { console.error("Usage: node runsql.mjs <SQL>"); process.exit(2); }
const body = JSON.stringify({ "0": { json: { token: process.env.BUILT_IN_FORGE_API_KEY, sql } } });
const r = await fetch("http://localhost:3000/api/trpc/admin.runSql?batch=1", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body,
});
const text = await r.text();
console.log(text);
