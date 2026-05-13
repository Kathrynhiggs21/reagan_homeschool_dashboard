/**
 * Push 86 (2026-05-13) — Kid-side daily report renderer.
 *
 * Produces a calm, mobile-friendly HTML page that Grandma (or Mom) can
 * read after the day to see what Reagan actually did. Designed for the
 * "off-school" and "tutor-day" cases when Reagan isn't with Mom — these
 * are the days Grandma most needs a recap without opening the dashboard.
 *
 * Pure function: no DB reads, no LLM calls, no side effects. The caller
 * (a future tRPC procedure) is responsible for assembling the payload
 * from `actualVsPlannedForDate` + the mood entry for the day.
 */

export interface DailyReportBlock {
  /** Subject slug (math, ela, science, …). */
  subjectSlug: string;
  /** Block title as Reagan saw it. */
  title: string;
  /** Topic actually covered ("Fractions: equivalent fractions"). */
  topic?: string;
  /** Local time-of-day label ("9:30 AM"). Optional. */
  timeLabel?: string;
  /** Whether the block was completed (vs skipped). Defaults to true. */
  done?: boolean;
  /** True for off-plan rows (captured outside planned curriculum). */
  offPlan?: boolean;
}

export interface DailyReportInput {
  /** ISO date (YYYY-MM-DD) being reported. */
  dateISO: string;
  /** Friendly label for the day's caretaker. "Grandma", "Madison", etc. */
  caretakerLabel: string;
  /** Reagan's own short mood note, if she left one. */
  moodNote?: string;
  /** One-letter mood zone (g/y/r/b) or null. */
  moodZone?: "green" | "yellow" | "red" | "blue" | null;
  /** Completed planned blocks. */
  plannedBlocks: ReadonlyArray<DailyReportBlock>;
  /** Off-plan topics captured during the day. */
  offPlanTopics: ReadonlyArray<DailyReportBlock>;
  /** Optional coin total earned today (for the warm closing line). */
  coinsEarned?: number;
}

const ZONE_COLOR: Record<string, { bg: string; ink: string; label: string }> = {
  green: { bg: "#dcfce7", ink: "#166534", label: "Green zone" },
  yellow: { bg: "#fef9c3", ink: "#854d0e", label: "Yellow zone" },
  red: { bg: "#fee2e2", ink: "#991b1b", label: "Red zone" },
  blue: { bg: "#dbeafe", ink: "#1e40af", label: "Blue zone" },
};

const SUBJECT_LABEL: Record<string, string> = {
  math: "Math",
  ela: "ELA",
  science: "Science",
  social: "Social Studies",
  specials: "Specials",
  other: "Other",
};

/**
 * Renders the daily report as a self-contained HTML fragment. The caller
 * wraps it in a <html><body> envelope (email vs printable PDF can choose
 * their own outer chrome).
 */
export function renderDailyReport(input: DailyReportInput): string {
  const lines: string[] = [];
  const friendlyDate = formatFriendlyDate(input.dateISO);
  lines.push(
    `<section style="font-family:system-ui,-apple-system,sans-serif;color:#1f2937;padding:16px;max-width:520px;margin:0 auto;">`,
  );
  lines.push(
    `<h2 style="margin:0 0 4px 0;font-size:20px;color:#0f172a;">Reagan's day · ${escapeHtml(friendlyDate)}</h2>`,
  );
  lines.push(
    `<p style="margin:0 0 12px 0;font-size:13px;color:#475569;">With ${escapeHtml(input.caretakerLabel)}</p>`,
  );

  // Mood strip
  if (input.moodZone) {
    const c = ZONE_COLOR[input.moodZone];
    if (c) {
      lines.push(
        `<div style="background:${c.bg};color:${c.ink};border-radius:12px;padding:10px 12px;margin-bottom:12px;font-size:14px;">`,
      );
      lines.push(`<b>${escapeHtml(c.label)}</b>`);
      if (input.moodNote) {
        lines.push(` · ${escapeHtml(input.moodNote)}`);
      }
      lines.push(`</div>`);
    }
  }

  // Planned blocks
  if (input.plannedBlocks.length > 0) {
    lines.push(
      `<h3 style="margin:16px 0 6px 0;font-size:15px;color:#0f172a;">What Reagan worked on</h3>`,
    );
    lines.push(`<ul style="padding-left:18px;margin:0;">`);
    for (const b of input.plannedBlocks) {
      lines.push(renderBlockLi(b));
    }
    lines.push(`</ul>`);
  } else {
    lines.push(
      `<p style="margin:12px 0;color:#64748b;font-style:italic;">No planned blocks were recorded today.</p>`,
    );
  }

  // Off-plan
  if (input.offPlanTopics.length > 0) {
    lines.push(
      `<h3 style="margin:16px 0 6px 0;font-size:15px;color:#0f172a;">Off-plan topics covered</h3>`,
    );
    lines.push(`<ul style="padding-left:18px;margin:0;">`);
    for (const b of input.offPlanTopics) {
      lines.push(renderBlockLi({ ...b, offPlan: true }));
    }
    lines.push(`</ul>`);
  }

  // Closing
  if (typeof input.coinsEarned === "number" && input.coinsEarned > 0) {
    lines.push(
      `<p style="margin:16px 0 0 0;font-size:14px;color:#1f3a2e;">She earned <b>${input.coinsEarned}</b> coin${input.coinsEarned === 1 ? "" : "s"} today.</p>`,
    );
  }
  lines.push(
    `<p style="margin:16px 0 0 0;font-size:12px;color:#94a3b8;">Sent automatically · Reply with corrections and Mom will see them.</p>`,
  );
  lines.push(`</section>`);
  return lines.join("");
}

function renderBlockLi(b: DailyReportBlock): string {
  const subj = SUBJECT_LABEL[b.subjectSlug] ?? b.subjectSlug;
  const time = b.timeLabel ? `<span style="color:#94a3b8;"> · ${escapeHtml(b.timeLabel)}</span>` : "";
  const tag = b.offPlan
    ? `<span style="background:#fef3c7;color:#854d0e;border-radius:6px;padding:1px 6px;font-size:11px;margin-left:6px;">off-plan</span>`
    : b.done === false
      ? `<span style="background:#fee2e2;color:#991b1b;border-radius:6px;padding:1px 6px;font-size:11px;margin-left:6px;">skipped</span>`
      : "";
  const topic = b.topic ? ` — ${escapeHtml(b.topic)}` : "";
  return `<li style="margin:4px 0;font-size:14px;"><b>${escapeHtml(subj)}</b>: ${escapeHtml(b.title)}${topic}${tag}${time}</li>`;
}

function formatFriendlyDate(iso: string): string {
  // ISO YYYY-MM-DD → "Wed, May 13"
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const date = new Date(y, mo, d);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
