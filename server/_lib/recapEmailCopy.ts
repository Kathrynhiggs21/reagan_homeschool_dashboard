/**
 * Push 110 (2026-05-13) — Recap email Grandma copy block.
 *
 * Push 95 set up the recap-email *queue* (when to send, idempotency,
 * Reagan-voice gating). Push 98 set up the *send queue planner*.
 * This module is the *body composer*: it turns the day's signals into
 * the actual greeting / what-she-did-not-do framing / IEP-friendly
 * close paragraph that goes into Grandma's email.
 *
 * House rules baked in:
 *   - Grandma is addressed by name in the greeting ("Hi Grandma,")
 *   - We never frame Reagan negatively. The body says what we *don't*
 *     have signal for, not "she didn't do X". Specifically: "We didn't
 *     log any school work for {date}", not "Reagan skipped school".
 *   - We always offer a constructive next step (asking Mom or asking
 *     Reagan herself) so Grandma never feels stuck.
 *   - Noon cadence = heads-up tone. Evening cadence = final-ask tone.
 *   - The IEP-paper-trail framing closes the email so Grandma knows
 *     this is the same record Mom uses for IEP meetings.
 *
 * Pure module — no DB, no I/O.
 */

export type RecapCadence = "noon" | "evening";

export interface RecapEmailInputs {
  cadence: RecapCadence;
  /** Local family-date that the recap covers (YYYY-MM-DD). */
  familyDateIso: string;
  /** Signals we *do* have for the day (transcripts, photos, mood logs). */
  observedSignals: string[];
  /** Reagan's first name (defaults to "Reagan"). */
  kidName?: string;
  /** Sender attribution line at the bottom. */
  sentBy?: string;
}

export interface RecapEmailBody {
  cadence: RecapCadence;
  subject: string;
  greeting: string;
  framing: string;
  observedBlock: string | null;
  nextStep: string;
  close: string;
  signature: string;
}

function safeKidName(kidName?: string): string {
  const trimmed = (kidName ?? "").trim();
  return trimmed.length > 0 ? trimmed : "Reagan";
}

export function composeRecapEmailBody(input: RecapEmailInputs): RecapEmailBody {
  const cadence = input.cadence;
  const date = input.familyDateIso;
  const kid = safeKidName(input.kidName);

  const subject =
    cadence === "noon"
      ? `Heads-up: no school work logged yet for ${kid} (${date})`
      : `End-of-day check-in: still no school work logged for ${kid} (${date})`;

  const greeting = "Hi Grandma,";

  // The framing line is intentionally "what we don't have logged",
  // never "what Reagan didn't do". Different cadence = different tone.
  const framing =
    cadence === "noon"
      ? `Quick heads-up — as of midday on ${date}, the dashboard hasn't logged any school work for ${kid} yet. Sometimes it just means the listening device or the day-log entry hasn't synced. I wanted you to know in case you'd like to text Mom.`
      : `End-of-day note — we still don't have any school work logged for ${kid} on ${date}. This isn't necessarily a missed day; it could mean the day-log entry never got recorded. Mom may already know, but I wanted you in the loop.`;

  // If we *do* have partial signals, mention them as a softening — Grandma
  // appreciates knowing the day wasn't a black box.
  let observedBlock: string | null = null;
  const observed = (input.observedSignals ?? []).filter(
    (s) => typeof s === "string" && s.trim().length > 0,
  );
  if (observed.length > 0) {
    observedBlock = `What I do see for the day: ${observed.join("; ")}.`;
  }

  const nextStep =
    cadence === "noon"
      ? `If you'd like to nudge, you can text Mom or ask ${kid} directly when you next chat.`
      : `If you'd like to follow up, Mom is the best first stop — she may have already logged it manually.`;

  const close =
    "This is the same paper trail Mom uses for IEP meetings, so anything you flag here helps the record stay accurate.";

  const signature =
    (input.sentBy && input.sentBy.trim().length > 0
      ? input.sentBy.trim()
      : "Sent automatically by Reagan's homeschool dashboard");

  return {
    cadence,
    subject,
    greeting,
    framing,
    observedBlock,
    nextStep,
    close,
    signature,
  };
}

/** Render the body to plain-text email content (one block per line group). */
export function renderRecapEmailPlainText(body: RecapEmailBody): string {
  const parts: string[] = [body.greeting, "", body.framing];
  if (body.observedBlock) {
    parts.push("", body.observedBlock);
  }
  parts.push("", body.nextStep, "", body.close, "", "—", body.signature);
  return parts.join("\n");
}
