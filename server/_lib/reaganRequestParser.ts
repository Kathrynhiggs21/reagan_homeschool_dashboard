/**
 * Push 156 (2026-05-14) — Reagan Request Button parser.
 *
 * Mom's locked preference (knowledge):
 *
 *   "Implement a request button for Reagan that sends messages to adults
 *    for assignment requests, adventure ideas, or schedule changes."
 *
 * AND:
 *
 *   "Reagan cannot directly change schedules but can request schedule
 *    changes. She can make basic changes through 'kiwi' as previously
 *    mentioned."
 *
 * AND:
 *
 *   "Any resets or changes to Reagan's schedule or system settings
 *    require approval from both her mom and grandma. These approval
 *    requests should be sent to their phones."
 *
 * So this helper takes whatever Reagan typed/said into the Request
 * Button card and turns it into a typed adult-side row that:
 *   - never auto-applies anything to the schedule;
 *   - is categorized so the adult phone notification can be one short
 *     sentence Mom + Grandma can scan in 2 seconds;
 *   - defaults to "needsBothApprovers: true" for actual schedule changes,
 *     and "needsBothApprovers: false" for soft asks (adventure idea,
 *     extra reading time, "can I have a snack");
 *   - is kid-readable in `displayLabel` (no "ScheduleMutation" jargon).
 *
 * Pure: no DB, no LLM, no clock dependency. The caller passes
 * `nowISO` so this is testable.
 *
 * Output shape is intentionally tiny so the route handler can drop it
 * straight into a `reaganRequests` row without further reshaping.
 */

export type ReaganRequestKind =
  | "schedule_change" // "can we skip math today" / "shorter day please"
  | "assignment_request" // "I want a worksheet about whales"
  | "adventure_idea" // "let's do bird watching today"
  | "snack_or_break" // "can I have a snack" / "I need a break"
  | "kiwi_basic_tweak" // small things Reagan can self-serve via Kiwi (start a body break)
  | "general_message"; // "I love you Mom" — fall-through

export type ReaganRequestUrgency = "now" | "today" | "whenever";

export interface ReaganRequestRow {
  /** Stable ISO-ish timestamp the caller passed in. */
  createdAtISO: string;
  /** Verbatim kid input — preserved so Mom can read what Reagan actually said. */
  rawText: string;
  /** Categorized type, drives the route + notification copy. */
  kind: ReaganRequestKind;
  /** Pre-rendered kid-readable label for the adult phone notification. */
  displayLabel: string;
  /** Urgency hint for the adult-side queue ordering. */
  urgency: ReaganRequestUrgency;
  /** Schedule-change requests need BOTH Mom + Grandma per the locked rule. */
  needsBothApprovers: boolean;
  /** When kind is `kiwi_basic_tweak`, Reagan may self-apply via Kiwi. */
  kiwiCanSelfApply: boolean;
  /** Suggested phone notification body (one short sentence). */
  notificationBody: string;
  /** Optional structured detail for assignment_request / adventure_idea. */
  detail?: {
    /** Subject hint when detectable ("math", "science", etc.) */
    subjectHint?: string;
    /** Topic phrase pulled out of the request ("whales", "bird watching"). */
    topicHint?: string;
    /** Length hint in minutes when Reagan asked for a duration. */
    minutesHint?: number;
  };
}

const SCHEDULE_KEYWORDS = [
  /\bskip\b/,
  /\bcancel\b/,
  /\bmove\b/,
  /\bswap\b/,
  /\bswitch\b/,
  /\bshorter\b/,
  /\blonger\b/,
  /\bstart later\b/,
  /\bstart earlier\b/,
  /\b(sleep in|wake up later)\b/,
  /\b(end early|done early|stop early)\b/,
  /\b(less|fewer)\b/,
  /\bno (math|reading|science|writing|social studies|art|music)\b/,
  /\bday off\b/,
  /\bbreak day\b/,
  /\b(reschedule|change the schedule)\b/,
];

const ASSIGNMENT_KEYWORDS = [
  /\bworksheet\b/,
  /\bassignment\b/,
  /\bassign\b/,
  /\b(give me|can i have|i want)\b.*\b(work|page|practice|sheet|problem|activity)\b/,
  /\bquiz\b/,
  /\b(more|extra) (math|reading|science|writing|art|music|practice)\b/,
  /\b(read|study|learn) (about|more about)\b/,
];

