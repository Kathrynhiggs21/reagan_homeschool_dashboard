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

/* ----------------------------- shared legend ----------------------------- */
/**
 * v3.32 — single source of truth for the "how to open today's links" legend.
 * Used in BOTH the nightly agenda email (plain-text owner note + HTML body)
 * and anywhere else the same two-state vocabulary should appear, so the
 * dashboard chip, the email, and the PDF all speak identically.
 */
export const READINESS_LABELS = {
  kid: READY_LABEL, // "Reagan can open this"
  adult: ADULT_LABEL, // "Grown-up signs in first"
} as const;

/** Plain-text legend for email/notification bodies. */
export function readinessLegendText(): string {
  return (
    `Opening today's links:\n` +
    `  \u2713 "${READY_LABEL}" \u2014 tap and go (her Google sign-in or a class code).\n` +
    `  \u{1F510} "${ADULT_LABEL}" \u2014 an adult logs in (password in the adult-only vault), then hands it over.`
  );
}

/** HTML legend block for the agenda email body. */
export function readinessLegendHtml(): string {
  return (
    `<div style="margin:20px 0 4px;padding:12px 14px;background:#f5f8f6;border-radius:8px;font-size:12px;color:#555;">` +
    `<b style="color:#1f3a2e;">Opening today's links</b>` +
    `<div style="margin-top:6px;"><span style="display:inline-block;background:#d1fae5;color:#065f46;border-radius:999px;padding:1px 8px;font-weight:600;">&#10003; ${READY_LABEL}</span> &mdash; tap and go (Reagan's Google sign-in or a class code).</div>` +
    `<div style="margin-top:4px;"><span style="display:inline-block;background:#fef3c7;color:#92400e;border-radius:999px;padding:1px 8px;font-weight:600;">&#128274; ${ADULT_LABEL}</span> &mdash; an adult logs in (password saved in the adult-only vault), then hands it to Reagan.</div>` +
    `</div>`
  );
}
