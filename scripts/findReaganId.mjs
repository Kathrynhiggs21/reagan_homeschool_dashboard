import { getDb } from "../server/db.ts";
import { users } from "../drizzle/schema.ts";
import { eq } from "drizzle-orm";
const db = getDb();
const admins = await db.select().from(users).where(eq(users.role, "admin"));
const tutors = await db.select().from(users).where(eq(users.role, "tutor"));
// dedupe openId
const seen = new Set();
console.log("=== ADMINS (deduped openId) ===");
for (const u of admins) {
  if (seen.has(u.openId)) continue;
  seen.add(u.openId);
  console.log(u.id, "|", u.email, "|", u.name, "|", u.openId);
}
console.log("=== TUTORS (deduped) ===");
seen.clear();
for (const u of tutors) {
  if (seen.has(u.openId)) continue;
  seen.add(u.openId);
  console.log(u.id, "|", u.email, "|", u.name, "|", u.openId);
}
process.exit(0);
