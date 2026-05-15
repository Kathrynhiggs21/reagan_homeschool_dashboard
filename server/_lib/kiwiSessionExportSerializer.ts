/**
 * Wave-15 / Push 259 — kiwiSessionExportSerializer
 *
 * Defensive serializer/deserializer for the unified Kiwi chat
 * session state going to/from browser localStorage.
 *
 * Why this exists: localStorage is shared across deploys. A
 * deploy that changes the session-state shape (added panels,
 * renamed fields, dropped fields) must not crash the chat UI on
 * an older serialized blob. The serializer tags every export
 * with a schema version and the deserializer falls back to a
 * fresh empty state on any failure — never throws.
 *
 * Current schema version: 1.
 *   - schemaVersion: number (currently 1)
 *   - state: KiwiChatSessionState
 *
 * Pure: no I/O, no clock. localStorage R/W is the caller's job.
 */

import {
  makeKiwiChatSessionState,
  type KiwiChatSessionState,
} from "./kiwiChatSessionState";

export const KIWI_SESSION_SCHEMA_VERSION = 1;

export interface KiwiSessionExportEnvelope {
  schemaVersion: number;
  state: KiwiChatSessionState;
}

export function exportKiwiSessionState(
  state: KiwiChatSessionState | null | undefined,
): string {
  const safe: KiwiChatSessionState = state
    ? {
        streak: {
          streakByPanel: { ...(state.streak?.streakByPanel ?? {}) },
          lastEventAtUtcMs: { ...(state.streak?.lastEventAtUtcMs ?? {}) },
        },
        rotation: {
          counterByPanel: { ...(state.rotation?.counterByPanel ?? {}) },
        },
      }
    : makeKiwiChatSessionState();
  const envelope: KiwiSessionExportEnvelope = {
    schemaVersion: KIWI_SESSION_SCHEMA_VERSION,
    state: safe,
  };
  try {
    return JSON.stringify(envelope);
  } catch {
    // Cyclic / non-serializable input — return canonical empty.
    return JSON.stringify({
      schemaVersion: KIWI_SESSION_SCHEMA_VERSION,
      state: makeKiwiChatSessionState(),
    });
  }
}

function isPlainNumberRecord(v: unknown): v is Record<string, number> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  for (const val of Object.values(v as Record<string, unknown>)) {
    if (typeof val !== "number" || !Number.isFinite(val) || val < 0) return false;
  }
  return true;
}

function sanitizeNumberRecord(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!v || typeof v !== "object" || Array.isArray(v)) return out;
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "number" && Number.isFinite(val) && val >= 0) {
      out[k] = Math.floor(val);
    }
  }
  return out;
}

export function importKiwiSessionState(
  raw: string | null | undefined,
): KiwiChatSessionState {
  if (typeof raw !== "string" || raw.length === 0) {
    return makeKiwiChatSessionState();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return makeKiwiChatSessionState();
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return makeKiwiChatSessionState();
  }
  const env = parsed as Partial<KiwiSessionExportEnvelope>;
  const version = typeof env.schemaVersion === "number" ? env.schemaVersion : 0;
  // Forward-compat: future schemas (>1) decode to empty rather than crash.
  if (version !== KIWI_SESSION_SCHEMA_VERSION) {
    return makeKiwiChatSessionState();
  }
  const s = (env.state ?? {}) as Partial<KiwiChatSessionState>;
  return {
    streak: {
      streakByPanel: isPlainNumberRecord(s.streak?.streakByPanel)
        ? { ...(s.streak!.streakByPanel as Record<string, number>) }
        : sanitizeNumberRecord(s.streak?.streakByPanel),
      lastEventAtUtcMs: isPlainNumberRecord(s.streak?.lastEventAtUtcMs)
        ? { ...(s.streak!.lastEventAtUtcMs as Record<string, number>) }
        : sanitizeNumberRecord(s.streak?.lastEventAtUtcMs),
    },
    rotation: {
      counterByPanel: isPlainNumberRecord(s.rotation?.counterByPanel)
        ? { ...(s.rotation!.counterByPanel as Record<string, number>) }
        : sanitizeNumberRecord(s.rotation?.counterByPanel),
    },
  };
}
