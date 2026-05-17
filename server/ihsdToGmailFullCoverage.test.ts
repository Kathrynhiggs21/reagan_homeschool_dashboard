/**
 * v2.25 (2026-05-17) — End-to-end IH→gmail migration lock.
 *
 * The migration was completed in earlier pushes (Push 56 + earlier hard-blocks)
 * but the existing `ihsdToGmailMigration.test.ts` only checks the seed file.
 * This test adds a wider net so a future regression — someone copy-pasting an
 * old default back, an undeleted UI string, or a partial revert of the
 * student-email seed — trips a red test.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const DB_TS = path.join(ROOT, "server/db.ts");

function read(p: string) {
  return fs.readFileSync(p, "utf8");
}

/**
 * Strip JS/TS comments before scanning. Keeps strings intact.
 * Handles: //... , /* ... *​/ and JSX-comment {/* ... *​/}.
 */
function stripComments(src: string): string {
  // Remove block comments (non-greedy, multiline)
  let out = src.replace(/\/\*[\s\S]*?\*\//g, "");
  // Remove line comments (after blocks so we don't accidentally chew into code)
  out = out.replace(/(^|[^:])\/\/[^\n\r]*/g, "$1");
  return out;
}

describe("v2.25 — IH→gmail migration is locked end-to-end", () => {
  it("seed defaults in server/db.ts list student.googleEmail as reaganhiggs910@gmail.com", () => {
    const src = read(DB_TS);
    expect(src).toMatch(
      /"student\.googleEmail":\s*"reaganhiggs910@gmail\.com"/,
    );
  });

  it("seed defaults in server/db.ts list classroom.studentDomain as gmail.com (not ihsd.us)", () => {
    const src = read(DB_TS);
    expect(src).toMatch(/"classroom\.studentDomain":\s*"gmail\.com"/);
    // And NOT ihsd.us as a value (substring would catch "@ihsd.us" but
    // we want a true "is the value ihsd.us" check). Look for the exact
    // wrong assignment.
    expect(src).not.toMatch(/"classroom\.studentDomain":\s*"ihsd\.us"/);
  });

  it("seed defaults in server/db.ts list calendar.ownerEmail as reaganhiggs910@gmail.com", () => {
    const src = read(DB_TS);
    expect(src).toMatch(
      /"calendar\.ownerEmail":\s*"reaganhiggs910@gmail\.com"/,
    );
  });

  it("server code (excluding comments) contains NO live @ihsd.us SQL allowlist regex", () => {
    // Walk every server/**/*.ts file. After stripping comments the only
    // legitimate live mentions are the BLOCKED_EMAIL constants for the
    // hard-block layer (which are KEEP-needed; they prevent Reagan being
    // routed to the dead account).
    const serverDir = path.join(ROOT, "server");
    const offenders: string[] = [];
    walk(serverDir, (file) => {
      if (!file.endsWith(".ts")) return;
      const code = stripComments(read(file));
      // Look for an allowlist-style regex: /@ihsd\.us$/i or .endsWith("@ihsd.us")
      // *granted to* an action, not a hard-block constant.
      if (/\/@ihsd\\\.us\$\/i/.test(code)) {
        offenders.push(`${file}: contains /@ihsd\\.us$/i regex`);
      }
    });
    expect(offenders).toEqual([]);
  });

  it("client/src/* contains no LIVE @ihsd.us copy outside of comments", () => {
    const clientDir = path.join(ROOT, "client/src");
    const offenders: string[] = [];
    walk(clientDir, (file) => {
      if (!file.endsWith(".tsx") && !file.endsWith(".ts")) return;
      const code = stripComments(read(file));
      if (/@ihsd\.us/.test(code)) {
        offenders.push(file);
      }
    });
    expect(offenders).toEqual([]);
  });

  it("seed.mjs no longer creates a Google Classroom — Indian Hill app row", () => {
    const seedFile = path.join(ROOT, "seed.mjs");
    if (!fs.existsSync(seedFile)) {
      // seed.mjs may have been retired entirely; that's also a valid end-state.
      return;
    }
    const src = read(seedFile);
    // No active "Google Classroom" insertion line. (Comments allowed.)
    const stripped = stripComments(src);
    expect(stripped).not.toMatch(/Google Classroom — Indian Hill/);
    expect(stripped).not.toMatch(/Google Classroom \(Indian Hill\)/);
  });
});

function walk(dir: string, visit: (file: string) => void) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(p, visit);
    } else {
      visit(p);
    }
  }
}
