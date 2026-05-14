/**
 * Push 183 (Wave-15, 2026-05-15) — Pear Classes / Giant Steps Library
 * appLink builder. Pure, deterministic, kid-readable, never throws.
 *
 * House rules encoded:
 *  - Allowed sign-in identity is ONLY spear.cpt@gmail.com (Mom).
 *  - reagan.higgs33@ihsd.us is hard-blocked (in `blockedEmails`); we never
 *    surface a sign-in URL using that account.
 *  - Reagan REQUESTS, never edits live — so when consent has not been
 *    granted yet we render a friendly "ask a grown-up" badge instead of
 *    a broken OAuth screen.
 *  - No timers, no greys, no jargon, no punitive language anywhere.
 *
 * Inputs are minimal so this helper can be called from either the
 * Today router or the Apps & Tools router without touching the DB.
 */

export type ConsentState = "granted" | "needs_grownup_signin" | "blocked";

export type PearClassesAppLinkInput = {
  /** Account currently signed in for Google SSO, lowercased. */
  signedInGoogleAccount?: string | null;
  /** Whether spear.cpt@gmail.com has completed the one-time OAuth grant. */
  oauthConsentGranted?: boolean;
  /** Reagan-side viewer flag — when true we hide adult-only details. */
  isReaganView?: boolean;
};

export type PearClassesAppLinkOutput = {
  /** Stable key — used as the appLinks row dedupe key + UI React key. */
  key: "pear_classes_giant_steps";
  /** Kid-readable label that fits on a small tap target. */
  label: string;
  /** Public landing page — same URL Mom logs into. */
  url: "https://support.giantsteps.app/s/my-library";
  /** Category — used to group with Khan / IXL on the reading rail. */
  category: "reading";
  /** Sign-in method — drives the icon next to the chip. */
  signInMethod: "google_sso";
  /** Allowed identity (single canonical Mom account). */
  allowedAccount: "spear.cpt@gmail.com";
  /** Suggested rail position — grouped with Khan / IXL reading helpers. */
  railGroup: "reading_helpers";
  sortOrder: number;
  /** Resolved consent state — drives the badge / disabled chip on Today. */
  consentState: ConsentState;
  /** Kid-readable badge line. Always non-empty, always opt-in language. */
  kidBadge: string;
  /** Adult-side note — null on Reagan view to honor "Don't show if no info". */
  adultNote: string | null;
  /**
   * Whether Reagan can tap "Open" right now without an adult intervening.
   * False when consent missing or a blocked account is signed in.
   */
  canKidOpenNow: boolean;
};

const ALLOWED = "spear.cpt@gmail.com";
const BLOCKED_EMAILS = new Set<string>([
  "reagan.higgs33@ihsd.us",
]);

function normalizeEmail(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.length === 0) return null;
  return trimmed;
}

export function computePearClassesAppLink(
  input: PearClassesAppLinkInput = {},
): PearClassesAppLinkOutput {
  const signed = normalizeEmail(input.signedInGoogleAccount);
  const consentGranted = input.oauthConsentGranted === true;
  const isKid = input.isReaganView === true;

  let consentState: ConsentState;
  if (signed && BLOCKED_EMAILS.has(signed)) {
    consentState = "blocked";
  } else if (signed === ALLOWED && consentGranted) {
    consentState = "granted";
  } else {
    // Either nobody is signed in, the wrong (but not blocked) account is
    // signed in, or Mom hasn't completed the one-time OAuth consent yet.
    consentState = "needs_grownup_signin";
  }

  let kidBadge: string;
  let adultNote: string | null;
  let canKidOpenNow: boolean;

  switch (consentState) {
    case "granted":
      kidBadge = "Open Pear Classes";
      adultNote = isKid ? null : `Signed in as ${ALLOWED} — ready for Reagan.`;
      canKidOpenNow = true;
      break;
    case "needs_grownup_signin":
      kidBadge = "Ask a grown-up to set this up";
      adultNote = isKid
        ? null
        : `Sign in once with ${ALLOWED} to unlock this card for Reagan.`;
      canKidOpenNow = false;
      break;
    case "blocked":
    default:
      kidBadge = "Ask a grown-up to set this up";
      adultNote = isKid
        ? null
        : `Signed-in account is on the blocked list — switch to ${ALLOWED}.`;
      canKidOpenNow = false;
      break;
  }

  return {
    key: "pear_classes_giant_steps",
    label: "Pear Classes",
    url: "https://support.giantsteps.app/s/my-library",
    category: "reading",
    signInMethod: "google_sso",
    allowedAccount: ALLOWED,
    railGroup: "reading_helpers",
    // Sort just after Khan (10) and IXL (20) so the reading rail reads
    // Khan → IXL → Pear Classes left-to-right.
    sortOrder: 30,
    consentState,
    kidBadge,
    adultNote,
    canKidOpenNow,
  };
}
