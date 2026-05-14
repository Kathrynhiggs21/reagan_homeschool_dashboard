/**
 * Push 149 (2026-05-14) — Auto-listen mark-done helper (pure).
 *
 * Mom's rule: "if Kiwi can hear the work happening, just mark it
 * done — don't make Mom tap." This pure helper decides, given the
 * block's planned duration + Kiwi's mic/activity signals + the
 * elapsed time, whether the block is safely auto-completable.
 *
 * Conservative on purpose: never auto-flips an academic block to
 * done when the kid hasn't actually crossed the duration threshold
 * AND showed sustained on-task signals; never auto-flips a block
 * the kid explicitly flagged as hard. Mom can still override at
 * any time via the inline tap-edit UI.
 *
 * Pure: no DB / no IO. Caller fetches the live block + signals,
 * runs this helper, and only writes back when `decision === "auto_done"`.
 *
 * Returns one of:
 *   - "auto_done"                — flip to done now
 *   - "auto_done_with_short_note" — flip to done + add a one-line
 *                                   "auto-completed by Kiwi (low confidence)"
 *                                   so Mom can review at end of day
 *   - "needs_human"               — leave as-is; show a chip nudging Mom
 *   - "keep_in_progress"          — block isn't done yet, keep going
 */

export type AutoListenMarkDoneDecision =
  | "auto_done"
  | "auto_done_with_short_note"
  | "needs_human"
  | "keep_in_progress";

export interface AutoListenMarkDoneInput {
  /** 1..40, used only for ordering / debug. */
  blockSortOrder: number;
  /** Plain block title (kid-readable). */
  blockTitle: string;
  /** Subject if known (Math / Reading / Science / etc.). null for movement. */
  subjectName?: string | null;
  /** Block kind. Movement / break / specials auto-complete more aggressively. */
  kind?: "academic" | "reading_only" | "movement" | "break" | "specials";
  /** What Mom planned (minutes). 1..180. */
  scheduledMinutes: number;
  /** How long the block has been "in_progress" (minutes). */
  elapsedMinutes: number;
  /** Fraction of mic samples that registered focused work voice / pencil
   *  scratch / page flip during the block (0..1). */
  micFocusFraction?: number;
  /** Fraction of mic samples that registered distress / loud frustration. */
  micDistressFraction?: number;
  /** Discrete "kid is doing the thing" events the Today UI captured
   *  (page taps, tts plays, ink strokes). 0..1000. */
  onTaskEvents?: number;
  /** Kid hit the "this is hard" button — we should NEVER auto-done. */
  kidFlaggedHard?: boolean;
  /** Mom or tutor explicitly locked this block ("don't touch it"). */
  locked?: boolean;
  /** Block already has a submission with a grade — that means the kid
   *  finished and the work is graded; auto-done is safe. */
  hasGradedSubmission?: boolean;
}

export interface AutoListenMarkDoneResult {
  decision: AutoListenMarkDoneDecision;
  /** 0..1 confidence score for telemetry / Mom's end-of-day audit. */
  confidence: number;
  /** Plain-English single sentence Mom + Grandma can understand. */
  reason: string;
  /** Short note Kiwi attaches to the day-log when decision is the
   *  "with_short_note" variant. null otherwise. */
  shortNote: string | null;
}

const ACADEMIC_KINDS = new Set(["academic", "reading_only"]);

function clamp01(n: number | undefined, fallback = 0): number {
  if (typeof n !== "number" || Number.isNaN(n)) return fallback;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export function decideAutoListenMarkDone(
  input: AutoListenMarkDoneInput,
): AutoListenMarkDoneResult {
  const kind = input.kind ?? "academic";
  const scheduled = Math.max(1, Math.round(input.scheduledMinutes));
  const elapsed = Math.max(0, Math.round(input.elapsedMinutes));
  const focus = clamp01(input.micFocusFraction, 0.5);
  const distress = clamp01(input.micDistressFraction, 0);
  const events = Math.max(0, Math.min(1000, input.onTaskEvents ?? 0));

  // Hard rules — never override these.
  if (input.locked) {
    return {
      decision: "keep_in_progress",
      confidence: 1,
      reason: "Mom locked this block, so Kiwi won't auto-finish it.",
      shortNote: null,
    };
  }
  if (input.kidFlaggedHard) {
    return {
      decision: "needs_human",
      confidence: 1,
      reason: "Reagan said this was hard, so Kiwi is leaving it for Mom to check.",
      shortNote: null,
    };
  }
  if (input.hasGradedSubmission) {
    return {
      decision: "auto_done",
      confidence: 1,
      reason: "The work was turned in and graded, so this block is done.",
      shortNote: null,
    };
  }

  // Movement / break / specials — much more permissive. If half the
  // planned time elapsed and there's any focus signal at all, mark done.
  if (kind === "movement" || kind === "break" || kind === "specials") {
    if (elapsed >= Math.ceil(scheduled * 0.5)) {
      return {
        decision: "auto_done",
        confidence: 0.85,
        reason: `Reagan finished her ${kind === "movement" ? "movement" : kind} block.`,
        shortNote: null,
      };
    }
    return {
      decision: "keep_in_progress",
      confidence: 0.5,
      reason: "Still going.",
      shortNote: null,
    };
  }

  // Academic blocks — need BOTH duration + sustained focus.
  if (ACADEMIC_KINDS.has(kind)) {
    // Distress is a hard veto on academic auto-done.
    if (distress >= 0.4) {
      return {
        decision: "needs_human",
        confidence: 0.9,
        reason: "Reagan sounded frustrated — Kiwi will leave it for Mom to check.",
        shortNote: null,
      };
    }

    const durationMet = elapsed >= scheduled;
    const sustainedFocus = focus >= 0.6 && events >= 3;
    const partialFocus = focus >= 0.4 && events >= 2;

    if (durationMet && sustainedFocus) {
      return {
        decision: "auto_done",
        confidence: 0.92,
        reason: `Reagan worked the full ${scheduled} minutes on ${input.subjectName ?? input.blockTitle}.`,
        shortNote: null,
      };
    }
    if (durationMet && partialFocus) {
      return {
        decision: "auto_done_with_short_note",
        confidence: 0.7,
        reason: `Reagan worked the time, but Kiwi heard some quiet stretches.`,
        shortNote: "Auto-completed by Kiwi (focus was light — Mom may want to review).",
      };
    }
    if (durationMet && !partialFocus) {
      return {
        decision: "needs_human",
        confidence: 0.6,
        reason: "Time ran out but Kiwi didn't hear much work — please check with Reagan.",
        shortNote: null,
      };
    }

    return {
      decision: "keep_in_progress",
      confidence: 0.5,
      reason: "Still working — Kiwi will keep listening.",
      shortNote: null,
    };
  }

  // Unknown kind — never auto-flip.
  return {
    decision: "needs_human",
    confidence: 0.4,
    reason: "Kiwi isn't sure about this block — please check with Mom.",
    shortNote: null,
  };
}
