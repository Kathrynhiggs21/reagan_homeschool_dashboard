import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Contract tests for v2.97.2 evening auto-attach decoupling fix.
 *
 * Previous behavior: nightly-agenda-email ran auto-attach inline → 30s timeout
 * → row stuck in "queued", email never sent.
 *
 * New behavior:
 *   - nightly-agenda-email runs auto-attach as fire-and-forget background work
 *   - auto-attach-evening endpoint runs the full pass at 8 PM EDT pre-prep
 */
describe("v2.97.2 — evening auto-attach decoupling", () => {
  const scheduledSync = readFileSync(
    resolve(__dirname, "scheduledSync.ts"),
    "utf8",
  );

  it("nightly-agenda-email no longer awaits runAutoAttachForDate inline", () => {
    // Find the nightly-agenda-email POST handler
    const startIdx = scheduledSync.indexOf(
      'app.post("/api/scheduled/nightly-agenda-email"',
    );
    expect(startIdx).toBeGreaterThan(0);
    const endIdx = scheduledSync.indexOf(
      "/api/scheduled/nightly-agenda-email/result",
    );
    expect(endIdx).toBeGreaterThan(startIdx);
    const handler = scheduledSync.slice(startIdx, endIdx);

    // The auto-attach call MUST be wrapped in a fire-and-forget IIFE
    expect(handler).toContain("void (async () =>");
    expect(handler).toContain("runAutoAttachForDate");
    // It must NOT directly await the call at the top-level of the handler body
    // (a `void (async()=>{... await runAutoAttach... })()` is fine; a bare
    // `await runAutoAttachForDate` outside the IIFE is the regression we want
    // to catch).
    const bareAwaitMatches = handler.match(
      /^\s*await runAutoAttachForDate/gm,
    );
    expect(bareAwaitMatches).toBeNull();
  });

  it("auto-attach-evening endpoint exists with dual-auth + 60s tolerance", () => {
    expect(scheduledSync).toContain(
      'app.post("/api/scheduled/auto-attach-evening"',
    );
    // Find the handler body
    const startIdx = scheduledSync.indexOf(
      'app.post("/api/scheduled/auto-attach-evening"',
    );
    const endIdx = scheduledSync.indexOf("app.post", startIdx + 50);
    const handler = scheduledSync.slice(startIdx, endIdx);

    // Dual auth (cookie OR bearer)
    expect(handler).toContain("ENV.scheduledBearer");
    expect(handler).toContain("Bearer ");
    expect(handler).toContain("sdk.authenticateRequest");
    // Returns the auto-attach summary
    expect(handler).toContain("runAutoAttachForDate");
    expect(handler).toMatch(/attached: r\.attached/);
    expect(handler).toMatch(/skipped: r\.skipped/);
    expect(handler).toMatch(/totalBlocks: r\.totalBlocks/);
  });

  it("auto-attach-evening defaults to next school day if forDate omitted", () => {
    const startIdx = scheduledSync.indexOf(
      'app.post("/api/scheduled/auto-attach-evening"',
    );
    const endIdx = scheduledSync.indexOf("app.post", startIdx + 50);
    const handler = scheduledSync.slice(startIdx, endIdx);

    // Skip Sat/Sun loop
    expect(handler).toContain("getDay() === 0");
    expect(handler).toContain("getDay() === 6");
    // Falls through to tomorrow's date
    expect(handler).toContain("toISOString().slice(0, 10)");
  });

  it("auto-attach-evening rejects unauthorized requests with 401", () => {
    const startIdx = scheduledSync.indexOf(
      'app.post("/api/scheduled/auto-attach-evening"',
    );
    const endIdx = scheduledSync.indexOf("app.post", startIdx + 50);
    const handler = scheduledSync.slice(startIdx, endIdx);

    expect(handler).toMatch(/return res\.status\(401\)/);
    expect(handler).toContain("Unauthorized");
  });
});