const ADVENTURE_KEYWORDS = [
  /\b(bird|birds|birding|bird-?watch)/,
  /\bnature walk\b/,
  /\b(hike|hiking)\b/,
  /\b(park|playground|outside|outdoors|backyard)\b/,
  /\b(swim|swimming|pool|beach|lake|river|creek|stream)\b/,
  /\b(crystal|rocks|leaves|bugs|plants|flowers|garden)\b/,
  /\badventure\b/,
  /\b(scavenger hunt|treasure hunt)\b/,
  /\bfield trip\b/,
];

const SNACK_BREAK_KEYWORDS = [
  /\bsnack\b/,
  /\b(hungry|thirsty)\b/,
  /\b(water|drink)\b/,
  /\b(bathroom|potty|restroom)\b/,
  /\b(tired|sleepy)\b/,
  /\bbreak\b(?! day)/,
  /\brest\b/,
  /\bstretch\b/,
];

const KIWI_BASIC_KEYWORDS = [
  /\b(start|begin) (a |my )?(body break|stretch|breathing)\b/,
  /\b(turn on|play) (focus|chill|study) (music|sound)\b/,
  /\b(set|start) a (5|10|15|20)[-\s]?(minute|min) timer\b/,
  /\b(quiet mode|do not disturb|dnd)\b/,
];

