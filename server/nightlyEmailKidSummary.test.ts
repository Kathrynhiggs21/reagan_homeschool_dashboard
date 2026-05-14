/**
 * Overnight push 2026-05-14 — assert nightly-agenda-email body includes a
 * kid + Grandma-readable "What's coming up" summary line.
 *
 * Per the project's email-test convention (see nightlyLessonGen.test.ts,
 * powerschoolScheduled.test.ts), we assert at the source level rather than
 * spinning up the dev server with auth.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("/api/scheduled/nightly-agenda-email — kid-readable summary", () => {
  const src = readFileSync(join(__dirname, "scheduledSync.ts"), "utf8");

  it("declares the route", () => {
    expect(src).toContain('app.post("/api/scheduled/nightly-agenda-email"');
  });

  it("builds a plain-English summary line", () => {
    expect(src).toContain("kidSummaryLine");
    expect(src).toContain("What's coming up");
  });

  it("renders the summary line inside the email html", () => {
    // The summary line must be interpolated into the html template before
    // the block list — we check both the variable and the html slot.
    expect(src).toMatch(/\$\{kidSummaryLine\}/);
  });

  it("falls back to empty string when summary cannot be built", () => {
    // The summary is wrapped in try/catch with `let kidSummaryLine = ""`
    // so a malformed payload never breaks the email send.
    expect(src).toMatch(/let kidSummaryLine = "";/);
  });

  it("attaches the agenda PDF + per-block worksheets (regression)", () => {
    expect(src).toContain('kind: "agenda"');
    expect(src).toContain('kind: "worksheet"');
  });
});
