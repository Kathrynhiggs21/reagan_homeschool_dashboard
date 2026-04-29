/**
 * Seed Reagan's profile from the handoff bundle (01 + 02 + 04 + 12).
 * Idempotent: only updates fields, never deletes existing values
 * unless explicitly nulled.
 *
 * Adds Precious the bearded dragon to pets (Brutus was already removed).
 */
import mysql from "mysql2/promise";
import fs from "fs";

const BASE = "/home/ubuntu/reagan_handoff";
const profile = JSON.parse(fs.readFileSync(`${BASE}/01_reagan_profile.json`, "utf8"));
const contactsBundle = JSON.parse(fs.readFileSync(`${BASE}/02_contacts.json`, "utf8"));

const conn = await mysql.createConnection({
  uri: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ---- pets: bundle pets + Precious (Brutus removed) ----
const pets = [
  ...(profile.pets || []),
  { name: "Precious", species: "Bearded Dragon", role: "Reagan's bearded dragon (confirmed by Mom April 2026)" },
];

// ---- care team contacts (preserve old fields like phone/email if present) ----
const careTeam = [
  ...(contactsBundle.emergency || []).map((c) => ({
    name: c.name,
    role: c.role || c.label || "Emergency contact",
    phone: c.phone,
    email: c.email,
  })),
  ...(contactsBundle.education_team || []).map((c) => ({
    name: c.name,
    role: c.role,
  })),
  ...(contactsBundle.clinical_team || []).map((c) => ({
    name: c.name,
    role: `${c.role}${c.facility ? ` \u00b7 ${c.facility}` : ""}`,
  })),
];

const fields = {
  studentName: "Reagan",
  birthday: profile.demographics?.birthday || null,
  pronouns: profile.demographics?.pronouns || null,
  selfStatement: profile.identity?.self_statement || null,
  selfAdvocacyStatement: profile.identity?.self_advocacy_statement || null,
  schoolHistory: JSON.stringify(profile.school_history || []),
  family: JSON.stringify(profile.family || {}),
  pets: JSON.stringify(pets),
  sensoryLoves: JSON.stringify(profile.sensory?.loves || []),
  sensoryAvoids: JSON.stringify(profile.sensory?.avoids || []),
  favoriteFoods: JSON.stringify(profile.favorite_foods || []),
  favoriteShows: JSON.stringify(profile.favorite_shows_and_videos || []),
  favoriteBooks: JSON.stringify(profile.favorite_books || []),
  diagnoses: JSON.stringify(profile.diagnoses || []),
  currentSupports: JSON.stringify(profile.current_supports || []),
  whatWorks: JSON.stringify(profile.what_helps_me || []),
  whatHarms: JSON.stringify(profile.what_doesnt_help || []),
  interests: JSON.stringify(profile.interests_pills || []),
  contacts: JSON.stringify(careTeam),
};

const [existing] = await conn.query("SELECT id FROM learnerProfile LIMIT 1");
if (Array.isArray(existing) && existing.length > 0) {
  const setClause = Object.keys(fields)
    .map((k) => `\`${k}\` = ?`)
    .join(", ");
  const values = Object.values(fields);
  values.push(existing[0].id);
  await conn.query(`UPDATE learnerProfile SET ${setClause} WHERE id = ?`, values);
  console.log(`UPDATE learnerProfile id=${existing[0].id} \u2014 ${Object.keys(fields).length} fields set`);
} else {
  const cols = Object.keys(fields);
  await conn.query(
    `INSERT INTO learnerProfile (${cols.map((c) => `\`${c}\``).join(",")}) VALUES (${cols.map(() => "?").join(",")})`,
    Object.values(fields)
  );
  console.log(`INSERT learnerProfile (new) \u2014 ${cols.length} fields`);
}

// Sanity print
const [check] = await conn.query("SELECT studentName, birthday, JSON_LENGTH(pets) AS petCount, JSON_LENGTH(contacts) AS contactCount, JSON_LENGTH(schoolHistory) AS schoolCount FROM learnerProfile LIMIT 1");
console.log("Result:", check[0]);

await conn.end();
console.log("Profile seed complete");
