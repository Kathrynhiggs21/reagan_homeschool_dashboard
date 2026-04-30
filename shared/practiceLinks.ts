/**
 * Auto-derive Khan Academy + IXL practice links from an Ohio Learning
 * Standard code (e.g. "5.NBT.A.1") or a topic title.
 *
 * These never replace explicit khanUrl / ixlUrl on the row — they're a
 * fallback so every topic shows at least *some* practice link.
 */

export type PracticeLinks = {
  khan: string;
  ixl: string;
  source: "explicit" | "derived";
};

const IXL_GRADE_5 = "https://www.ixl.com/math/grade-5";

export function derivePracticeLinks(opts: {
  subject: string;
  title: string;
  standardRef?: string | null;
  khanUrl?: string | null;
  ixlUrl?: string | null;
}): PracticeLinks {
  if (opts.khanUrl && opts.ixlUrl) {
    return { khan: opts.khanUrl, ixl: opts.ixlUrl, source: "explicit" };
  }
  // Build a search query — Khan/IXL both honour ?q= on their search pages
  const baseQ = (opts.standardRef ? `${opts.standardRef} ` : "") + opts.title;
  const q = encodeURIComponent(baseQ.trim());
  const subj = opts.subject.toLowerCase();
  const khanRoot = subj === "math"
    ? "https://www.khanacademy.org/search?page_search_query="
    : subj === "ela"
    ? "https://www.khanacademy.org/search?page_search_query="
    : subj === "science"
    ? "https://www.khanacademy.org/search?page_search_query="
    : "https://www.khanacademy.org/search?page_search_query=";
  const ixlRoot = subj === "math"
    ? "https://www.ixl.com/search?q="
    : subj === "ela"
    ? "https://www.ixl.com/search?q="
    : "https://www.ixl.com/search?q=";
  return {
    khan: opts.khanUrl || `${khanRoot}${q}`,
    ixl: opts.ixlUrl || `${ixlRoot}${q}`,
    source: opts.khanUrl || opts.ixlUrl ? "explicit" : "derived",
  };
}

export const PRACTICE_HOME = {
  khan: "https://www.khanacademy.org/math/cc-fifth-grade-math",
  ixl: IXL_GRADE_5,
};
