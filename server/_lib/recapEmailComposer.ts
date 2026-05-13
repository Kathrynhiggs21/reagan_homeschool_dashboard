/**
 * Push 95 (2026-05-13) — Recap-email composer.
 *
 * Per Mom's "Agenda Tracking and Curriculum Check Protocol": when a school
 * day passes with no actual-agenda entries and no AI observation, the
 * dashboard emails marcy.spear@gmail.com (Grandma) asking for a brief
 * overview of what Reagan did that day. The reply is parsed back into
 * the dashboard and used for curriculum coverage.
 *
 * This module is the *pure* composer — it produces the email subject and
 * plain-text body from a small `MissingDaySignal` object. The actual
 * SMTP wire-up reads its output and hands it to the mail adapter.
 *
 * No DB, no I/O, deterministic.
 */

export interface MissingDaySignal {
  /** Local date the dashboard noticed has no entries. YYYY-MM-DD. */
  dateISO: string;
  /** Kid display name; defaults to "Reagan" for our single-student app. */
  kidName?: string;
  /**
   * Optional planned-subject list ("planned today: math, ELA, science").
   * Helps Grandma reply quickly with just deltas.
   */
  plannedSubjects?: string[];
  /**
   * Optional "observed but unparsed" signals, e.g. a vague mood-log line
   * or a photo timestamp — surfaces context without committing to it.
   */
  observedSignals?: string[];
  /** "noon" reminder, "evening" final ask. Adjusts tone. */
  cadence: "noon" | "evening";
}

export interface ComposedRecapEmail {
  subject: string;
  body: string;
  toEmail: string;
  toDisplayName: string;
}

const TO_EMAIL = "marcy.spear@gmail.com";
const TO_NAME = "Grandma Marcy";

function fmtDate(dateISO: string): string {
  // dateISO is canonical YYYY-MM-DD — no timezone math needed; just label it.
  const d = new Date(`${dateISO}T12:00:00Z`); // noon UTC sidesteps DST edges
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function composeRecapEmail(input: MissingDaySignal): ComposedRecapEmail {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dateISO)) {
    throw new Error(`composeRecapEmail: bad dateISO "${input.dateISO}"`);
  }
  const kid = (input.kidName ?? "Reagan").trim() || "Reagan";
  const friendlyDate = fmtDate(input.dateISO);

  const subjectPrefix = input.cadence === "noon" ? "Quick check-in" : "End-of-day recap";
  const subject = `${subjectPrefix}: how did ${kid} do on ${friendlyDate}?`;

  const lines: string[] = [];
  lines.push(`Hi ${TO_NAME},`);
  lines.push("");
  if (input.cadence === "noon") {
    lines.push(
      `Just a quick check — the dashboard hasn't logged any work yet for ${kid} today (${friendlyDate}). No worries if you're mid-day; this is just a heads-up.`,
    );
  } else {
    lines.push(
      `No work was logged for ${kid} today (${friendlyDate}). Could you send a brief overview of what she did and learned? I'll record it as today's agenda so curriculum coverage stays accurate.`,
    );
  }

  if (input.plannedSubjects && input.plannedSubjects.length > 0) {
    lines.push("");
    lines.push(`Planned subjects today were: ${input.plannedSubjects.join(", ")}.`);
  }

  if (input.observedSignals && input.observedSignals.length > 0) {
    lines.push("");
    lines.push("Things the dashboard noticed but couldn't confirm:");
    for (const s of input.observedSignals) lines.push(`  - ${s}`);
  }

  lines.push("");
  lines.push("Just hit reply with a sentence or two — even bullet points are fine.");
  lines.push("");
  lines.push("Thank you!");
  lines.push("— Reagan's homeschool dashboard");

  return {
    subject,
    body: lines.join("\n"),
    toEmail: TO_EMAIL,
    toDisplayName: TO_NAME,
  };
}

/**
 * Idempotency key for the dailyRecapRequests row so we don't double-send
 * within the same cadence slot on the same day.
 */
export function recapEmailIdempotencyKey(input: MissingDaySignal): string {
  return `recap:${input.dateISO}:${input.cadence}`;
}
