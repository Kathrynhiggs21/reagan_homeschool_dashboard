/**
 * Wave-15 / Push 265 — kiwiSessionBootBundle
 *
 * Single-call boot path for the chat UI. On chat-page mount the
 * UI reads localStorage and calls this helper once with the raw
 * blob + current UTC ms. The helper:
 *
 *   1. Migrates the raw blob forward to the current schema
 *      version (Push 261)
 *   2. Decays stale per-panel streaks (Push 263)
 *   3. Re-exports the validated, decayed state as a current-
 *      envelope string ready to write back to localStorage
 *
 * Returns the state, the migration path, the panels that were
 * decayed during step 2, and the re-export string. Pure: no I/O,
 * no clock — nowUtcMs is a parameter.
 */

import { migrateKiwiSessionRaw } from "./kiwiSessionStateMigrator";
import { decayKiwiSessionState } from "./kiwiSessionDecay";
import { exportKiwiSessionState } from "./kiwiSessionExportSerializer";
import type { KiwiChatSessionState } from "./kiwiChatSessionState";

export interface KiwiSessionBootResult {
  state: KiwiChatSessionState;
  migrationPath: "fresh" | "current" | "v0_to_v1" | "discarded";
  decayedPanels: string[];
  reExported: string;
}

export function bootKiwiSession(
  raw: string | null | undefined,
  nowUtcMs: number,
): KiwiSessionBootResult {
  const migrated = migrateKiwiSessionRaw(raw);
  const decayed = decayKiwiSessionState(migrated.state, nowUtcMs);
  return {
    state: decayed.state,
    migrationPath: migrated.migrationPath,
    decayedPanels: decayed.decayedPanels,
    reExported: exportKiwiSessionState(decayed.state),
  };
}
