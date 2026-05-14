/**
 * Push 152 (2026-05-14) — Inline tap-edit handler (pure helper).
 *
 * Mom + Grandma should be able to tap directly on the Today page
 * (start time, minutes, or title) and change a block in one motion.
 * No menus, no save buttons, no jargon. Mistakes are easy to undo.
 *
 * This pure helper:
 *   - validates each kind of edit ("9am" / "30 min" / "Math practice")
 *   - rejects nonsense in plain English Mom can read
 *   - returns the canonical SQL-ready field + value for the caller
 *   - emits an undo payload (the old value) so the Today page can
 *     show a "Undo" toast for 8 seconds.
 *
 * Pure: no DB / no IO. Caller wires the resulting `applyValue` to
 * the existing `db.updateBlock(blockId, { ... })` mutation.
 */

export type InlineTapEditField = "startTime" | "durationMin" | "title";

export interface InlineTapEditInput {
  blockId: number;
  field: InlineTapEditField;
  /** What Mom typed in the inline editor. Always a string at the UI layer. */
  rawValue: string;
  /** Old block snapshot — for the undo toast + audit log. */
  oldStartTime?: string | null;
  oldDurationMin?: number | null;
  oldTitle?: string;
  /** Defaults to true. Movement / break blocks have a smaller minutes range. */
  isAcademic?: boolean;
}

export interface InlineTapEditResult {
  ok: boolean;
  blockId: number;
  field: InlineTapEditField;
  /** Set on success — what the caller writes into the DB. */
  applyValue: string | number | null;
  /** Set on success — Mom's "Undo" toast restores this. */
  undoValue: string | number | null;
  /** One-sentence kid + Grandma readable confirmation OR error message. */
  message: string;
}

function err(blockId: number, field: InlineTapEditField, message: string): InlineTapEditResult {
  return {
    ok: false, blockId, field,
    applyValue: null, undoValue: null,
    message,
  };
}

function parseTimeOfDay(input: string): string | null {
  const t = (input ?? "").trim().toLowerCase();
  if (!t) return null;
  const m = t.match(/^([01]?\d|2[0-3])(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)?$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const mm = m[2] ? parseInt(m[2], 10) : 0;
  const period = m[3]?.toLowerCase().replace(/\./g, "");
  if (period === "pm" && h < 12) h += 12;
  if (period === "am" && h === 12) h = 0;
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return `${h.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`;
}

function parseDurationMinutes(input: string, max: number): number | null {
  const t = (input ?? "").trim();
  if (!t) return null;
  // Accept "30", "30m", "30 min", "30 minutes", "1h", "1 hour", "1h 15m"
  const hourMatch = t.match(/(\d+)\s*h(?:our|r)?s?/i);
  let total = 0;
  if (hourMatch) total += parseInt(hourMatch[1], 10) * 60;
  // Capture minutes either explicitly ("15m", "30 min") or as a leftover number
  // when there's no hour token.
  if (hourMatch) {
    const tail = t.slice(hourMatch.index! + hourMatch[0].length);
    const tailMins = tail.match(/(\d+)\s*m(?:in(?:ute)?s?)?\b/i);
    if (tailMins) total += parseInt(tailMins[1], 10);
  } else {
    const explicitMins = t.match(/^(\d+)\s*m(?:in(?:ute)?s?)?\b/i);
    if (explicitMins) {
      total = parseInt(explicitMins[1], 10);
    } else if (/^\d+$/.test(t)) {
      total = parseInt(t, 10);
    } else {
      return null;
    }
  }
  if (total <= 0 || total > max) return null;
  return total;
}

function sanitizeTitle(input: string): string | null {
  const t = (input ?? "").trim();
  if (!t) return null;
  if (t.length > 80) return null;
  // Strip newlines / tabs.
  return t.replace(/\s+/g, " ");
}

export function applyInlineTapEdit(input: InlineTapEditInput): InlineTapEditResult {
  if (input.field === "startTime") {
    const parsed = parseTimeOfDay(input.rawValue);
    if (!parsed) {
      return err(input.blockId, input.field,
        "Hmm, Kiwi didn't get that time. Try \"9\" or \"9:30\" or \"10am\".");
    }
    return {
      ok: true,
      blockId: input.blockId,
      field: "startTime",
      applyValue: parsed,
      undoValue: input.oldStartTime ?? null,
      message: `Start time changed to ${parsed}.`,
    };
  }

  if (input.field === "durationMin") {
    const max = input.isAcademic === false ? 60 : 180;
    const parsed = parseDurationMinutes(input.rawValue, max);
    if (parsed === null) {
      return err(input.blockId, input.field,
        `Try a number of minutes between 1 and ${max} (like \"30 min\" or \"1h\").`);
    }
    return {
      ok: true,
      blockId: input.blockId,
      field: "durationMin",
      applyValue: parsed,
      undoValue: input.oldDurationMin ?? null,
      message: `Block length changed to ${parsed} minutes.`,
    };
  }

  if (input.field === "title") {
    const parsed = sanitizeTitle(input.rawValue);
    if (!parsed) {
      return err(input.blockId, input.field,
        "Block names need 1–80 characters. Try a short name like \"Math practice\".");
    }
    return {
      ok: true,
      blockId: input.blockId,
      field: "title",
      applyValue: parsed,
      undoValue: input.oldTitle ?? null,
      message: `Block name changed to "${parsed}".`,
    };
  }

  return err(input.blockId, input.field, "Kiwi can't change that field yet.");
}
