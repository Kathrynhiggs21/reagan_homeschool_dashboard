/**
 * kidSafeAllowlist.ts — v2.96 (2026-05-27)
 *
 * Single source of truth for which URL hosts are acceptable to attach to a
 * block in Reagan's homeschool dashboard. Used by `llmAssignmentFinder` to
 * accept / reject / soft-allow URLs the LLM proposes.
 *
 * Tiers:
 *   tier1Federal — US federal / national ed agencies (highest trust, no preview)
 *   tier2Ohio    — Ohio state + Ohio K-12 district hosts (no preview)
 *   tier3Edu     — National non-profit & academic kid-safe publishers; *only
 *                  the ones with clean printable PDFs or fillable worksheets
 *                  and NO ads on the worksheet page* (no preview)
 *   tier4Video   — YouTube / Vimeo for VIDEO blocks only (requires preview)
 *   tier5Soft    — Pattern-allowed (.gov / .edu / curated .org) — accepted but
 *                  flagged `requiresAdultPreview: true` so Mom/Grandma can
 *                  spot-check before Reagan opens. Reflects the "or similar"
 *                  rule: the explicit lists are a starting set, not exhaustive.
 *
 * Worksheet rule:
 *   - PDF download OK
 *   - Fillable HTML OK
 *   - Interactive "click to start" lesson OK (Khan, IXL, Mr. Nussbaum interactives)
 *   - Ads on the worksheet page: NOT OK
 *   - Auto-play video on the worksheet page: NOT OK
 *   - YouTube videos OK for VIDEO blocks (click-to-play is YouTube default)
 *
 * Domain matching is suffix-based: "anything ending in .nasa.gov" so
 * `spaceplace.nasa.gov` and `climatekids.nasa.gov` both pass under "nasa.gov".
 */

/** Tier 1 — Federal / national education agencies + libraries (highest trust). */
export const TIER1_FEDERAL: readonly string[] = [
  "ed.gov",
  "nationsreportcard.gov",
  "loc.gov",
  "archives.gov",
  "docsteach.org",
  "si.edu",
  "nasa.gov",
  "noaa.gov",
  "scijinks.gov",
  "usgs.gov",
  "nps.gov",
  "nationalgeographic.com",
  "natgeokids.com",
  "pbs.org",
  "pbskids.org",
  "pbslearningmedia.org",
  "cdc.gov",
  "usa.gov",
  "congress.gov",
  "congressforkids.net",
  "whitehouse.gov",
  "census.gov",
  "usmint.gov",
  "federalreserveeducation.org",
  "fws.gov",
  "doi.gov",
  "energy.gov",
  "epa.gov",
  "nih.gov",
  "nasa.gov",
];

/** Tier 2 — Ohio state + district resources. */
export const TIER2_OHIO: readonly string[] = [
  "education.ohio.gov",
  "ohio.gov",
  "infohio.org",
  "ode.state.oh.us",
  "ohiohistorycentral.org",
  "ohiomemory.org",
  "ohioconnections.org",
  "ohiohistory.org",
  "ohioesc.org",
  "ohiolink.edu",
];

/**
 * Tier 3 — Kid-safe edu publishers with clean printable/fillable content and
 * no ads on the worksheet page. (Hosts that were ad-heavy or paywalled with
 * popups have been removed from earlier drafts: education.com, mathgames.com,
 * coolmath4kids.com, splashlearn.com.)
 */
export const TIER3_EDU: readonly string[] = [
  // Worksheets + practice (clean PDFs or fillables, no ads on the worksheet page)
  "khanacademy.org",
  "khanacademykids.org",
  "ixl.com",
  "commoncoresheets.com",
  "superteacherworksheets.com",
  "readworks.org",
  "math-aids.com",
  "mathsisfun.com",
  "math.com",
  "k12reader.com",
  "mrnussbaum.com",
  "mathplayground.com",
  // Reading / literature / news
  "scholastic.com",
  "storyworks.scholastic.com",
  "kpcnotebook.scholastic.com",
  "dogonews.com",
  "newsela.com",
  "epic.com",
  "getepic.com",
  "time.com",
  "timeforkids.com",
  "sikids.com",
  // Reference encyclopedias for kids
  "kids.britannica.com",
  "britannica.com",
  "ducksters.com",
  "worldbookonline.com",
  // Lessons + interactives (non-YouTube)
  "brainpop.com",
  "brainpopjr.com",
  "gonoodle.com",
  "code.org",
  "scratch.mit.edu",
  // Museums / arts
  "metmuseum.org",
  "moma.org",
  "carnegiehall.org",
  "classicsforkids.com",
  "amnh.org",
  "fieldmuseum.org",
  "exploratorium.edu",
  "getty.edu",
  "khanacademy.org/humanities",
];

