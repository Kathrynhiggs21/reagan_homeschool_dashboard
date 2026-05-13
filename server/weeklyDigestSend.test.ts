import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Push 49 (2026-05-13) — Weekly digest send endpoint contract.
 *
 * Source-level guards so the cron, auth, and notification wiring
 * survive future refactors. Heartbeat cron creation itself is
 * verified via `manus-heartbeat list` (task_uid in PR notes).
 */
describe("weekly-digest-send route contract", () => {
  const src = readFileSync(
    resolve(__dirname, "scheduledSync.ts"),
    "utf8",
  );

  it("registers POST /api/scheduled/weekly-digest-send", () => {
    expect(src).toMatch(
      /app\.post\(\s*"\/api\/scheduled\/weekly-digest-send"/,
    );
  });

  it("auth-gates the route to role === 'user' || 'admin'", () => {
    const idx = src.indexOf("/api/scheduled/weekly-digest-send");
    expect(idx).toBeGreaterThan(0);
    const slice = src.slice(idx, idx + 3500);
    expect(slice).toMatch(/sdk\.authenticateRequest\(req\)/);
    expect(slice).toMatch(/role\s*!==\s*"user"\s*&&\s*role\s*!==\s*"admin"/);
  });

  it("delegates to db.buildWeeklyDigestPayload + db.saveWeeklyDigest + db.listRecipients", () => {
    const idx = src.indexOf("/api/scheduled/weekly-digest-send");
    const slice = src.slice(idx, idx + 3500);
    expect(slice).toMatch(/buildWeeklyDigestPayload/);
    expect(slice).toMatch(/saveWeeklyDigest/);
    expect(slice).toMatch(/listRecipients/);
  });

  it("dispatches to notifyOwner with a markdown content block and marks the digest sent on success", () => {
    const idx = src.indexOf("/api/scheduled/weekly-digest-send");
    const slice = src.slice(idx, idx + 3500);
    expect(slice).toMatch(/notifyOwner/);
    expect(slice).toMatch(/Reagan\s*—\s*Weekly digest/);
    expect(slice).toMatch(/markDigestEmailed.*"sent"/s);
  });

  it("returns JSON shape { ok, digestId, notifyOk, recipientCount, contentBytes }", () => {
    // The first textual occurrence is in a comment; pin to the handler
    // by searching for `app.post("/api/scheduled/weekly-digest-send"`
    // explicitly.
    const idx = src.indexOf('app.post("/api/scheduled/weekly-digest-send"');
    expect(idx).toBeGreaterThan(0);
    const slice = src.slice(idx, idx + 4500);
    expect(slice).toMatch(/ok:\s*true,/);
    expect(slice).toMatch(/digestId,/);
    expect(slice).toMatch(/notifyOk,/);
    expect(slice).toMatch(/recipientCount:/);
    expect(slice).toMatch(/contentBytes:/);
  });
});
