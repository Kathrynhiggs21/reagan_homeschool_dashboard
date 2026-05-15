/**
 * Wave-15 / Push 261 — kiwiSessionStateMigrator
 *
 * Forward-compat migrator. The Push 259 serializer only round-
 * trips schemaVersion === 1 — anything else gets discarded
 * (fresh empty state). That's the right default for safety, but
 * there's a real upgrade path we can recover:
 *
 *   schemaVersion 0 (pre-envelope): the chat UI used to store
 *     the raw KiwiChatSessionState directly (no schemaVersion
 *     wrapper). If we encounter such a blob, migrate it forward
 *     to v1 instead of dropping it.
 *
 * Pure: no I/O, no clock. Never throws.
 */

import {
  makeKiwiChatSessionState,
  type KiwiChatSessionState,
} from "./kiwiChatSessionState";
import {
  KIWI_SESSION_SCHEMA_VERSION,
  exportKiwiSessionState,
  importKiwiSessionState,
} from "./kiwiSessionExportSerializer";

export interface KiwiSessionMigrationResult {
  state: KiwiChatSessionState;
  migrationPath: "fresh" | "current" | "v0_to_v1" | "discarded";
}

function looksLikeV0Bare(parsed: unknown): boolean {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
  const p = parsed as Record<string, unknown>;
  if ("schemaVersion" in p) return false; // envelope detected
  // Bare v0 shape: has at least one of streak / rotation keys.
  return "streak" in p || "rotation" in p;
}

function sanitizeBareV0(parsed: unknown): KiwiChatSessionState {
  if (!parsed || typeof parsed !== "object") return makeKiwiChatSessionState();
  const p = parsed as Partial<KiwiChatSessionState>;
  const streakSrc =
    p.streak && typeof p.streak === "object"
      ? (p.streak as Partial<KiwiChatSessionState["streak"]>)
      : {};
  const rotationSrc =
    p.rotation && typeof p.rotation === "object"
      ? (p.rotation as Partial<KiwiChatSessionState["rotation"]>)
      : {};
  function safeRec(v: unknown): Record<string, number> {
    const out: Record<string, number> = {};
    if (!v || typeof v !== "object" || Array.isArray(v)) return out;
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (typeof val === "number" && Number.isFinite(val) && val >= 0) {
        out[k] = Math.floor(val);
      }
    }
    return out;
  }
  return {
    streak: {
      streakByPanel: safeRec(streakSrc.streakByPanel),
      lastEventAtUtcMs: safeRec(streakSrc.lastEventAtUtcMs),
    },
    rotation: {
      counterByPanel: safeRec(rotationSrc.counterByPanel),
    },
  };
}

export function migrateKiwiSessionRaw(
  raw: string | null | undefined,
): KiwiSessionMigrationResult {
  if (typeof raw !== "string" || raw.length === 0) {
    return { state: makeKiwiChatSessionState(), migrationPath: "fresh" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { state: makeKiwiChatSessionState(), migrationPath: "discarded" };
  }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const env = parsed as { schemaVersion?: unknown };
    if (env.schemaVersion === KIWI_SESSION_SCHEMA_VERSION) {
      return { state: importKiwiSessionState(raw), migrationPath: "current" };
    }
    if (
      typeof env.schemaVersion === "number" &&
      env.schemaVersion !== KIWI_SESSION_SCHEMA_VERSION
    ) {
      // Known-bad version — drop. (Future migrations slot in here.)
      return { state: makeKiwiChatSessionState(), migrationPath: "discarded" };
    }
    if (looksLikeV0Bare(parsed)) {
      return {
        state: sanitizeBareV0(parsed),
        migrationPath: "v0_to_v1",
      };
    }
  }
  return { state: makeKiwiChatSessionState(), migrationPath: "discarded" };
}

/**
 * Convenience: migrate, then re-encode as current schemaVersion
 * so the caller can write the upgraded envelope back to
 * localStorage in the same step.
 */
export function migrateKiwiSessionAndReExport(
  raw: string | null | undefined,
): {
  state: KiwiChatSessionState;
  migrationPath: KiwiSessionMigrationResult["migrationPath"];
  reExported: string;
} {
  const r = migrateKiwiSessionRaw(raw);
  return {
    state: r.state,
    migrationPath: r.migrationPath,
    reExported: exportKiwiSessionState(r.state),
  };
}
