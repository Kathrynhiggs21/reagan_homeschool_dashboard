/**
 * v2.92 (2026-05-27) — Bearer-auth contract for the nightly agenda email
 * pipeline. The deployment edge has been silently 403'ing the cookie-based
 * cron since May 4. This locks in a second auth path: a shared
 * Authorization: Bearer ${SCHEDULED_BEARER} that bypasses the cookie gate.
 *
 * Scope: source-contract tests (string presence in scheduledSync.ts + env.ts),
 * not live HTTP. Live HTTP is exercised manually via curl after this passes.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");
const SCHEDULED = readFileSync(join(ROOT, "server", "scheduledSync.ts"), "utf8");
const ENV = readFileSync(join(ROOT, "server", "_core", "env.ts"), "utf8");

describe("v2.92 bearer-auth contract on /api/scheduled/nightly-agenda-email", () => {
  it("ENV.scheduledBearer is wired from process.env.SCHEDULED_BEARER", () => {
    expect(ENV).toMatch(/scheduledBearer:\s*process\.env\.SCHEDULED_BEARER/);
  });

  it("scheduledSync.ts imports ENV from _core/env", () => {
    expect(SCHEDULED).toMatch(/import\s+\{\s*ENV\s*\}\s+from\s+["']\.\/_core\/env["']/);
  });

  it("nightly-agenda-email POST inspects the Authorization header", () => {
    const idx = SCHEDULED.indexOf('app.post("/api/scheduled/nightly-agenda-email"');
    expect(idx).toBeGreaterThan(-1);
    const window = SCHEDULED.slice(idx, idx + 1500);
    expect(window).toMatch(/req\.headers\[\s*["']authorization["']\s*\]/);
    expect(window).toMatch(/Bearer\s+/);
    expect(window).toMatch(/ENV\.scheduledBearer/);
  });

  it("nightly-agenda-email POST still supports the cookie role path as fallback", () => {
    const idx = SCHEDULED.indexOf('app.post("/api/scheduled/nightly-agenda-email"');
    const window = SCHEDULED.slice(idx, idx + 2000);
    // Both gates must coexist
    expect(window).toMatch(/sdk\.authenticateRequest/);
    expect(window).toMatch(/role\s*===\s*["']user["']/);
    expect(window).toMatch(/role\s*===\s*["']admin["']/);
  });

  it("nightly-agenda-email/result POST also accepts the bearer", () => {
    const idx = SCHEDULED.indexOf('app.post("/api/scheduled/nightly-agenda-email/result"');
    expect(idx).toBeGreaterThan(-1);
    const window = SCHEDULED.slice(idx, idx + 1000);
    expect(window).toMatch(/Bearer\s+/);
    expect(window).toMatch(/ENV\.scheduledBearer/);
  });

  it("rejects requests with neither cookie nor bearer (401 path preserved)", () => {
    const idx = SCHEDULED.indexOf('app.post("/api/scheduled/nightly-agenda-email"');
    const window = SCHEDULED.slice(idx, idx + 2000);
    expect(window).toMatch(/res\.status\(401\)/);
  });
});
