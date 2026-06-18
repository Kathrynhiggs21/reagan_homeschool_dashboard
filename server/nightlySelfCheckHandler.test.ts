import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Contract test: the nightly self-check Heartbeat handler must stay wired with
 * the right path, auth gate, repair call, and notify-on-repair-only behavior.
 */
const src = readFileSync(join(__dirname, "scheduledSync.ts"), "utf8");

describe("nightly-self-check handler contract", () => {
  it("registers the /api/scheduled/nightly-self-check route", () => {
    expect(src).toContain('app.post("/api/scheduled/nightly-self-check"');
  });

  it("authenticates the caller and rejects non user|admin", () => {
    const idx = src.indexOf('"/api/scheduled/nightly-self-check"');
    const slice = src.slice(idx, idx + 2000);
    expect(slice).toContain("sdk.authenticateRequest(req)");
    expect(slice).toContain('return res.status(401)');
  });

  it("calls the bounded repairer and only notifies when repairs were made", () => {
    const idx = src.indexOf('"/api/scheduled/nightly-self-check"');
    const slice = src.slice(idx, idx + 2500);
    expect(slice).toContain("runNightlySelfCheck");
    expect(slice).toContain("if (!report.clean && body.dryRun !== true)");
    expect(slice).toContain("notifyOwner");
  });

  it("wraps work in try/catch and JSON-encodes 500 errors", () => {
    const idx = src.indexOf('"/api/scheduled/nightly-self-check"');
    const slice = src.slice(idx, idx + 2500);
    expect(slice).toContain("res.status(500)");
    expect(slice).toContain("error: e?.message");
  });
});