/** Tier 4 — Video hosts (require adult preview before Reagan opens). */
export const TIER4_VIDEO: readonly string[] = [
  "youtube.com",
  "youtu.be",
  "vimeo.com",
];

/**
 * Tier 5 — Curated extended .org trust list for the soft-allow path. These
 * are recognized educational publishers we're happy to accept *with* the
 * `requiresAdultPreview` flag set so Mom/Grandma can spot-check. Captures
 * the "or similar" rule: explicit lists aren't exhaustive.
 */
export const TIER5_SOFT_ORG: readonly string[] = [
  "wikipedia.org",
  "wikimedia.org",
  "wikibooks.org",
  "ck12.org",
  "openstax.org",
  "made-with-code.com",
  "girlswhocode.com",
  "code-it.co.uk",
  "tynker.com",
  "raspberrypi.org",
  "tweentribune.com",
  "kidsdiscover.com",
  "edutopia.org",
  "teachervision.com",
  "lessonplanet.com",
];

export type AllowlistTier =
  | "tier1Federal"
  | "tier2Ohio"
  | "tier3Edu"
  | "tier4Video"
  | "tier5SoftOrg"
  | "softGov"
  | "softEdu";

export type AllowlistResult =
  | { allowed: true; tier: AllowlistTier; requiresAdultPreview: boolean }
  | { allowed: false; reason: string };

function extractHost(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl.trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
}

function hostMatchesAny(host: string, list: readonly string[]): boolean {
  for (const allowed of list) {
    if (host === allowed) return true;
    if (host.endsWith("." + allowed)) return true;
  }
  return false;
}

/**
 * Soft-allow if the host clearly looks like a government, university, or
 * Ohio K-12 district educational domain. Captures the "or similar" rule
 * (university extensions, state library youth pages, etc.) without me
 * having to enumerate every one. Flagged for adult preview either way.
 */
function softPatternMatch(host: string): AllowlistTier | null {
  if (host.endsWith(".k12.oh.us") || host === "k12.oh.us") return "tier2Ohio";
  if (host.endsWith(".oh.us")) return "softGov";
  if (host.endsWith(".gov")) return "softGov";
  if (host.endsWith(".edu")) return "softEdu";
  return null;
}

/**
 * Decide whether a URL is allowed at all, which tier it's in, and whether
 * it needs adult preview before Reagan opens it.
 *
 * @param url       URL string to check.
 * @param opts      { forVideo } — when true, Tier 4 (YouTube/Vimeo) is in scope.
 *                  When false (default), worksheets/practice rules apply.
 */
export function checkUrlAllowed(
  url: string | null | undefined,
  opts: { forVideo: boolean } = { forVideo: false },
): AllowlistResult {
  if (!url) return { allowed: false, reason: "empty_url" };
  const host = extractHost(url);
  if (!host) return { allowed: false, reason: "invalid_url" };

  // Exact / suffix match against the curated tiers first.
  if (hostMatchesAny(host, TIER1_FEDERAL)) {
    return { allowed: true, tier: "tier1Federal", requiresAdultPreview: false };
  }
  if (hostMatchesAny(host, TIER2_OHIO) || host.endsWith(".k12.oh.us") || host === "k12.oh.us") {
    return { allowed: true, tier: "tier2Ohio", requiresAdultPreview: false };
  }
  if (hostMatchesAny(host, TIER3_EDU)) {
    return { allowed: true, tier: "tier3Edu", requiresAdultPreview: false };
  }
  if (opts.forVideo && hostMatchesAny(host, TIER4_VIDEO)) {
    return { allowed: true, tier: "tier4Video", requiresAdultPreview: true };
  }
  if (hostMatchesAny(host, TIER5_SOFT_ORG)) {
    return { allowed: true, tier: "tier5SoftOrg", requiresAdultPreview: true };
  }

  // Soft pattern fallback: .gov, .edu, *.oh.us — always with adult preview.
  const soft = softPatternMatch(host);
  if (soft) {
    return { allowed: true, tier: soft, requiresAdultPreview: true };
  }

  return {
    allowed: false,
    reason: opts.forVideo ? "host_not_in_allowlist" : "host_not_in_practice_allowlist",
  };
}

/** Useful for debugging / admin UI: full list of explicit allowed hosts. */
export function listAllowedHosts(forVideo = false): readonly string[] {
  const base = [
    ...TIER1_FEDERAL,
    ...TIER2_OHIO,
    ...TIER3_EDU,
    ...TIER5_SOFT_ORG,
  ];
  return forVideo ? [...base, ...TIER4_VIDEO] : base;
}
