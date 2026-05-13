/**
 * Push 70 (2026-05-13) — Slice 5 Sunday digest preview renderer.
 *
 * Pure render — takes the weeklyDigests `payload` object that
 * buildWeeklyDigest already produces and turns it into a calm,
 * mobile-readable HTML string. No DB calls, no LLM, no email send.
 *
 * The renderer is intentionally minimal so it can be:
 *   - served from a Mom-only tRPC preview route (Push 70),
 *   - reused later as the body of an actual Sunday email,
 *   - covered with vitest contract assertions on shape + sections.
 *
 * Sections:
 *   1. Header (date range + generatedAt).
 *   2. Highlights row: levelUps, tutor sessions, flags, mood arc.
 *   3. Subjects (one row per subject summary).
 *   4. What helped (top 5 from whatHelped).
 *   5. Indian Hill alignment topics this week (read-only mirror).
 *   6. Summer banner (only when summerActive=true is passed in).
 */

export interface SundayDigestPayload {
  weekStart: string;
  weekEnd: string;
  levelUps?: Array<{ title: string; category?: string; when?: string }>;
  tutorSessionsCount?: number;
  flagsCount?: number;
  moodArc?: { hard: number; ok: number; easy: number; total: number };
  whatHelped?: Array<{ helper: string; count: number }>;
  subjectSummary?: Array<{
    subject: string;
    avgConfidence: number;
    avgLevel: number;
    skillsTracked: number;
  }>;
  ihAlignment?: Array<{ subject: string; topic: string }>;
  generatedAt?: string;
}

export interface SundayDigestOptions {
  summerActive?: boolean;
  studentName?: string;
  /** Recipients shown in the digest header so Mom + Grandma both know they're on it. */
  recipients?: string[];
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

export function renderSundayDigestHtml(
  payload: SundayDigestPayload,
  opts: SundayDigestOptions = {},
): string {
  const name = opts.studentName ?? "Reagan";
  const ws = fmtDate(payload.weekStart);
  const we = fmtDate(payload.weekEnd);
  const recipients = opts.recipients ?? [];
  const recipientsLine =
    recipients.length > 0
      ? `<p style="color:#6b7280;margin:0 0 12px 0;font-size:12px">Recipients: ${recipients
          .map((r) => esc(r))
          .join(", ")}</p>`
      : "";

  // Section: Highlights row
  const levelUpsN = payload.levelUps?.length ?? 0;
  const tutorN = payload.tutorSessionsCount ?? 0;
  const flagsN = payload.flagsCount ?? 0;
  const mood = payload.moodArc ?? { hard: 0, ok: 0, easy: 0, total: 0 };

  // Section: subject summary rows
  const subjectsHtml =
    (payload.subjectSummary ?? [])
      .map(
        (s) =>
          `<tr><td>${esc(s.subject)}</td><td>${s.avgLevel}</td><td>${s.avgConfidence}%</td><td>${s.skillsTracked}</td></tr>`,
      )
      .join("") || `<tr><td colspan="4" style="color:#6b7280">No subject data this week.</td></tr>`;

  // Section: what helped
  const whatHelpedHtml =
    (payload.whatHelped ?? [])
      .map((w) => `<li>${esc(w.helper)} <span style="color:#6b7280">(${w.count})</span></li>`)
      .join("") || `<li style="color:#6b7280">No notes captured yet.</li>`;

  // Section: IH alignment (read-only mirror)
  const ihHtml =
    (payload.ihAlignment ?? [])
      .map((i) => `<li><strong>${esc(i.subject)}</strong> — ${esc(i.topic)}</li>`)
      .join("") || `<li style="color:#6b7280">No mirrored topics this week.</li>`;

  // Section: summer banner
  const summerBanner = opts.summerActive
    ? `<div style="background:#fef3c7;border:1px solid #f59e0b;padding:8px 12px;border-radius:6px;margin-bottom:12px">☀️ Summer mode — choice blocks counted.</div>`
    : "";

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(name)}'s Sunday Digest</title></head>
<body style="font-family:system-ui,-apple-system,sans-serif;max-width:680px;margin:0 auto;padding:16px;color:#1f2937">
  <h1 style="margin:0 0 4px 0;font-size:22px">${esc(name)}'s week — ${ws} → ${we}</h1>
  <p style="color:#6b7280;margin:0 0 4px 0;font-size:13px">Generated ${esc(payload.generatedAt ?? "")}</p>
  ${recipientsLine}
  ${summerBanner}

  <h2 style="font-size:16px;margin:20px 0 8px 0">Highlights</h2>
  <div style="display:flex;gap:8px;flex-wrap:wrap">
    <div style="background:#ecfdf5;padding:8px 12px;border-radius:6px"><strong>${levelUpsN}</strong> level-ups</div>
    <div style="background:#eff6ff;padding:8px 12px;border-radius:6px"><strong>${tutorN}</strong> tutor sessions</div>
    <div style="background:#fef2f2;padding:8px 12px;border-radius:6px"><strong>${flagsN}</strong> flags</div>
    <div style="background:#f5f3ff;padding:8px 12px;border-radius:6px">
      Mood: <strong>${mood.easy}</strong> easy · <strong>${mood.ok}</strong> ok · <strong>${mood.hard}</strong> hard
    </div>
  </div>

  <h2 style="font-size:16px;margin:20px 0 8px 0">Subjects</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    <thead><tr style="text-align:left;color:#6b7280">
      <th style="padding:4px 8px">Subject</th><th style="padding:4px 8px">Avg level</th>
      <th style="padding:4px 8px">Avg confidence</th><th style="padding:4px 8px">Skills tracked</th>
    </tr></thead>
    <tbody>${subjectsHtml}</tbody>
  </table>

  <h2 style="font-size:16px;margin:20px 0 8px 0">What helped</h2>
  <ul style="padding-left:18px;margin:0">${whatHelpedHtml}</ul>

  <h2 style="font-size:16px;margin:20px 0 8px 0">Indian Hill 5th-grade topics this week (read-only)</h2>
  <ul style="padding-left:18px;margin:0">${ihHtml}</ul>

  <p style="color:#6b7280;font-size:12px;margin-top:24px">
    Sunday Digest · Mom + Grandma recipients · preview pane.
  </p>
</body></html>`;
}
