/**
 * Push 96 (2026-05-13) — Reagan kid-request preset list.
 *
 * Per Mom's "Reagan's Request Button Functionality": Reagan can send
 * messages to adults for assignment requests, adventure ideas, or
 * schedule changes. The KidRequestsCard surfaces these three categories
 * as one-tap presets so she doesn't have to type long messages.
 *
 * The kid-app uses the `kind` enum verbatim to route the request:
 *   - "assignment" → goes to RequestsInboxCard (Mom + Grandma)
 *     and the AI agenda editor as a suggested-add seed.
 *   - "adventure"  → also goes to inbox, tagged so Mom can drop it into
 *     the appropriate calendar slot.
 *   - "schedule"   → routes to approvals.submit with kind="schedule_change"
 *     so the never-queued / family-admin-only rules apply correctly.
 *
 * Pure module — no DB, no I/O — so the kid app and any preview cards
 * read from the SAME source of truth.
 */

export type ReaganRequestKind = "assignment" | "adventure" | "schedule";

export interface ReaganRequestPreset {
  kind: ReaganRequestKind;
  emoji: string;
  /** Big-button label on the kid card. Keep ≤ 28 chars. */
  label: string;
  /** Helper text under the label. */
  helperText: string;
  /** Default message body when she taps the preset (editable). */
  defaultMessage: string;
}

export const REAGAN_REQUEST_PRESETS: ReadonlyArray<ReaganRequestPreset> = [
  {
    kind: "assignment",
    emoji: "📚",
    label: "Ask for an assignment",
    helperText: "Want to learn something specific? Tell Mom or Grandma.",
    defaultMessage:
      "Hi! Could I have an assignment about ___? I'd like to learn more.",
  },
  {
    kind: "adventure",
    emoji: "🌳",
    label: "Suggest an adventure",
    helperText: "An idea for an outing or a project.",
    defaultMessage:
      "Adventure idea: ___. I think it would be fun because ___.",
  },
  {
    kind: "schedule",
    emoji: "🕒",
    label: "Ask to change my schedule",
    helperText: "Big changes need Mom and Grandma to say yes.",
    defaultMessage: "Could we change today's schedule? I'd like to ___.",
  },
];

/** Defensive lookup used by both the card and any approval routing. */
export function presetForKind(
  kind: ReaganRequestKind,
): ReaganRequestPreset {
  const found = REAGAN_REQUEST_PRESETS.find((p) => p.kind === kind);
  if (!found) throw new Error(`presetForKind: unknown kind "${kind}"`);
  return found;
}

/**
 * Map a kid-request kind to the approval-system kind string used by
 * approvals.submit. Returns null when the request does NOT route through
 * the approval queue (assignments + adventures just land in the inbox).
 */
export function approvalKindForRequest(
  kind: ReaganRequestKind,
): string | null {
  if (kind === "schedule") return "schedule_change";
  return null;
}
