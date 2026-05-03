/**
 * googleAuthLink
 * --------------
 * For Google-property URLs (classroom, drive, docs, sheets, slides, gmail,
 * calendar, meet, sites, photos, jamboard, keep, plus generic accounts.google
 * intermediaries), prefix the link so Chrome auto-uses Reagan's school
 * Google account instead of prompting an account chooser.
 *
 * Strategy:
 *   1. If the URL is on a known google.com property: rewrite it to use the
 *      `/u/<email>/` path style (Classroom, Drive, Docs, Gmail all support
 *      `/u/<n>/` and several also accept `/u/<email>/`).
 *   2. Otherwise wrap in
 *      `https://accounts.google.com/AccountChooser?Email=<email>&continue=<orig>`
 *   3. If we don't have a school email yet, return the URL unchanged.
 *
 * NOTE: this only nudges Chrome's account picker when Reagan is already
 * signed into the school account in Chrome. It can't grant access she
 * doesn't already have.
 */

const GOOGLE_HOSTS = [
  "classroom.google.com",
  "drive.google.com",
  "docs.google.com",
  "sheets.google.com",
  "slides.google.com",
  "mail.google.com",
  "calendar.google.com",
  "meet.google.com",
  "sites.google.com",
  "photos.google.com",
  "jamboard.google.com",
  "keep.google.com",
  "myaccount.google.com",
];

function isGoogleHost(host: string): boolean {
  const h = host.toLowerCase();
  return GOOGLE_HOSTS.includes(h) || h.endsWith(".google.com");
}

/**
 * Rewrite `href` so that it opens under `email` if possible.
 * `email` is the student's google account (e.g. reaganhiggs910@gmail.com).
 */
export function withGoogleAuthUser(href: string, email: string | null | undefined): string {
  if (!email) return href;
  const trimmed = email.trim();
  if (!trimmed) return href;
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return href;
  }
  if (!isGoogleHost(u.host)) return href;

  // Already has a /u/<n>/ or /u/<email>/ in path? Leave it alone.
  if (/^\/u\/[^/]+\//.test(u.pathname)) return u.toString();

  // Insert /u/<email>/ at the start of the path. Encode just the @ so URL parses.
  const encoded = encodeURIComponent(trimmed);
  const restPath = u.pathname === "/" ? "" : u.pathname;
  u.pathname = `/u/${encoded}${restPath}`;
  return u.toString();
}


// ----------------------------------------------------------------------------
// Google SSO hint for third-party apps that "Sign in with Google" (May 3 2026)
// ----------------------------------------------------------------------------
//
// Many learning apps (Khan, IXL, Prodigy, Wayground, Edpuzzle, Blooket, Seesaw,
// Canva, Code.org, Book Creator, ReadWorks, Quizlet, BrainPOP, Mystery Science,
// Khanmigo) accept "Sign in with Google" but their landing page won't pre-pick
// an account. Wrapping the URL through Google's AccountChooser pre-fills the
// account picker so Reagan only has to confirm rather than retype credentials.
//
// Behavior:
//   - If the destination is itself on google.com, fall through to
//     withGoogleAuthUser (above).
//   - If the destination's host is in SSO_HINT_HOSTS, wrap with AccountChooser.
//   - Otherwise, return the URL unchanged (no SSO hint applied).
//   - If `email` is empty, return the URL unchanged.

const SSO_HINT_HOSTS: ReadonlyArray<string> = [
  "khanacademy.org",
  "khanacademykids.org",
  "ixl.com",
  "prodigygame.com",
  "play.prodigygame.com",
  "wayground.com",
  "quizizz.com",
  "edpuzzle.com",
  "blooket.com",
  "seesaw.me",
  "app.seesaw.me",
  "canva.com",
  "code.org",
  "studio.code.org",
  "bookcreator.com",
  "app.bookcreator.com",
  "readworks.org",
  "www.readworks.org",
  "quizlet.com",
  "brainpop.com",
  "jr.brainpop.com",
  "mysteryscience.com",
  "khanmigo.ai",
  "kahoot.it",
  "kahoot.com",
];

function hostMatchesSsoAllowlist(host: string): boolean {
  const h = host.toLowerCase().replace(/^www\./, "");
  return SSO_HINT_HOSTS.some((allowed) => {
    const a = allowed.replace(/^www\./, "");
    return h === a || h.endsWith("." + a);
  });
}

/**
 * Wrap `href` through Google AccountChooser if the destination is a third-party
 * SSO host known to support "Sign in with Google". For google.com properties,
 * delegates to withGoogleAuthUser. For unknown hosts, returns href unchanged.
 *
 * Use case: Reagan opens an app card. If the app supports Google SSO, the URL
 * gets wrapped so Chrome shows the right account picker pre-filled with her
 * email, drastically cutting login friction.
 */
export function withGoogleSsoHint(href: string, email: string | null | undefined): string {
  if (!email) return href;
  const trimmed = email.trim();
  if (!trimmed) return href;
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return href;
  }
  if (isGoogleHost(u.host)) {
    return withGoogleAuthUser(href, trimmed);
  }
  if (!hostMatchesSsoAllowlist(u.host)) return href;
  const continueParam = encodeURIComponent(href);
  const emailParam = encodeURIComponent(trimmed);
  return `https://accounts.google.com/AccountChooser?Email=${emailParam}&continue=${continueParam}`;
}

/**
 * Returns true iff the host of `href` is a known third-party "Sign in with
 * Google" learning app. Useful for UI affordances like a small "G" badge.
 */
export function supportsGoogleSso(href: string): boolean {
  try {
    const u = new URL(href);
    return isGoogleHost(u.host) || hostMatchesSsoAllowlist(u.host);
  } catch {
    return false;
  }
}
