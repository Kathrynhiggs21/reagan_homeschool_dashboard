/**
 * Push 158 (2026-05-14) — Adult quick-entry "what we actually did" payload builder.
 *
 * Mom's locked rule (Agenda Tracking and Curriculum Check Protocol):
 *
 *   "If the day does not follow the planned agenda, ensure the actual
 *    agenda is recorded and used for curriculum checks. ... Ensure
 *    Google Drive has sync capabilities for all folders."
 *
 * AND simplification rule:
 *
 *   "The system should be 'fresh ready for the day' with an easily
 *    editable schedule, and should provide clear progress and analytics."
 *
 * Goal: Mom or Grandma taps a single "What we actually did" tile on the
 * Today page, types ONE plain-English line per block (e.g.,
 * "Math: workbook page 42, took 25 min, did great"), and the dashboard
 * turns that into:
 *
 *   1) An `actualAgendaEntries` row per block — what really happened,
 *      stored separately from the planned agenda so curriculum checks
 *      and weekly rollups can compare planned vs actual.
 *   2) A Drive day-log enqueue payload — one Markdown file per school
 *      day that lands in Reagan School Hub > Day Logs > YYYY-MM-DD.md.
 *
 * Pure helper: no DB, no LLM, no clock dependency, deterministic. Caller
 * passes the school-day ISO + the per-block entries + an optional
 * planned-vs-actual reconciliation hint.
 *
 * The payload is intentionally tiny and Mom-readable so the route
 * handler doesn't have to re-shape it before insert.
 */

export interface QuickEntryLine {
  /** Free-form per-block input. e.g., "Math: workbook page 42, 25 min, did great" */
  rawLine: string;
  /** Optional planned blockId the line corresponds to (when Mom mapped it). */
  plannedBlockId?: string;
}

export interface ActualAgendaEntry {
  /** ISO date for the school day, e.g., "2026-05-14". */
  schoolDayISO: string;
  /** Optional planned blockId we reconciled to. */
  plannedBlockId?: string;
  /** Inferred subject (math / reading / writing / science / social_studies / art / music / pe / unspecified). */
  subject: string;
  /** Verbatim line preserved for human review. */
  rawLine: string;
  /** Inferred minutes spent (0 if not parsable). */
  minutesSpent: number;
  /** Inferred kid-readable outcome label (great / okay / hard / skipped / unspecified). */
  outcome: "great" | "okay" | "hard" | "skipped" | "unspecified";
  /** A short Mom-readable headline ("Math · 25 min · did great"). */
  displayLabel: string;
  /** A trimmed "what they did" summary (up to 200 chars). */
  whatTheyDid: string;
}

export interface DriveDayLogEnqueue {
  /**
   * Drive-side target folder name. MUST match the `drivePushQueue.target_folder`
   * MySQL enum exactly (see drizzle/schema.ts) and the DRIVE_FOLDER_NAMES map
   * in server/db.ts. The string is the SINGULAR `day_log` — the human-facing
   * Drive subfolder name is `"Day Logs"` and is derived from this routing key.
   * The plural form was a typo (2026-05-14) — fixed 2026-05-29 during routing
   * audit so payloads that flow through routers never get rejected by the enum.
   */
  targetFolder: "day_log";
  /** Filename without extension; route adds `.md`. */
  fileBaseName: string;
  /** Markdown body (kid + Grandma readable, no jargon, no internal ids). */
  markdownBody: string;
}

