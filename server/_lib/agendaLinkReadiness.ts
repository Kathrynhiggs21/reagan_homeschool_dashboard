/**
 * v3.31 (2026-06-04) — Agenda-link readiness joiner.
 *
 * User requirement: every link in the online agenda (and PDF) should open
 * to the exact page, already signed in where needed, and actually work —
 * no dead links, no generic homepages, no login walls the kid can't pass.
 *
 * This pure module fuses two existing pure helpers into ONE agenda-ready
 * descriptor per link:
 *   1. buildKhanIxlDeeplink (khanIxlDeeplink.ts) → a known-good URL +
 *      urlConfidence ("verified" deep link vs "subject-root-fallback").
 *      For non-Khan/IXL links we keep the row's own URL untouched.
 *   2. tagAppLinkSignInMethod (appLinkSignInMethodTagger.ts) → canKidOpenNow
 *      + kidBadge, honoring the house rule that Reagan only ever uses
 *      reaganhiggs910@gmail.com (ihsd.us is never surfaced).
 *
 * Output is rendered next to each link so a grown-up (or Reagan) instantly
 * knows whether it's tap-and-go or needs an adult sign-in first.
 *
 * No DB, no I/O. Never throws on malformed input.
 */

import {
  buildKhanIxlDeeplink,
  type CanonicalSubject,
  type DeeplinkProvider,
  type UrlConfidence,
} from "./khanIxlDeeplink";
import {
  tagAppLinkSignInMethod,
  type AppLinkSignInTag,
} from "./appLinkSignInMethodTagger";

export type AgendaLinkInput = {
  appKey: string;
  name?: string | null;
  /** The link's own URL (used as-is for non-Khan/IXL providers). */
  url?: string | null;
  isReaganView?: boolean;
  /**
   * Optional Khan/IXL deep-link hints. When `provider` is khan|ixl AND
   * `subject` is a canonical subject, we build a verified deep link and
   * REPLACE `url` with it (falling back to the subject root for unverified
   * topics). Otherwise the row's own `url` is preserved.
   */
  provider?: DeeplinkProvider | string | null;
  subject?: CanonicalSubject | string | null;
  topic?: string | null;
};

export type AgendaLinkReadiness = {
  appKey: string;
  /** The URL the agenda should actually link to (never a likely-404). */
  url: string | null;
  /**
   * "verified"            → deep link confirmed against allow-list
   * "subject-root-fallback" → degraded to a known-good subject landing page
   * "passthrough"         → not a Khan/IXL deep link; row URL used as-is
   */
  urlConfidence: UrlConfidence | "passthrough";
  /** True when this is a Khan/IXL link that was deep-linked or rooted. */
  isDeeplink: boolean;
  /** Sign-in facts straight from the tagger. */
  signInMethod: AppLinkSignInTag["signInMethod"];
  preferredAccountRole: AppLinkSignInTag["preferredAccountRole"];
  preferredAccountEmail: AppLinkSignInTag["preferredAccountEmail"];
  canKidOpenNow: boolean;
  /** Short kid-facing chip (from the tagger). */
  kidBadge: string;
  /** One-line grown-up/kid readiness sentence for the agenda. */
  readinessLabel: string;
  adultNote: AppLinkSignInTag["adultNote"];
};

const READY_LABEL = "Reagan can open this";
const ADULT_LABEL = "Grown-up signs in first";

function isCanonicalSubject(s: unknown): s is CanonicalSubject {
  return (
    s === "math" ||
    s === "ela" ||
    s === "science" ||
    s === "social-studies" ||
    s === "spelling"
  );
}

function isDeeplinkProvider(p: unknown): p is DeeplinkProvider {
  const v = typeof p === "string" ? p.toLowerCase() : p;
  return v === "khan" || v === "ixl";
}

/**
 * Build a single agenda-ready readiness descriptor for one link.
 * Best-effort: any failure degrades gracefully to the row's own URL +
 * passthrough confidence; the sign-in tag is always computed.
 */
export function buildAgendaLinkReadiness(
  input: AgendaLinkInput,
): AgendaLinkReadiness {
  const safeKey = typeof input?.appKey === "string" ? input.appKey : "";
  const isKid = input?.isReaganView === true;

  // 1) Sign-in tag (always — even for passthrough links).
  let tag: AppLinkSignInTag;
  try {
    tag = tagAppLinkSignInMethod({
      appKey: safeKey,
      name: input?.name ?? null,
      url: input?.url ?? null,
      isReaganView: isKid,
    });
  } catch {
    // Defensive: the tagger is documented never to throw, but stay safe.
    tag = {
      appKey: safeKey,
      signInMethod: "email_password",
      preferredAccountRole: "none",
      preferredAccountEmail: null,
      kidBadge: "Ask a grown-up to set this up",
      adultNote: null,
      canKidOpenNow: false,
    };
  }

  // 2) URL resolution.
  let url: string | null = input?.url ?? null;
  let urlConfidence: UrlConfidence | "passthrough" = "passthrough";
  let isDeeplink = false;

  const wantDeeplink =
    isDeeplinkProvider(input?.provider) && isCanonicalSubject(input?.subject);

  if (wantDeeplink) {
    try {
      const built = buildKhanIxlDeeplink({
        provider: input!.provider as DeeplinkProvider,
        subject: input!.subject as CanonicalSubject,
        topic: input?.topic ?? null,
      });
      if (built.ok) {
        url = built.plan.url;
        urlConfidence = built.plan.urlConfidence;
        isDeeplink = true;
      }
    } catch {
      // keep passthrough URL on any failure
    }
  }

  const readinessLabel = tag.canKidOpenNow ? READY_LABEL : ADULT_LABEL;

  return {
    appKey: safeKey,
    url,
    urlConfidence,
    isDeeplink,
    signInMethod: tag.signInMethod,
    preferredAccountRole: tag.preferredAccountRole,
    preferredAccountEmail: tag.preferredAccountEmail,
    canKidOpenNow: tag.canKidOpenNow,
    kidBadge: tag.kidBadge,
    readinessLabel,
    adultNote: tag.adultNote,
  };
}

/** Map a batch of links (cap enforced by callers). */
export function buildAgendaLinkReadinessBatch(
  rows: AgendaLinkInput[],
): AgendaLinkReadiness[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => buildAgendaLinkReadiness(r));
}
