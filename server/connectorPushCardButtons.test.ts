/**
 * connectorPushCardButtons.test.ts (v3.30, 2026-06-02)
 *
 * Source-contract test for the two affordances added to ConnectorPushCard:
 *
 *   - `connector-run-now`     — the prominent "Run drainer now" button,
 *                               rendered only when pendingCount > 0.
 *   - `connector-refresh-status` — re-pulls queue depth + last-run summary
 *                               without a full page reload.
 *
 * We assert against the source so the test stays fast and deterministic
 * (no jsdom render, no tRPC harness). The deeper behavior of the underlying
 * mint-token + copy flow is exercised by the existing connector tests.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const CARD_PATH = join(
  __dirname,
  "..",
  "client",
  "src",
  "components",
  "ConnectorPushCard.tsx",
);
const src = readFileSync(CARD_PATH, "utf8");

describe("ConnectorPushCard — run-now + refresh affordances (v3.30)", () => {
  it("ships a Run drainer now button keyed by connector-run-now", () => {
    expect(src).toContain('data-testid="connector-run-now"');
    expect(src).toContain("Run drainer now");
  });

  it("gates the run-now banner on a non-empty queue (pendingCount > 0)", () => {
    // The banner block must be conditionally rendered behind pendingCount.
    expect(src).toMatch(/pendingCount\s*>\s*0\s*\?/);
    expect(src).toContain('data-testid="connector-run-now-banner"');
  });

  it("wires the run-now button to the existing mint+copy flow", () => {
    // Both the banner button and the secondary copy button call onCopyCommand.
    const occurrences = src.match(/onCopyCommand\(\)/g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
  });

  it("ships a Refresh status button keyed by connector-refresh-status", () => {
    expect(src).toContain('data-testid="connector-refresh-status"');
    expect(src).toContain("Refresh status");
  });

  it("the refresh button re-fetches pending, last-run, and recent queries", () => {
    // We don't assert exact identifiers beyond the refetch calls, but the
    // handler must trigger all three so the surface reflects a fresh drain.
    expect(src).toMatch(/pendingQ\?\.refetch\?\.\(\)/);
    expect(src).toMatch(/lastRunQ\?\.refetch\?\.\(\)/);
    expect(src).toMatch(/recentQ\?\.refetch\?\.\(\)/);
  });

  it("keeps the sandbox-only badge so expectations stay honest", () => {
    expect(src).toContain("sandbox-only");
  });
});
