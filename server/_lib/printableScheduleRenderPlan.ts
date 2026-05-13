/**
 * Push 117 (2026-05-13) — Printable daily schedule render-plan helper.
 *
 * Pure helper that the Today page's "Print today" button uses to turn
 * the active agenda into a print-friendly section list:
 *   header  → date + Reagan + tutor of day (if any)
 *   blocks  → one printable line per agenda block (time, label, est minutes)
 *   resources → bullet list of attached worksheets / lessons / videos
 *   notes   → blank lines for offline writing (count adjustable)
 *   footer  → IEP paper-trail tag + "submit picture" reminder
 *
 * Tone rules from project knowledge:
 *  - Daily agenda must include worksheets (PDF), lessons (PDF), schedule,
 *    and est time limits.
 *  - Print view must be answerable offline and submittable as a picture.
 *  - Daily agenda includes the tutor's name and availability for the day.
 *
 * Pure module — no DB, no I/O.
 */

export interface AgendaBlockForPrint {
  startHHMM: string;
  durationMin: number;
  label: string;
  /** Subject tag for the block (math/ela/...). */
  subject?: string;
  /** Locked = printed but not editable on paper. */
  locked?: boolean;
}

export interface AttachedResource {
  kind: "worksheet" | "lesson" | "video" | "link";
  title: string;
  /** Optional URL (printed verbatim under the title). */
  url?: string;
}

export interface PrintableSchedulePlan {
  shouldShow: boolean;
  /** Reasons we wouldn't render anything (e.g., empty day). */
  emptyReason?: "no-blocks" | "no-date";
  header: {
    title: string; // "Reagan's Schedule — Wed May 13"
    tutorLine?: string; // "Tutor today: Madison (9:00–11:30)"
  };
  blocks: Array<{
    line: string; // "07:30  Math (45 min)"
    locked: boolean;
  }>;
  resources: string[]; // e.g. "Worksheet — Fractions practice (5 problems)"
  noteLines: number;
  footer: string;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function isHHMM(s: unknown): s is string {
  return typeof s === "string" && /^\d{2}:\d{2}$/.test(s);
}

function fmtPrettyDate(iso: string): string {
  // Parse YYYY-MM-DD from the front of the ISO string only.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const [, y, mo, d] = m;
  const dt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  if (Number.isNaN(dt.getTime())) return iso;
  const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
    dt.getUTCDay()
  ];
  const monthName = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ][dt.getUTCMonth()];
  return `${dayName} ${monthName} ${pad2(dt.getUTCDate())}`;
}

export function planPrintableSchedule(input: {
  dateIso: string;
  kidName?: string;
  blocks: ReadonlyArray<AgendaBlockForPrint>;
  resources?: ReadonlyArray<AttachedResource>;
  tutorOfDay?: { name: string; window?: string } | null;
  noteLines?: number;
}): PrintableSchedulePlan {
  const dateIso = typeof input.dateIso === "string" ? input.dateIso : "";
  const kidName = (input.kidName ?? "Reagan").trim() || "Reagan";

  if (!dateIso) {
    return {
      shouldShow: false,
      emptyReason: "no-date",
      header: { title: "" },
      blocks: [],
      resources: [],
      noteLines: 0,
      footer: "",
    };
  }
  const cleanBlocks: AgendaBlockForPrint[] = Array.isArray(input.blocks)
    ? input.blocks.filter(
        (b) =>
          b &&
          typeof b === "object" &&
          isHHMM(b.startHHMM) &&
          Number.isFinite(b.durationMin) &&
          b.durationMin > 0 &&
          typeof b.label === "string" &&
          b.label.trim().length > 0,
      )
    : [];

  if (cleanBlocks.length === 0) {
    return {
      shouldShow: false,
      emptyReason: "no-blocks",
      header: { title: `${kidName}'s Schedule — ${fmtPrettyDate(dateIso)}` },
      blocks: [],
      resources: [],
      noteLines: 0,
      footer: "",
    };
  }

  // Sort by start time (lexicographic on HH:MM works correctly).
  const sorted = [...cleanBlocks].sort((a, b) =>
    a.startHHMM.localeCompare(b.startHHMM),
  );

  const blocks = sorted.map((b) => ({
    line: `${b.startHHMM}  ${b.label.trim()} (${Math.floor(b.durationMin)} min)`,
    locked: b.locked === true,
  }));

  const resources = (input.resources ?? [])
    .filter(
      (r) =>
        r &&
        typeof r === "object" &&
        typeof r.title === "string" &&
        r.title.trim().length > 0,
    )
    .map((r) => {
      const kindLabel =
        r.kind === "worksheet"
          ? "Worksheet"
          : r.kind === "lesson"
          ? "Lesson"
          : r.kind === "video"
          ? "Video"
          : "Link";
      const base = `${kindLabel} — ${r.title.trim()}`;
      return r.url ? `${base} (${r.url})` : base;
    });

  const tutorLine =
    input.tutorOfDay && input.tutorOfDay.name
      ? `Tutor today: ${input.tutorOfDay.name}${
          input.tutorOfDay.window ? ` (${input.tutorOfDay.window})` : ""
        }`
      : undefined;

  const noteLines =
    Number.isFinite(input.noteLines) && (input.noteLines as number) >= 0
      ? Math.min(40, Math.floor(input.noteLines as number))
      : 6;

  return {
    shouldShow: true,
    header: {
      title: `${kidName}'s Schedule — ${fmtPrettyDate(dateIso)}`,
      tutorLine,
    },
    blocks,
    resources,
    noteLines,
    footer:
      "IEP paper-trail — answer offline, then submit a picture from the dashboard.",
  };
}
