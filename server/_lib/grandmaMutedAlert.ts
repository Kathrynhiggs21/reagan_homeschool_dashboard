/**
 * Push 133 (2026-05-13) — "Grandma muted this week" alert helper.
 *
 * Standing rule (project memory):
 *   - Grandma is a permanent recipient of the Sunday digest by default.
 *   - Mom can mute her for a given week, but the dashboard MUST raise an
 *     adult-tier banner so it doesn't silently drift into "Grandma stops
 *     getting updates" without Mom noticing.
 *
 * This helper decides whether the Mom-side banner should fire, and what
 * it should say. Adult-only audience (never shown to Reagan or tutors).
 *
 * Pure module — caller passes mute history + this-week digest plan, gets
 * back a typed outcome.
 */

import { isGrandmaEmail } from "./grandmaAudience";

export interface GrandmaMutedAlertInput {
  /**
   * Active recipients on this week's Sunday digest (already after applying
   * the Grandma toggle). Email lowercased.
   */
  thisWeekRecipientEmails: ReadonlyArray<string>;
  /**
   * Recent weeks (most recent first) of mute history — true=muted that week,
   * false=delivered. Caller passes whatever window is configured (typically
   * the last 4 Sundays). Empty array = no history yet.
   */
  recentMuteHistoryNewestFirst: ReadonlyArray<boolean>;
  /** YYYY-MM-DD of the Sunday this digest is for. */
  thisWeekSundayIso: string;
  /** Audience tier of the requestor. Banner only fires for Mom/family-admin. */
  audienceTier: "kid" | "tutor" | "mom" | "grandma" | "adult";
}

export type GrandmaMutedAlertOutcome =
  | { kind: "hidden"; reason: HiddenReason }
  | {
      kind: "alert";
      severity: "info" | "warn" | "critical";
      headline: string;
      body: string;
      auditTag: string;
    };

export type HiddenReason =
  | "wrong-audience"
  | "grandma-still-on-list"
  | "bad-date";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isMomAudience(tier: GrandmaMutedAlertInput["audienceTier"]): boolean {
  return tier === "mom" || tier === "adult";
}

function consecutiveMutesFromNewest(history: ReadonlyArray<boolean>): number {
  let count = 0;
  for (const muted of history) {
    if (muted) count += 1;
    else break;
  }
  return count;
}

export function decideGrandmaMutedAlert(
  input: GrandmaMutedAlertInput,
): GrandmaMutedAlertOutcome {
  if (!ISO_DATE.test(input.thisWeekSundayIso)) {
    return { kind: "hidden", reason: "bad-date" };
  }
  if (!isMomAudience(input.audienceTier)) {
    return { kind: "hidden", reason: "wrong-audience" };
  }

  // If any current recipient is a Grandma email, she's not muted this week.
  const grandmaOnList = input.thisWeekRecipientEmails
    .map((e) => e.toLowerCase().trim())
    .some((e) => isGrandmaEmail(e));
  if (grandmaOnList) {
    return { kind: "hidden", reason: "grandma-still-on-list" };
  }

  // Grandma is muted this week. Severity escalates with consecutive mutes.
  const streak =
    consecutiveMutesFromNewest(input.recentMuteHistoryNewestFirst) + 1;
  // +1 because thisWeek itself counts as a muted week, even though
  // history excludes thisWeek by convention.

  if (streak >= 3) {
    return {
      kind: "alert",
      severity: "critical",
      headline: `Grandma has been muted ${streak} weeks in a row`,
      body:
        "She's the IEP-meeting paper-trail recipient — that's three Sundays " +
        "without an update. Re-enable her for this Sunday's digest in " +
        "Settings → Weekly Digest, or send her last Sunday's recap manually.",
      auditTag: `grandma-muted:streak=${streak}:critical`,
    };
  }

  if (streak === 2) {
    return {
      kind: "alert",
      severity: "warn",
      headline: "Grandma muted again this Sunday",
      body:
        "Second week in a row. Re-enable her for this Sunday's digest in " +
        "Settings → Weekly Digest if you didn't mean to.",
      auditTag: `grandma-muted:streak=${streak}:warn`,
    };
  }

  return {
    kind: "alert",
    severity: "info",
    headline: "Grandma muted this Sunday",
    body:
      "She won't get this week's digest. Re-enable her in Settings → " +
      "Weekly Digest if that wasn't intentional.",
    auditTag: `grandma-muted:streak=1:info`,
  };
}
