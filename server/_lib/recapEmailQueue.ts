/**
 * Push 98 (2026-05-13) — Recap email send queue planner.
 *
 * Bridges the Push 95 composer (subject + body) with a deterministic
 * idempotency-keyed plan that the eventual SMTP wire-up consumes.
 *
 * Rules:
 *   - Recap emails go to Grandma Marcy ONLY (marcy.spear@gmail.com).
 *   - Each calendar day produces at most TWO sends: one "noon" heads-up
 *     and one "evening" final ask. Dedup by `recap:<date>:<cadence>`.
 *   - If actualAgendaEntries already exist for `dateISO`, the planner
 *     returns an empty list (the dashboard already has the answer).
 *   - Pure module — no DB, no I/O.
 */
import {
  composeRecapEmail,
  recapEmailIdempotencyKey,
  type MissingDaySignal,
  type ComposedRecapEmail,
} from "./recapEmailComposer";

export interface PlanRecapSendInput {
  dateISO: string;
  /** Which cadence to evaluate. */
  cadence: "noon" | "evening";
  /** Number of actual-agenda entries already logged for this date. */
  actualEntryCount: number;
  /** Whether AI listening already produced a Reagan-confirmed chunk today. */
  reaganListeningConfirmed: boolean;
  /** Optional planned subjects, surfaced in the email body. */
  plannedSubjects?: string[];
  /** Optional observation breadcrumbs the dashboard noticed but couldn't confirm. */
  observedSignals?: string[];
  /** Idempotency keys already in the dailyRecapRequests queue. */
  alreadyQueuedKeys?: string[];
}

export interface PlannedRecapSend {
  idempotencyKey: string;
  toEmail: string;
  toDisplayName: string;
  subject: string;
  body: string;
  cadence: "noon" | "evening";
  dateISO: string;
}

export interface RecapSendPlan {
  sends: PlannedRecapSend[];
  /** Diagnostic reason when no send is queued. */
  skipReason?:
    | "actual-entries-exist"
    | "reagan-voice-confirmed"
    | "already-queued"
    | "bad-input";
}

export function planRecapSend(input: PlanRecapSendInput): RecapSendPlan {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dateISO)) {
    return { sends: [], skipReason: "bad-input" };
  }
  if (input.actualEntryCount > 0) {
    return { sends: [], skipReason: "actual-entries-exist" };
  }
  if (input.reaganListeningConfirmed) {
    return { sends: [], skipReason: "reagan-voice-confirmed" };
  }

  const signal: MissingDaySignal = {
    dateISO: input.dateISO,
    cadence: input.cadence,
    plannedSubjects: input.plannedSubjects,
    observedSignals: input.observedSignals,
  };

  const composed: ComposedRecapEmail = composeRecapEmail(signal);
  const key = recapEmailIdempotencyKey(signal);

  const already = new Set(input.alreadyQueuedKeys ?? []);
  if (already.has(key)) {
    return { sends: [], skipReason: "already-queued" };
  }

  return {
    sends: [
      {
        idempotencyKey: key,
        toEmail: composed.toEmail,
        toDisplayName: composed.toDisplayName,
        subject: composed.subject,
        body: composed.body,
        cadence: input.cadence,
        dateISO: input.dateISO,
      },
    ],
  };
}
