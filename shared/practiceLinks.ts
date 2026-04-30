/**
 * Auto-derive Khan Academy + IXL practice links from an Ohio Learning
 * Standard code (e.g. "5.NBT.A.1") or a topic title.
 *
 * Explicit khanUrl / ixlUrl on a topic row always win; this helper fills in
 * sensible search URLs when they're missing.
 *
 * Two user preferences influence the URLs:
 *   - ihIxl         → route IXL through the Indian Hill SSO so Reagan lands
 *                     logged-in with her school account (SmartScore + diagnostic).
 *   - khanKids      → use khanacademykids.org for topics flagged scaffolded
 *                     (age-appropriate UI when she's below grade level on a
 *                     specific sub-skill). Defaults off for 5th grade.
 */

export type PracticePrefs = {
  /** If true, IXL links route through Indian Hill SSO portal. */
  ihIxl?: boolean;
  /** If true, use Khan Kids (khanacademykids.org) on topics marked `scaffolded`. */
  khanKids?: boolean;
};

export type PracticeLinks = {
  khan: string;
  ixl: string;
  source: "explicit" | "derived";
  usedIhSso: boolean;
  usedKhanKids: boolean;
};

const IXL_GRADE_5 = "https://www.ixl.com/math/grade-5";

/**
 * Indian Hill uses Clever/Google SSO for IXL; the most reliable way to land
 * the student logged-in is to go to ixl.com/signin/indianhill and let IXL
 * bounce through the school's SSO. If IH moves the URL we only update here.
 */
export const IH_IXL_SIGNIN = "https://www.ixl.com/signin/indianhill";

/** Same idea for Khan — IH uses Google SSO so khanacademy.org works as-is. */
export const KHAN_HOME = "https://www.khanacademy.org";
export const KHAN_KIDS_HOME = "https://www.khanacademykids.org";

export function derivePracticeLinks(opts: {
  subject: string;
  title: string;
  standardRef?: string | null;
  khanUrl?: string | null;
  ixlUrl?: string | null;
  /** When true and khanKids pref is on, use Khan Kids domain. */
  scaffolded?: boolean;
  prefs?: PracticePrefs;
}): PracticeLinks {
  const prefs = opts.prefs ?? {};
  const baseQ = (opts.standardRef ? `${opts.standardRef} ` : "") + opts.title;
  const q = encodeURIComponent(baseQ.trim());

  // --- Khan
  const useKhanKids = Boolean(opts.scaffolded && prefs.khanKids);
  const khanSearchRoot = useKhanKids
    ? `${KHAN_KIDS_HOME}/?search=`
    : `${KHAN_HOME}/search?page_search_query=`;
  const khan = opts.khanUrl && !useKhanKids
    ? opts.khanUrl
    : `${khanSearchRoot}${q}`;

  // --- IXL
  // IH SSO mode: any IXL link (explicit or derived) is wrapped with a return
  // URL that IXL honours after login — falls back to the signin page itself.
  const rawIxl = opts.ixlUrl || `https://www.ixl.com/search?q=${q}`;
  const ixl = prefs.ihIxl
    ? `${IH_IXL_SIGNIN}?returnUrl=${encodeURIComponent(rawIxl)}`
    : rawIxl;

  const source: "explicit" | "derived" =
    opts.khanUrl || opts.ixlUrl ? "explicit" : "derived";

  return {
    khan,
    ixl,
    source,
    usedIhSso: Boolean(prefs.ihIxl),
    usedKhanKids: useKhanKids,
  };
}

export const PRACTICE_HOME = {
  khan: "https://www.khanacademy.org/math/cc-fifth-grade-math",
  khanKids: KHAN_KIDS_HOME,
  ixl: IXL_GRADE_5,
  ixlIhSso: IH_IXL_SIGNIN,
};
