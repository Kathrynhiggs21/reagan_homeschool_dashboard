/**
 * Seed assessmentScreenings from 04_assessment_history.json.
 * Idempotent — clears the table first then re-inserts (small ~14 rows).
 */
import mysql from "mysql2/promise";
import fs from "fs";

const data = JSON.parse(
  fs.readFileSync("/home/ubuntu/reagan_handoff/04_assessment_history.json", "utf8")
);
const s = data.screenings;

const rows = [];
const SOURCE = "RHiggs 2025-26 IEP + 2025 Reevaluation";

for (const r of s.acadience_orf || []) {
  if (r.wcpm != null) {
    rows.push(["acadience_orf", "wcpm", r.window, String(r.wcpm), s.acadience_orf_targets?.wcpm_range?.join("-"), null, SOURCE]);
  }
  if (r.wcpm_range) {
    rows.push(["acadience_orf", "wcpm", r.window, r.wcpm_range.join("-"), s.acadience_orf_targets?.wcpm_range?.join("-"), null, SOURCE]);
  }
  if (r.percentile != null) {
    rows.push(["acadience_orf", "percentile", r.window, String(r.percentile), null, null, SOURCE]);
  }
  if (r.accuracy_pct != null) {
    rows.push(["acadience_orf", "accuracy_pct", r.window, String(r.accuracy_pct), s.acadience_orf_targets?.accuracy_pct_range?.join("-"), null, SOURCE]);
  }
  if (r.accuracy_range_pct) {
    rows.push(["acadience_orf", "accuracy_pct", r.window, r.accuracy_range_pct.join("-"), s.acadience_orf_targets?.accuracy_pct_range?.join("-"), null, SOURCE]);
  }
}
for (const r of s.maze_comprehension || []) {
  rows.push(["maze", "raw", r.window, String(r.raw), null, null, SOURCE]);
  rows.push(["maze", "percentile", r.window, String(r.percentile), s.maze_targets?.percentile_range?.join("-"), null, SOURCE]);
}
for (const r of s.nwea_map_math || []) {
  rows.push(["nwea_map_math", "rit", r.window, String(r.rit), `floor ${s.nwea_map_math_targets?.percentile_floor}th pct (RIT ${s.nwea_map_math_targets?.iep_exit_rit_floor}+)`, null, SOURCE]);
  rows.push(["nwea_map_math", "percentile", r.window, String(r.percentile), `${s.nwea_map_math_targets?.percentile_floor}+`, null, SOURCE]);
}
for (const r of s.decoding_consonant_le || []) {
  rows.push(["decoding", "accuracy_pct", r.window, String(r.accuracy_pct), `${r.target_pct}+`, "consonant + -le", SOURCE]);
}
for (const r of s.decoding_other_patterns || []) {
  rows.push(["decoding", "accuracy_pct", "Spring 2025 probe", r.accuracy_pct_range.join("-"), null, r.pattern, SOURCE]);
}
if (s.writing_capitalization_punctuation?.accuracy_pct != null) {
  rows.push(["writing", "accuracy_pct", "2025-01", String(s.writing_capitalization_punctuation.accuracy_pct), null, "capitalization + punctuation", SOURCE]);
}

const conn = await mysql.createConnection({
  uri: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await conn.query("DELETE FROM assessmentScreenings");
for (const r of rows) {
  await conn.query(
    "INSERT INTO assessmentScreenings (testFamily, metric, windowLabel, value, targetValue, notes, sourceDoc) VALUES (?, ?, ?, ?, ?, ?, ?)",
    r
  );
}
console.log(`Inserted ${rows.length} screening rows.`);
await conn.end();
