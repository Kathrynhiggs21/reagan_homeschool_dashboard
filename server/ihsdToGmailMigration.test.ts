import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Push 56 (2026-05-13) — ihsd.us → gmail.com migration.
 *
 * Reagan's @ihsd.us account is permanently dead. The dashboard already blocks
 * any inbound mail/login for it (push 12 added `blockedEmails`). What was still
 * leaking through:
 *   - Analytics rendered the "Indian Hill PowerSchool" card with stale data.
 *   - `usePracticePrefs` defaulted `ihIxl: true` so every IXL link bounced
 *     through the dead school SSO before falling back to public IXL.
 *
 * This push:
 *   - Removes the PowerSchoolGradesCard mount from Analytics (component file
 *     stays for any future Madeira re-use, but does not render).
 *   - Flips the IXL-via-IH-SSO default OFF and bumps the localStorage key so
 *     stale browser cached values reset cleanly.
 */
describe("Push 56 — ihsd.us → gmail.com migration", () => {
  const root = join(__dirname, "..", "client", "src");

  it("Analytics no longer mounts the PowerSchool grades card", () => {
    const src = readFileSync(join(root, "pages", "Analytics.tsx"), "utf8");
    expect(src).not.toMatch(/^\s*<PowerSchoolGradesCard \/>/m);
    // The import line should also be commented out, not active.
    const importMatch = src.match(/^import PowerSchoolGradesCard/m);
    expect(importMatch).toBeNull();
    // The push-56 comment must explain why the card was removed.
    expect(src).toContain("Push 56");
  });

  it("usePracticePrefs defaults ihIxl OFF and bumped the storage key", () => {
    const src = readFileSync(join(root, "hooks", "usePracticePrefs.ts"), "utf8");
    expect(src).toMatch(/ihIxl:\s*false/);
    expect(src).toContain("reagan.practicePrefs.v2");
    // Sanity — the old default must NOT come back.
    expect(src).not.toMatch(/ihIxl:\s*true,\s*khanKids:\s*false/);
  });

  it("seeded blockedEmails row for the dead @ihsd.us account is preserved", () => {
    const sql = readFileSync(
      join(__dirname, "..", "drizzle", "0056_year_plan_owned_books.sql"),
      "utf8",
    );
    expect(sql).toContain("reagan.higgs33@ihsd.us");
    expect(sql).toContain("INSERT IGNORE INTO `blockedEmails`");
  });

  it("classroom.studentDomain app_setting points at gmail.com, not ihsd.us", () => {
    const dbSrc = readFileSync(
      join(__dirname, "..", "server", "db.ts"),
      "utf8",
    );
    expect(dbSrc).toContain('"classroom.studentDomain": "gmail.com"');
    expect(dbSrc).not.toMatch(/"classroom\.studentDomain":\s*"ihsd\.us"/);
  });
});
