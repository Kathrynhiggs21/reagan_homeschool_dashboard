import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Push 47 (2026-05-13) — Nightly analytics CSV cron contract.
 *
 * We don't spin a full Express test harness here. Instead we lock the
 * surface at the source level so a future refactor cannot silently
 * delete the route, weaken its auth gate, or detach it from the
 * `enqueueDailyAnalyticsExport` helper that does the actual CSV+Drive
 * work. The Heartbeat schedule itself is created via the
 * `manus-heartbeat` CLI and listed via `manus-heartbeat list` (covered
 * by manual verification in PR notes).
 */
describe("nightly-analytics-csv route contract", () => {
  const src = readFileSync(
    resolve(__dirname, "scheduledSync.ts"),
    "utf8",
  );

  it("registers POST /api/scheduled/nightly-analytics-csv", () => {
    expect(src).toMatch(
      /app\.post\(\s*"\/api\/scheduled\/nightly-analytics-csv"/,
    );
  });

  it("auth-gates the route to role === 'user' || 'admin'", () => {
    const idx = src.indexOf("/api/scheduled/nightly-analytics-csv");
    expect(idx).toBeGreaterThan(0);
    const slice = src.slice(idx, idx + 2000);
    expect(slice).toMatch(/sdk\.authenticateRequest\(req\)/);
    expect(slice).toMatch(/role\s*!==\s*"user"\s*&&\s*role\s*!==\s*"admin"/);
    expect(slice).toMatch(/Unauthorized/);
  });

  it("delegates to db.enqueueDailyAnalyticsExport with a normalized dateISO", () => {
    const idx = src.indexOf("/api/scheduled/nightly-analytics-csv");
    const slice = src.slice(idx, idx + 2000);
    expect(slice).toMatch(/enqueueDailyAnalyticsExport\?\.\(\s*dateISO\s*\)/);
    expect(slice).toMatch(/nowETDateISO\(\)/);
  });

  it("returns ok=true|false JSON with the dateISO echoed back", () => {
    const idx = src.indexOf("/api/scheduled/nightly-analytics-csv");
    const slice = src.slice(idx, idx + 2000);
    expect(slice).toMatch(/res\.json\(\{\s*ok:\s*result\.ok\s*===\s*true,\s*dateISO/);
  });
});
