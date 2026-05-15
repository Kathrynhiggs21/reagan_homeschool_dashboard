/**
 * Wave-15 / Push 188 — vaultRotationDue
 *
 * PURE deterministic helper. No I/O, no DB, no network. Takes a list of
 * AppAccountVaultEntry rows (from Push 186) plus the current ISO timestamp,
 * and buckets them into:
 *   - overdue   : rows whose rotateDays cadence has already elapsed
 *                 since createdAtIso.
 *   - dueSoon   : rows whose next rotation lands within the next 7 days.
 *   - healthy   : everything else.
 *
 * Behavior rules (matches the rest of Wave-14/15):
 *  - Rows with rotateDays===null are SKIPPED entirely (kid-managed
 *    Reagan rows + class_code rows). They never appear in any bucket.
 *  - Rows that point at the blocked email reagan.higgs33@ihsd.us are
 *    SKIPPED even if rotateDays is set — they shouldn't have been
 *    persisted in the first place; defense in depth.
 *  - Rows where visibleToReagan===true are SKIPPED — Reagan's own logins
 *    aren't a parent-rotation concern.
 *  - Never punitive: returns kid-safe summary strings for the adult-only
 *    dashboard. Reagan never sees this; helper does not produce a kid
 *    string at all.
 *  - The headline string is plural-safe ("1 login" vs "3 logins") and
 *    omits the "dueSoon" half when zero (and same for overdue).
 *  - Stable sort: each bucket is sorted by daysUntilRotation ascending,
 *    then by appKey ascending for tie-break (deterministic output).
 *
 * Reagan-callable: NO. This is adult-only by definition. A future tRPC
 * procedure (Push 189) will wire this as an adminProcedure query.
 */

export type SignInMethod = "google_sso" | "email_password" | "class_code";
export type AccountRole = "reagan" | "mom" | "grandma" | "dad" | "none";

export interface AppAccountVaultEntry {
  appKey: string;
  appName: string;
  signInMethod: SignInMethod;
  ownerRole: AccountRole;
  ownerEmail: string | null;
  secretCiphertext: string;
  rotateDays: number | null;
  visibleToReagan: boolean;
  kidSafeLabel: string;
  createdAtIso: string;
  adultNote: string;
}

export interface VaultRotationItem {
  appKey: string;
  appName: string;
  ownerRole: AccountRole;
  ownerEmail: string | null;
  signInMethod: SignInMethod;
  rotateDays: number;
  /** Negative = overdue, 0..7 = dueSoon, >7 = healthy. */
  daysUntilRotation: number;
  /** ISO of when this row should next be rotated. */
  nextRotationDueIso: string;
  /** Short adult-facing label ("Mom's Khan Academy login"). */
  adultLabel: string;
}

export interface VaultRotationDueResult {
  overdue: VaultRotationItem[];
  dueSoon: VaultRotationItem[];
  healthy: VaultRotationItem[];
  /** "3 logins need a fresh password this week." or similar. Null when nothing to surface. */
  adultHeadline: string | null;
  /** Total rows considered (after skip-list applied). */
  considered: number;
}

const BLOCKED_EMAIL = "reagan.higgs33@ihsd.us";
const MS_PER_DAY = 86_400_000;

function shouldSkip(row: AppAccountVaultEntry): boolean {
  if (row.rotateDays === null) return true;
  if (row.ownerEmail === BLOCKED_EMAIL) return true;
  if (row.visibleToReagan === true) return true;
  return false;
}

function roleWord(role: AccountRole): string {
  if (role === "reagan") return "Reagan";
  if (role === "mom") return "Mom";
  if (role === "grandma") return "Grandma";
  if (role === "dad") return "Dad";
  return "Shared";
}

function pluralLogins(n: number): string {
  return n === 1 ? "1 login" : `${n} logins`;
}

function buildHeadline(overdueN: number, dueSoonN: number): string | null {
  if (overdueN === 0 && dueSoonN === 0) return null;
  const parts: string[] = [];
  if (overdueN > 0) parts.push(`${pluralLogins(overdueN)} overdue for a fresh password`);
  if (dueSoonN > 0) parts.push(`${pluralLogins(dueSoonN)} due within the next week`);
  return parts.join(" · ") + ".";
}

export interface ComputeVaultRotationDueInput {
  rows: AppAccountVaultEntry[];
  nowIso: string;
}

export function computeVaultRotationDue(
  input: ComputeVaultRotationDueInput
): VaultRotationDueResult {
  const { rows, nowIso } = input;
  const nowMs = Date.parse(nowIso);
  if (Number.isNaN(nowMs)) {
    return {
      overdue: [],
      dueSoon: [],
      healthy: [],
      adultHeadline: null,
      considered: 0,
    };
  }

  const overdue: VaultRotationItem[] = [];
  const dueSoon: VaultRotationItem[] = [];
  const healthy: VaultRotationItem[] = [];
  let considered = 0;

  for (const row of rows) {
    if (shouldSkip(row)) continue;
    // rotateDays is non-null here per shouldSkip.
    const rotateDays = row.rotateDays as number;
    if (!Number.isFinite(rotateDays) || rotateDays <= 0) continue;

    const createdMs = Date.parse(row.createdAtIso);
    if (Number.isNaN(createdMs)) continue;

    considered += 1;
    const dueMs = createdMs + rotateDays * MS_PER_DAY;
    const daysUntil = Math.floor((dueMs - nowMs) / MS_PER_DAY);
    const adultLabel = `${roleWord(row.ownerRole)}'s ${row.appName} login`;
    const item: VaultRotationItem = {
      appKey: row.appKey,
      appName: row.appName,
      ownerRole: row.ownerRole,
      ownerEmail: row.ownerEmail,
      signInMethod: row.signInMethod,
      rotateDays,
      daysUntilRotation: daysUntil,
      nextRotationDueIso: new Date(dueMs).toISOString(),
      adultLabel,
    };

    if (daysUntil < 0) overdue.push(item);
    else if (daysUntil <= 7) dueSoon.push(item);
    else healthy.push(item);
  }

  const stableSort = (a: VaultRotationItem, b: VaultRotationItem) =>
    a.daysUntilRotation - b.daysUntilRotation ||
    a.appKey.localeCompare(b.appKey);
  overdue.sort(stableSort);
  dueSoon.sort(stableSort);
  healthy.sort(stableSort);

  return {
    overdue,
    dueSoon,
    healthy,
    adultHeadline: buildHeadline(overdue.length, dueSoon.length),
    considered,
  };
}

export const __FOR_TEST__ = {
  BLOCKED_EMAIL,
  MS_PER_DAY,
  shouldSkip,
  roleWord,
  pluralLogins,
  buildHeadline,
};
