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
 * `email` is the student's google account (e.g. Reagan.higgs33@ihsd.us).
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
