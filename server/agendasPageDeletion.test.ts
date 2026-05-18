/**
 * v2.40 (2026-05-18) — Lock the /agendas (Daily Schedule) page deletion
 * (todo line 358).
 *
 * Three invariants:
 *   1. App.tsx has the legacy redirect `<Route path="/agendas">
 *      <Redirect to="/agenda-editor" /></Route>` and ZERO direct page
 *      mounts at that path (so old bookmarks land on the new editor).
 *   2. CozyShell ADULT_NAV array contains zero `/agendas` href.
 *   3. KID_NAV has `/schedule` (different surface, must NOT be confused
 *      with the deleted `/agendas` adult page).
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const CLIENT_DIR = path.resolve(__dirname, "../client/src");
const APP_PATH = path.join(CLIENT_DIR, "App.tsx");
const COZY_SHELL_PATH = path.join(CLIENT_DIR, "components/CozyShell.tsx");

describe("v2.40 — /agendas page deletion + sidebar entry removal", () => {
  it("App.tsx redirects /agendas → /agenda-editor (legacy bookmarks land on the editor)", () => {
    const src = fs.readFileSync(APP_PATH, "utf8");
    expect(src).toMatch(
      /<Route path="\/agendas"><Redirect to="\/agenda-editor" \/><\/Route>/,
    );
  });

  it("App.tsx has NO direct page mount at /agendas (only the redirect)", () => {
    const src = fs.readFileSync(APP_PATH, "utf8");
    // The /agendas route line must mount EXACTLY <Redirect ... />, never a page component.
    const routeLine = src
      .split("\n")
      .find((l) => /<Route\s+path="\/agendas">/.test(l));
    expect(routeLine).toBeTruthy();
    expect(routeLine!).toMatch(/<Redirect to="\/agenda-editor" \/>/);
    // Specifically: no AgendasPage / DailySchedulePage / DailyAgendasPage import.
    expect(src).not.toMatch(/import\s+.*AgendasPage/);
    expect(src).not.toMatch(/import\s+.*DailySchedulePage/);
    expect(src).not.toMatch(/import\s+.*DailyAgendasPage/);
  });

  it("CozyShell ADULT_NAV contains zero /agendas entry", () => {
    const src = fs.readFileSync(COZY_SHELL_PATH, "utf8");
    const adultNavMatch = src.match(
      /const ADULT_NAV: NavItem\[\] = \[([\s\S]*?)\];/,
    );
    expect(adultNavMatch).toBeTruthy();
    const block = adultNavMatch![1];
    expect(block).not.toMatch(/to: ["']\/agendas["']/);
    // Sanity: the four canonical adult entries are present.
    expect(block).toMatch(/to: ["']\/curriculum["']/);
    expect(block).toMatch(/to: ["']\/agenda-editor["']/);
    expect(block).toMatch(/to: ["']\/analytics["']/);
    expect(block).toMatch(/to: ["']\/settings["']/);
  });

  it("CozyShell KID_NAV preserves /schedule (the kid-side calendar) — distinct from the deleted /agendas adult page", () => {
    const src = fs.readFileSync(COZY_SHELL_PATH, "utf8");
    const kidNavMatch = src.match(/const KID_NAV: NavRow\[\] = \[([\s\S]*?)\];/);
    expect(kidNavMatch).toBeTruthy();
    const block = kidNavMatch![1];
    expect(block).toMatch(/to: ["']\/schedule["']/);
    // Kid sidebar must also not regress and add /agendas.
    expect(block).not.toMatch(/to: ["']\/agendas["']/);
  });

  it("no other client file points a sidebar/nav link at /agendas", () => {
    // Walk the client/src tree and look for any href|to="/agendas".
    const walk = (dir: string): string[] => {
      const out: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk(full));
        else if (/\.(tsx|ts)$/.test(entry.name)) out.push(full);
      }
      return out;
    };
    const files = walk(CLIENT_DIR);
    const offenders: { file: string; line: string }[] = [];
    for (const f of files) {
      // Skip App.tsx — its single legacy-redirect line is intentional.
      if (path.basename(f) === "App.tsx") continue;
      const src = fs.readFileSync(f, "utf8");
      for (const line of src.split("\n")) {
        if (
          /(?:href|to)\s*=\s*["']\/agendas["']/.test(line) ||
          /push\(["']\/agendas["']/.test(line) ||
          /navigate\(["']\/agendas["']/.test(line)
        ) {
          offenders.push({ file: path.relative(CLIENT_DIR, f), line: line.trim() });
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
