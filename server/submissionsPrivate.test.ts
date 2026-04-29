import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

/**
 * Mom's explicit rule (handoff bundle 11_cleanup_punchlist.md):
 *   "Submissions go to adult analytics dashboard, NOT Google Classroom"
 *
 * This guard scans the entire server tree for any code that pushes Reagan's
 * own submissions OUTBOUND to the Google Classroom API. Inbound parsing
 * (i.e., reading IH assignments labeled source: 'classroom') is allowed and
 * expected.
 */

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === "dist") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else if (full.endsWith(".ts") && !full.endsWith(".test.ts")) yield full;
  }
}

describe("submissions stay private (NOT pushed to Google Classroom)", () => {
  it("no server file calls a classroom write API or pushes submissions outbound", () => {
    const offenders: Array<{ file: string; line: number; text: string }> = [];
    const forbidden = [
      // Google Classroom REST endpoints that WRITE student work back to the school
      /classroom\.googleapis\.com\/.*\/(submissions|studentSubmissions|courseWork)\/.*\/(turnIn|return|reclaim|patch|create)/i,
      /studentSubmissions\.\w*(turnIn|patch|create|return)/i,
      /\bcourses\.[\w.]+\.studentSubmissions\.(turnIn|patch|create|return)\b/,
    ];

    for (const file of walk("server")) {
      const txt = readFileSync(file, "utf8");
      txt.split("\n").forEach((line, i) => {
        for (const re of forbidden) {
          if (re.test(line)) offenders.push({ file, line: i + 1, text: line.trim() });
        }
      });
    }

    if (offenders.length > 0) {
      const summary = offenders.map((o) => `${o.file}:${o.line} → ${o.text}`).join("\n");
      throw new Error(
        "Found code that may push Reagan's submissions OUTBOUND to Google Classroom — Mom forbids this:\n" + summary
      );
    }
    expect(offenders.length).toBe(0);
  });

  it("submissions router exposes a `list` endpoint that the Adult Analytics page reads", async () => {
    // Quick structural check on the routers source so an Analytics-card refactor
    // doesn't accidentally remove the public-facing read path.
    const routersSrc = readFileSync("server/routers.ts", "utf8");
    expect(routersSrc).toMatch(/submissions:\s*router\(/);
    expect(routersSrc).toMatch(/\blist:\s*\w+Procedure/);
  });
});
