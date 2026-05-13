/**
 * Push 112 (2026-05-13) — Grandma SMS digest summary pure helper.
 *
 * In addition to the email digest (Push 109), Grandma is on the SMS
 * push recipient list. Carriers cap a single SMS at 160 GSM-7 chars
 * before fragmentation, so this helper renders the *bare-essentials*
 * weekly snapshot as one line that fits.
 *
 * Tone: same Grandma framing as the email — "Reagan's week" not "your
 * grand-daughter's school". Always mentions IEP paper-trail or "see
 * dashboard" so Grandma knows where to drill in.
 *
 * Pure module — no DB, no I/O. Caller passes the snapshot.
 */

const SMS_MAX = 160;

export interface GrandmaSmsSnapshot {
  weekStartIso: string; // YYYY-MM-DD or full ISO
  weekEndIso: string;
  totalHours: number; // sum across subjects
  /** Already a 0..1 share. */
  greenShare: number;
  /** Already a 0..1 share. */
  redShare: number;
  /** Optional one-word headline ("Strong week", "Tough week", ...). */
  headline?: string;
  /** Optional drill-in URL; trimmed off if it would push past 160. */
  dashboardUrl?: string;
}

export interface GrandmaSmsRender {
  text: string;
  truncated: boolean;
  /** Why we truncated; useful for QA logs. */
  truncationReason?: "url-dropped" | "headline-dropped" | "body-trimmed";
}

function pct(share: number): string {
  if (!Number.isFinite(share)) return "?%";
  const clamped = Math.max(0, Math.min(1, share));
  return `${Math.round(clamped * 100)}%`;
}

function dateOnly(iso: string): string {
  return (iso ?? "").slice(0, 10);
}

export function renderGrandmaSmsDigest(
  snapshot: GrandmaSmsSnapshot,
): GrandmaSmsRender {
  const range = `${dateOnly(snapshot.weekStartIso)}–${dateOnly(snapshot.weekEndIso)}`;
  const hours =
    Number.isFinite(snapshot.totalHours) && snapshot.totalHours >= 0
      ? snapshot.totalHours.toFixed(1)
      : "0.0";

  const headline = (snapshot.headline ?? "").trim();
  const headlineSegment = headline.length > 0 ? ` ${headline}.` : "";

  // Canonical body. Always includes the IEP-paper-trail framing tag.
  const baseBody =
    `Reagan ${range}: ${hours}h logged, ` +
    `mood ${pct(snapshot.greenShare)} green / ${pct(snapshot.redShare)} red.${headlineSegment}` +
    ` (IEP paper-trail)`;

  const url = (snapshot.dashboardUrl ?? "").trim();

  // Try with URL appended.
  if (url.length > 0) {
    const withUrl = `${baseBody} ${url}`;
    if (withUrl.length <= SMS_MAX) {
      return { text: withUrl, truncated: false };
    }
    // Drop URL first.
    if (baseBody.length <= SMS_MAX) {
      return {
        text: baseBody,
        truncated: true,
        truncationReason: "url-dropped",
      };
    }
  } else if (baseBody.length <= SMS_MAX) {
    return { text: baseBody, truncated: false };
  }

  // Try dropping headline.
  const noHeadline =
    `Reagan ${range}: ${hours}h logged, mood ${pct(snapshot.greenShare)} green / ${pct(snapshot.redShare)} red. (IEP paper-trail)`;
  if (noHeadline.length <= SMS_MAX) {
    return {
      text: noHeadline,
      truncated: true,
      truncationReason: "headline-dropped",
    };
  }

  // Last resort: hard trim with ellipsis.
  return {
    text: noHeadline.slice(0, SMS_MAX - 1) + "…",
    truncated: true,
    truncationReason: "body-trimmed",
  };
}