export interface AdultQuickEntryPayload {
  schoolDayISO: string;
  /** One row per parsed block. */
  actualEntries: ActualAgendaEntry[];
  /** Drive enqueue payload. */
  driveEnqueue: DriveDayLogEnqueue;
  /** Pre-rendered phone notification body for Mom + Grandma. */
  notificationBody: string;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const SUBJECT_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: "math", re: /\b(math(s)?|fractions?|decimals?|geometry|workbook page)\b/i },
  { name: "reading", re: /\b(reading|read|book|chapter|tuck everlasting|michael'?s world)\b/i },
  { name: "writing", re: /\b(writing|spelling|grammar|180 days|essay|paragraph)\b/i },
  { name: "science", re: /\b(science|spectrum science|experiment|crystal|bird|plant|animal|volcano|water cycle|food web)\b/i },
  { name: "social_studies", re: /\b(social studies|history|geography|map|state capital)\b/i },
  { name: "art", re: /\b(art|draw|paint|color|craft)\b/i },
  { name: "music", re: /\b(music|sing|song|piano|guitar|recorder)\b/i },
  { name: "pe", re: /\b(pe|gym|recess|exercise|run|jump|swim|hike|bike)\b/i },
  { name: "outdoor_adventure", re: /\b(adventure|outside|outdoors|nature walk|park|playground|backyard|creek|stream)\b/i },
];

const OUTCOME_PATTERNS: Array<{ name: ActualAgendaEntry["outcome"]; re: RegExp }> = [
  { name: "skipped", re: /\b(skipped|didn'?t do|did not do|missed|cancelled)\b/i },
  { name: "hard", re: /\b(hard|tough|struggled|frustrated|melted? down|cried|hated)\b/i },
  { name: "great", re: /\b(great|awesome|amazing|loved it|nailed it|did great|crushed it|fantastic)\b/i },
  { name: "okay", re: /\b(okay|ok|fine|alright|so-?so|meh|pretty good|did fine)\b/i },
];

const DURATION_RE = /(\d{1,3})\s?(?:m|min|mins|minute|minutes|hr|hour|hours|h)\b/i;

function detectSubject(line: string): string {
  for (const { name, re } of SUBJECT_PATTERNS) {
    if (re.test(line)) return name;
  }
  // Header-style: "Math:" or "Math —"
  const head = /^([A-Z][A-Za-z &]{2,30})\s*[:\-–—]/.exec(line.trim());
  if (head) {
    const lower = head[1].toLowerCase();
    for (const { name, re } of SUBJECT_PATTERNS) {
      if (re.test(lower)) return name;
    }
  }
  return "unspecified";
}

function detectMinutes(line: string): number {
  const m = DURATION_RE.exec(line);
  if (!m) return 0;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const isHours = /\b(hr|hour|hours|h)\b/i.test(m[0]);
  const minutes = isHours ? n * 60 : n;
  return Math.min(240, minutes);
}

function detectOutcome(line: string): ActualAgendaEntry["outcome"] {
  for (const { name, re } of OUTCOME_PATTERNS) {
    if (re.test(line)) return name;
  }
  return "unspecified";
}

function buildDisplayLabel(
  subject: string,
  minutes: number,
  outcome: ActualAgendaEntry["outcome"],
): string {
  const parts: string[] = [];
  parts.push(subject === "unspecified" ? "Activity" : capitalize(subject.replace(/_/g, " ")));
  if (minutes > 0) parts.push(`${minutes} min`);
  if (outcome !== "unspecified") parts.push(outcomeCopy(outcome));
  return parts.join(" · ");
}

function outcomeCopy(o: ActualAgendaEntry["outcome"]): string {
  switch (o) {
    case "great": return "did great";
    case "okay": return "did fine";
    case "hard": return "was hard";
    case "skipped": return "skipped";
    case "unspecified":
    default: return "";
  }
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildWhatTheyDid(line: string): string {
  // Strip leading "Math:" / "Reading -" header so the body is the meat.
  const stripped = line.replace(/^[A-Z][A-Za-z &]{1,30}\s*[:\-–—]\s*/, "").trim();
  return stripped.slice(0, 200);
}

function buildMarkdownBody(
  schoolDayISO: string,
  entries: ActualAgendaEntry[],
): string {
  const header = `# Reagan's day — ${schoolDayISO}\n\n_Written by Mom or Grandma after the day._\n\n`;
  if (entries.length === 0) {
    return header + "_(No blocks logged.)_\n";
  }
  const lines = entries.map((e) => {
    const head = `## ${e.displayLabel}`;
    const body = e.whatTheyDid ? `\n${e.whatTheyDid}\n` : "\n";
    return `${head}${body}`;
  });
  return header + lines.join("\n");
}

function buildNotificationBody(
  schoolDayISO: string,
  entries: ActualAgendaEntry[],
): string {
  if (entries.length === 0) {
    return `Day log saved for ${schoolDayISO} (no blocks).`;
  }
  const totalMin = entries.reduce((acc, e) => acc + e.minutesSpent, 0);
  const subjects = Array.from(
    new Set(entries.map((e) => e.subject).filter((s) => s !== "unspecified")),
  );
  const subjStr = subjects.length > 0
    ? subjects.map((s) => capitalize(s.replace(/_/g, " "))).join(", ")
    : "various";
  return `Day log saved for ${schoolDayISO}. ${entries.length} block${entries.length === 1 ? "" : "s"}, ${totalMin} min total. Subjects: ${subjStr}.`;
}

export function buildAdultQuickEntryPayload(
  schoolDayISO: string,
  lines: readonly QuickEntryLine[],
): AdultQuickEntryPayload {
  if (typeof schoolDayISO !== "string" || !ISO_DATE_RE.test(schoolDayISO)) {
    throw new Error(
      `buildAdultQuickEntryPayload: schoolDayISO must be YYYY-MM-DD, got ${JSON.stringify(schoolDayISO)}`,
    );
  }
  if (!Array.isArray(lines)) {
    throw new Error("buildAdultQuickEntryPayload: lines must be an array");
  }
  const actualEntries: ActualAgendaEntry[] = [];
  for (const line of lines) {
    if (!line || typeof line.rawLine !== "string") continue;
    const raw = line.rawLine.trim();
    if (raw.length === 0) continue;
    const subject = detectSubject(raw);
    const minutes = detectMinutes(raw);
    const outcome = detectOutcome(raw);
    actualEntries.push({
      schoolDayISO,
      plannedBlockId: line.plannedBlockId,
      subject,
      rawLine: raw,
      minutesSpent: minutes,
      outcome,
      displayLabel: buildDisplayLabel(subject, minutes, outcome),
      whatTheyDid: buildWhatTheyDid(raw),
    });
  }
  const driveEnqueue: DriveDayLogEnqueue = {
    targetFolder: "day_log",
    fileBaseName: `Reagan-day-log-${schoolDayISO}`,
    markdownBody: buildMarkdownBody(schoolDayISO, actualEntries),
  };
  return {
    schoolDayISO,
    actualEntries,
    driveEnqueue,
    notificationBody: buildNotificationBody(schoolDayISO, actualEntries),
  };
}
