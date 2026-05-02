import mysql from "mysql2/promise";

const c = await mysql.createConnection({
  uri: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
  connectTimeout: 10000,
  multipleStatements: true,
});

// 1. Apply the migration (idempotent: ignore if column exists)
try {
  await c.execute(
    "ALTER TABLE `app_accounts` ADD `preferred_google_account` enum('reagan','dad','none') DEFAULT 'none' NOT NULL",
  );
  console.log("✓ Added preferred_google_account column");
} catch (e) {
  if (e.code === "ER_DUP_FIELDNAME") console.log("(column already exists)");
  else throw e;
}

// 2. Seed defaults — these are the apps Reagan is known to use under her own Google
const REAGAN_APPS = [
  "khan_academy", "khan", "brainpop", "edpuzzle", "seesaw",
  "code_org", "codeorg", "book_creator", "bookcreator",
  "inaturalist", "merlin", "vocab_com", "vocab", "canva", "canva_edu",
  "google_docs", "google_drive", "gmail", "google_classroom",
];
const DAD_APPS = [
  "ixl_parent", "prodigy_parent", "brainpop_parent", "family_link",
  "ixl", "prodigy", // primary subs are paid by Dad, sign-in via Dad's Google
];

for (const key of REAGAN_APPS) {
  const [r] = await c.execute(
    "UPDATE app_accounts SET preferred_google_account = 'reagan' WHERE app_key = ? AND preferred_google_account = 'none'",
    [key],
  );
  if (r.affectedRows) console.log(`  ↳ ${key} → reagan`);
}
for (const key of DAD_APPS) {
  const [r] = await c.execute(
    "UPDATE app_accounts SET preferred_google_account = 'dad' WHERE app_key = ? AND preferred_google_account = 'none'",
    [key],
  );
  if (r.affectedRows) console.log(`  ↳ ${key} → dad`);
}

const [counts] = await c.execute(
  "SELECT preferred_google_account, COUNT(*) AS n FROM app_accounts GROUP BY preferred_google_account",
);
console.log("\nFinal split:");
for (const row of counts) console.log(`  ${row.preferred_google_account}: ${row.n}`);

await c.end();
process.exit(0);
