import "dotenv/config";
import mysql from "mysql2/promise";
const conn = await mysql.createConnection(process.env.DATABASE_URL);

await conn.execute(
  `INSERT IGNORE INTO badges (slug, name, emoji, description, criteria) VALUES (?,?,?,?,?)`,
  ["tracker","Tracker","🔍","Real Colter Shaw energy. Three outdoor observation/tracking adventures.", JSON.stringify({adventureCount: 3, category: "tracker"})]
);

const trackerAdventures = [
  ["Snow & Mud Tracker","Find and identify animal tracks in snow or mud. Photograph, measure, and identify whose they are.",30,45,"outdoor",["tracker","outdoor","animals"]],
  ["Bird Call ID Challenge","Identify 5 birds by their call alone — no peeking. Use Merlin Bird ID afterward to check.",20,30,"outdoor",["tracker","birds","outdoor"]],
  ["Creek Source Mission","Pick a creek and trace it from one bend to its source. Map it as you go.",45,90,"outdoor",["tracker","creek","outdoor","hike"]],
  ["Lost Item Detective","Someone hides an item, leaves three clues. You find it using only the clues. (Reverse: you hide, they seek.)",20,30,"indoor",["tracker","reasoning"]],
  ["Wildlife Stakeout","Pick a spot, sit quiet, log every animal that visits over a sit-spot. No phone except for notes.",30,45,"outdoor",["tracker","outdoor","animals","wonder"]],
];

for (const [title, description, minD, maxD, setting, tags] of trackerAdventures) {
  await conn.execute(
    `INSERT IGNORE INTO adventures (title, description, minDurationMin, maxDurationMin, setting, energyLevel, interestTags) VALUES (?,?,?,?,?,?,?)`,
    [title, description, minD, maxD, setting, "medium", JSON.stringify(tags)]
  );
}

const upcoming = [
  ["2026-05-09","World Migratory Bird Day","animal","Birds we love are travelers. Today we honor their journeys.","Try a backyard count or visit a bird-friendly spot."],
  ["2026-05-04","Eta Aquariid Meteor Shower Peak","astronomy","Tiny pieces of Halley's Comet streak through the sky tonight.","Watch from the yard after dark, look toward the east."],
  ["2026-05-23","World Turtle Day","animal","Slow, steady, ancient — turtles get their day.","Visit the creek to look for turtles, or learn about a local rescue."],
  ["2026-06-08","World Oceans Day","nature","Even though we're inland, our creeks all flow to the ocean.","Pick up trash on a hike or do a water quality check at a creek."],
  ["2026-06-21","Summer Solstice","spiritual","The longest day of the year. The light reaches its peak.","Sit outside at sunset. Notice the long, slow light."],
];

for (const [date, name, category, description, suggestedActivity] of upcoming) {
  await conn.execute(
    `INSERT IGNORE INTO specialDays (date, name, category, description, suggestedActivity, interestTags) VALUES (?,?,?,?,?,?)`,
    [date, name, category, description, suggestedActivity, JSON.stringify(["animals","outdoor","wonder"])]
  );
}

console.log("✓ Seeded Tracker badge + 5 Tracker adventures + 5 upcoming special days");
await conn.end();
