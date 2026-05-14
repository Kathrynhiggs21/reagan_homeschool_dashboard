/**
 * Wave-15 / Push 186 — appAccountVaultEntry
 *
 * PURE deterministic helper. No I/O, no DB, no network. Converts an
 * AppLinkSignInTag (from Push 184 — appLinkSignInMethodTagger.ts) plus
 * the bytes an adult typed into the password field, into an adult-only
 * password-vault row ready to insert into the `passwordLocker` table.
 *
 * House rules baked in (matches the rest of Wave-14/15):
 *  - Never writes a row for the blocked IHSD email reagan.higgs33@ihsd.us.
 *    If a caller hands us a tag pinned to that email, return null.
 *  - reagan_role rows are always kid-managed: rotateDays=null (parents
 *    aren't going to force-rotate her Khan login every quarter), and
 *    visibleToReagan=true (she needs to be able to log herself in).
 *  - mom_role / grandma_role / dad_role rows are adult-only:
 *    visibleToReagan=false ALWAYS.
 *  - google_sso method ⇒ rotateDays=90 (Google Workspace cadence).
 *  - email_password method ⇒ rotateDays=180.
 *  - class_code method ⇒ rotateDays=null (codes rotate by school, not us).
 *  - kid-managed (preferredAccountRole==='reagan') ⇒ rotateDays=null
 *    regardless of method (overrides above).
 *  - Encryption itself stays out of this helper — caller passes an
 *    `encrypt(plaintext: string) => string` fn so the helper stays pure
 *    and unit-testable without crypto. Returned `secretCiphertext` is
 *    whatever that fn returned.
 *  - If `plaintext` is empty/whitespace, return null (no empty vault rows).
 *  - kidSafeLabel is the same as the AppLinkSignInTag's badge but with the
 *    role suffix dropped, so even if a vault export leaks into Reagan's
 *    view the words stay friendly ("Khan Academy" not "Khan Academy —
 *    Mom's account").
 *
 * Reagan-callable: NO. This is adult-only by definition. The corresponding
 * tRPC procedure (Push 187) is protectedProcedure + role==='admin' gated.
 */
export type SignInMethod = "google_sso" | "email_password" | "class_code";
export type AccountRole = "reagan" | "mom" | "grandma" | "dad" | "none";

export interface AppLinkSignInTag {
  /** Stable app key from the appLink row (e.g. "khan", "ixl", "pear_classes"). */
  key: string;
  /** Display name (e.g. "Khan Academy"). */
  name: string;
  /** Canonical sign-in method. */
  signInMethod: SignInMethod;
  /** Whose Google account / login this app is pinned to. */
  preferredAccountRole: AccountRole;
  /** Pinned email — may be null for class_code or "none" role. */
  preferredAccountEmail: string | null;
  /** Kid-readable one-liner (already sanitized). */
  badge: string;
  /** Adult note (null on Reagan view). */
  adultNote: string | null;
}

export interface AppAccountVaultEntry {
  /** Matches the appLink key — vault row is upserted on this. */
  appKey: string;
  /** Display name for adult vault list. */
  appName: string;
  signInMethod: SignInMethod;
  ownerRole: AccountRole;
  ownerEmail: string | null;
  /** Whatever the injected encrypt() returned. */
  secretCiphertext: string;
  /** 90 / 180 / null. */
  rotateDays: number | null;
  /** Adult vault row never surfaces to Reagan unless this is true. */
  visibleToReagan: boolean;
  /** Friendly label safe for Reagan view (no role suffix). */
  kidSafeLabel: string;
  /** ISO timestamp of when this entry was built. */
  createdAtIso: string;
  /** Adult-only note (audit-trail line). */
  adultNote: string;
}

export interface BuildAppAccountVaultEntryInput {
  tag: AppLinkSignInTag;
  plaintext: string;
  /** Pure encrypt fn — caller injects real crypto, tests pass identity. */
  encrypt: (plaintext: string) => string;
  /** Override clock for deterministic tests. */
  nowIso?: string;
}

const BLOCKED_EMAIL = "reagan.higgs33@ihsd.us";
const REAGAN_ALLOWED_EMAIL = "reaganhiggs910@gmail.com";

function rotateDaysFor(role: AccountRole, method: SignInMethod): number | null {
  // Kid-managed rows are never force-rotated.
  if (role === "reagan") return null;
  if (method === "class_code") return null;
  if (method === "google_sso") return 90;
  if (method === "email_password") return 180;
  return null;
}

function dropRoleSuffix(badge: string): string {
  // Push 184's badge looks like "Khan Academy — Mom's account" or
  // "Pear Classes — Grandma's account" or "BrainPOP — Reagan's account".
  // For the vault row's kidSafeLabel we strip everything from the em dash
  // (or " - " ASCII fallback) onward so Reagan only ever sees the app name.
  const emIdx = badge.indexOf(" — ");
  if (emIdx !== -1) return badge.slice(0, emIdx).trim();
  const dashIdx = badge.indexOf(" - ");
  if (dashIdx !== -1) return badge.slice(0, dashIdx).trim();
  return badge.trim();
}

export function buildAppAccountVaultEntry(
  input: BuildAppAccountVaultEntryInput
): AppAccountVaultEntry | null {
  const { tag, plaintext, encrypt, nowIso } = input;

  // Empty / whitespace plaintext → no row.
  if (typeof plaintext !== "string" || plaintext.trim().length === 0) {
    return null;
  }

  // Blocked email hard-block — never persist a row pinned to it.
  if (tag.preferredAccountEmail === BLOCKED_EMAIL) {
    return null;
  }

  // Reagan role with no email → sanitize to her allowed Gmail rather than
  // leaving null (matches Push 184's same rule).
  let ownerEmail: string | null = tag.preferredAccountEmail;
  if (tag.preferredAccountRole === "reagan" && ownerEmail === null) {
    ownerEmail = REAGAN_ALLOWED_EMAIL;
  }
  // Final safety: if anything else pointed at the blocked email, drop it.
  if (ownerEmail === BLOCKED_EMAIL) ownerEmail = null;

  const ciphertext = encrypt(plaintext);
  if (typeof ciphertext !== "string" || ciphertext.length === 0) {
    return null;
  }

  const rotate = rotateDaysFor(tag.preferredAccountRole, tag.signInMethod);
  const visibleToReagan = tag.preferredAccountRole === "reagan";

  const stamp = nowIso ?? new Date().toISOString();

  const roleWord =
    tag.preferredAccountRole === "reagan"
      ? "Reagan"
      : tag.preferredAccountRole === "mom"
        ? "Mom"
        : tag.preferredAccountRole === "grandma"
          ? "Grandma"
          : tag.preferredAccountRole === "dad"
            ? "Dad"
            : "shared";

  return {
    appKey: tag.key,
    appName: tag.name,
    signInMethod: tag.signInMethod,
    ownerRole: tag.preferredAccountRole,
    ownerEmail,
    secretCiphertext: ciphertext,
    rotateDays: rotate,
    visibleToReagan,
    kidSafeLabel: dropRoleSuffix(tag.badge) || tag.name,
    createdAtIso: stamp,
    adultNote: `${tag.name} — ${roleWord}'s account (${tag.signInMethod.replace("_", " ")}).`,
  };
}

export const __FOR_TEST__ = { BLOCKED_EMAIL, REAGAN_ALLOWED_EMAIL, rotateDaysFor, dropRoleSuffix };