const URGENCY_NOW = [
  /\bnow\b/,
  /\bright now\b/,
  /\bhungry\b/,
  /\bbathroom\b/,
  /\bpotty\b/,
  /\bhurts?\b/,
  /\b(i (don'?t|do not) feel good|sick|stomach ache|headache)\b/,
];
const URGENCY_TODAY = [
  /\btoday\b/,
  /\bthis (morning|afternoon|evening)\b/,
  /\bbefore (lunch|dinner|bed)\b/,
  /\b(after|before) (math|reading|science|writing|lunch|dinner)\b/,
];

const SUBJECT_TERMS: Record<string, RegExp> = {
  math: /\bmath(s)?\b/,
  reading: /\b(read|reading|book)\b/,
  writing: /\b(writing|write|spelling|grammar)\b/,
  science: /\bscience|experiment|crystal|bug|plant|bird|animal\b/,
  social_studies: /\bsocial studies|history|geography|map\b/,
  art: /\bart|draw|paint|color|craft\b/,
  music: /\bmusic|sing|song|piano|guitar\b/,
  pe: /\b(pe|gym|recess|exercise|run|jump)\b/,
};

const DURATION_RE = /\b(\d{1,3})\s?(?:m|min|mins|minute|minutes)\b/i;

function firstMatch(text: string, patterns: RegExp[]): boolean {
  for (const p of patterns) {
    if (p.test(text)) return true;
  }
  return false;
}

function detectSubject(text: string): string | undefined {
  for (const [name, re] of Object.entries(SUBJECT_TERMS)) {
    if (re.test(text)) return name;
  }
  return undefined;
}

function detectTopic(text: string, kind: ReaganRequestKind): string | undefined {
  // Cheap heuristic: phrases like "about X" / "do X today" / "I want X".
  const m =
    /\babout ([a-z][a-z\s\-]{2,40})/i.exec(text) ||
    /\b(?:do|try|study|learn|read about|watch) ([a-z][a-z\s\-]{2,40})/i.exec(
      text,
    ) ||
    /\b(?:i want|can i have|let'?s do) ([a-z][a-z\s\-]{2,40})/i.exec(text);
  if (!m) return undefined;
  const phrase = m[1].trim().replace(/\s+(today|please|now|this week)$/i, "");
  if (kind === "adventure_idea") {
    // Trim trailing "on the playground" / "outside" tail-words for clarity.
    return phrase.replace(/\s+(outside|outdoors|at the park|in the backyard)$/i, "").trim();
  }
  return phrase;
}

function detectDurationMinutes(text: string): number | undefined {
  const m = DURATION_RE.exec(text);
  if (!m) return undefined;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0 || n > 240) return undefined;
  return n;
}

function classifyKind(text: string): ReaganRequestKind {
  // Order matters: KIWI tweaks are most specific, then schedule, then
  // assignment, then adventure, then snack/break, then general.
  if (firstMatch(text, KIWI_BASIC_KEYWORDS)) return "kiwi_basic_tweak";
  if (firstMatch(text, SCHEDULE_KEYWORDS)) return "schedule_change";
  if (firstMatch(text, ASSIGNMENT_KEYWORDS)) return "assignment_request";
  if (firstMatch(text, ADVENTURE_KEYWORDS)) return "adventure_idea";
  if (firstMatch(text, SNACK_BREAK_KEYWORDS)) return "snack_or_break";
  return "general_message";
}

function classifyUrgency(text: string): ReaganRequestUrgency {
  if (firstMatch(text, URGENCY_NOW)) return "now";
  if (firstMatch(text, URGENCY_TODAY)) return "today";
  return "whenever";
}

function buildDisplayLabel(kind: ReaganRequestKind, raw: string): string {
  const head = raw.replace(/\s+/g, " ").trim().slice(0, 60);
  switch (kind) {
    case "schedule_change":
      return `Reagan asks to change the day: "${head}"`;
    case "assignment_request":
      return `Reagan wants more work: "${head}"`;
    case "adventure_idea":
      return `Reagan has an adventure idea: "${head}"`;
    case "snack_or_break":
      return `Reagan needs a quick break: "${head}"`;
    case "kiwi_basic_tweak":
      return `Reagan asked Kiwi to help: "${head}"`;
    case "general_message":
    default:
      return `Reagan sent a message: "${head}"`;
  }
}

function buildNotificationBody(kind: ReaganRequestKind, raw: string): string {
  const head = raw.replace(/\s+/g, " ").trim().slice(0, 80);
  switch (kind) {
    case "schedule_change":
      return `Schedule change request from Reagan — needs both Mom + Grandma. "${head}"`;
    case "assignment_request":
      return `Reagan wants more work. "${head}"`;
    case "adventure_idea":
      return `Reagan has an adventure idea for today. "${head}"`;
    case "snack_or_break":
      return `Reagan needs a snack or quick break. "${head}"`;
    case "kiwi_basic_tweak":
      return `Reagan tweaked her own day with Kiwi. "${head}"`;
    case "general_message":
    default:
      return `Reagan sent: "${head}"`;
  }
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

export interface ParseReaganRequestOptions {
  /** Optional display-name override; defaults to "Reagan" for label phrasing. */
  kidName?: string;
}

export function parseReaganRequest(
  rawText: string,
  nowISO: string,
  _options: ParseReaganRequestOptions = {},
): ReaganRequestRow {
  if (typeof rawText !== "string") {
    throw new Error("parseReaganRequest: rawText must be a string");
  }
  const trimmed = rawText.trim();
  if (trimmed.length === 0) {
    throw new Error("parseReaganRequest: rawText cannot be empty");
  }
  if (typeof nowISO !== "string" || !ISO_RE.test(nowISO)) {
    throw new Error(
      `parseReaganRequest: nowISO must be ISO-8601 (YYYY-MM-DDTHH:MM…), got ${JSON.stringify(nowISO)}`,
    );
  }

  const lower = trimmed.toLowerCase();
  const kind = classifyKind(lower);
  const urgency = classifyUrgency(lower);
  const subject = detectSubject(lower);
  const topic = detectTopic(trimmed, kind);
  const minutes = detectDurationMinutes(trimmed);

  const detail: ReaganRequestRow["detail"] | undefined =
    kind === "assignment_request" || kind === "adventure_idea" || kind === "schedule_change"
      ? {
          subjectHint: subject,
          topicHint: topic,
          minutesHint: minutes,
        }
      : undefined;

  return {
    createdAtISO: nowISO,
    rawText: trimmed,
    kind,
    displayLabel: buildDisplayLabel(kind, trimmed),
    urgency,
    // Rule: schedule changes need BOTH approvers per Mom's locked policy.
    // Everything else is a single-tap acknowledgment.
    needsBothApprovers: kind === "schedule_change",
    kiwiCanSelfApply: kind === "kiwi_basic_tweak",
    notificationBody: buildNotificationBody(kind, trimmed),
    detail,
  };
}
