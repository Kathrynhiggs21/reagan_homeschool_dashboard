/**
 * Wave-15 / Push 243 — kiwiVoiceAuditWeeklySummary
 *
 * Pure deterministic rollup over a window of KiwiVoiceAuditEntry
 * rows. Used by the at-a-glance card on the adult review page so
 * Mom and Grandma can see "the guards caught 4 things this week"
 * without having to scroll the full audit list.
 *
 * Adult-tone copy rules enforced:
 *  - No exclamation marks anywhere in the output strings
 *  - No emotional language ("alarming" / "worrying" / "bad" etc.)
 *  - Forbidden voice words never appear in summary copy (the
 *    individual entries' originalCandidate field naturally may
 *    contain them — that's a separate channel, not the summary)
 *
 * Input: array of KiwiVoiceAuditEntry rows (typically the last
 * 7 days, but the helper is window-agnostic).
 *
 * Returned shape:
 *   - totals.{info, minor, major}
 *   - majorPercent (rounded to 1 decimal place)
 *   - actionCounts.{drift_fallback, nickname_redact, length_cap}
 *   - topRedactedNicknames: [{nickname, count}, ...] (top 5)
 *   - latestMajorSamples: [{timestampUtcMs, originalCandidate}, ...] (last 3)
 *   - headlineLine: one-sentence adult-tone summary string
 */

import type {
  KiwiVoiceAuditEntry,
  KiwiAuditAction,
} from "./kiwiVoiceAuditLogger";

export interface KiwiVoiceAuditWeeklySummary {
  windowEntryCount: number;
  totals: { info: number; minor: number; major: number };
  majorPercent: number;
  actionCounts: {
    drift_fallback: number;
    nickname_redact: number;
    length_cap: number;
  };
  topRedactedNicknames: { nickname: string; count: number }[];
  latestMajorSamples: { timestampUtcMs: number; originalCandidate: string }[];
  headlineLine: string;
}

/** Extract a lowercase nickname token from a nickname_redact summary. */
function extractNickname(action: KiwiAuditAction): string | null {
  if (action.kind !== "nickname_redact") return null;
  // Summary format from Push 232: "Removed pet-name address: sweetie."
  const m = action.summary.match(/:\s*([^.]+?)\s*\.?$/);
  if (!m || !m[1]) return null;
  return m[1].trim().toLowerCase();
}

export function summarizeKiwiVoiceAuditWindow(
  entries: KiwiVoiceAuditEntry[],
): KiwiVoiceAuditWeeklySummary {
  const safe = Array.isArray(entries) ? entries : [];
  const totals = { info: 0, minor: 0, major: 0 };
  const actionCounts = {
    drift_fallback: 0,
    nickname_redact: 0,
    length_cap: 0,
  };
  const nicknameTally = new Map<string, number>();
  const majorSamples: { timestampUtcMs: number; originalCandidate: string }[] = [];

  for (const e of safe) {
    if (!e || typeof e !== "object") continue;
    const sev = e.severity;
    if (sev === "info" || sev === "minor" || sev === "major") {
      totals[sev] += 1;
    }
    if (sev === "major") {
      majorSamples.push({
        timestampUtcMs: Number.isFinite(e.timestampUtcMs)
          ? Math.floor(e.timestampUtcMs)
          : 0,
        originalCandidate:
          typeof e.originalCandidate === "string" ? e.originalCandidate : "",
      });
    }
    const actions = Array.isArray(e.actions) ? e.actions : [];
    for (const a of actions) {
      if (a && (a.kind === "drift_fallback" || a.kind === "nickname_redact" || a.kind === "length_cap")) {
        actionCounts[a.kind] += 1;
      }
      const nick = a ? extractNickname(a) : null;
      if (nick) {
        nicknameTally.set(nick, (nicknameTally.get(nick) ?? 0) + 1);
      }
    }
  }

  const total = totals.info + totals.minor + totals.major;
  const majorPercent =
    total === 0 ? 0 : Math.round((totals.major / total) * 1000) / 10;

  const topRedactedNicknames = Array.from(nicknameTally.entries())
    .map(([nickname, count]) => ({ nickname, count }))
    .sort((a, b) => (b.count - a.count) || a.nickname.localeCompare(b.nickname))
    .slice(0, 5);

  const latestMajorSamples = majorSamples
    .sort((a, b) => b.timestampUtcMs - a.timestampUtcMs)
    .slice(0, 3);

  // Adult-tone single-line headline. No exclamation marks. No
  // emotional language. State the count and call it done.
  let headlineLine: string;
  if (total === 0) {
    headlineLine = "No Kiwi replies recorded in this window.";
  } else if (totals.major === 0 && totals.minor === 0) {
    headlineLine = `${total} replies. Guards did not change any of them.`;
  } else {
    const changed = totals.minor + totals.major;
    headlineLine = `${total} replies. Guards adjusted ${changed} of them (${totals.major} fallbacks, ${totals.minor} minor edits).`;
  }

  return {
    windowEntryCount: total,
    totals,
    majorPercent,
    actionCounts,
    topRedactedNicknames,
    latestMajorSamples,
    headlineLine,
  };
}
