/**
 * llmAssignmentFinder.ts — v2.96 (2026-05-27)
 *
 * Replaces the Sonar/Perplexity branch of `assignmentFinder.ts` with a finder
 * that uses the already-injected built-in LLM (Gemini via `invokeLLM`). No
 * new API key required; works inside both dev and Cloud Run prod.
 *
 * Hard rules baked into both the LLM prompt and the post-validation step:
 *
 *   1. Reputable kid-safe sources only — see `kidSafeAllowlist.checkUrlAllowed`.
 *   2. Right age group — Grade 4, 5, or 6 auto-accept (no preview);
 *      Grade 3 or 7 accept with preview; everything else accepts with
 *      preview + gradeNeedsReview flag for Mom/Grandma's review queue.
 *   3. Free — no paywall, no "sign up to view," no "$X.99 to download."
 *      Free-trial counts as paywall and is rejected.
 *   4. Foldable / downloadable — worksheets must be a PDF download (URL
 *      ends in `.pdf` OR a clear "Download PDF" link accessible without
 *      login). Interactive worksheets (Khan/IXL/Mr. Nussbaum) count.
 *   5. Saveable — Reagan can save her work via (a) printing the PDF,
 *      (b) downloading the filled-in version, or (c) the system records
 *      her answers automatically (Khan/IXL).
 *   6. No ads on the worksheet page. No auto-play video on the worksheet
 *      page. Click-to-start interactives are fine. YouTube click-to-play is fine.
 */
import { invokeLLM } from "../_core/llm";
import { checkUrlAllowed, type AllowlistTier } from "./kidSafeAllowlist";

export type GradeFit = "primary" | "adjacent" | "needs_review";

export type LLMFinderItem = {
  title: string;
  url: string;
  snippet: string;
  type: "worksheet" | "video" | "lesson_plan" | "quiz" | "project" | "app_activity" | "reading" | "other";
  subjectSlug: string | null;
  estimatedMinutes: number | null;
  topicCode: string | null;
  gradeLabel: string | null;       // e.g. "Grade 5", "5th grade", "K-5" — what the LLM saw
  gradeFit: GradeFit;
  gradeNeedsReview: boolean;
  isFree: boolean;
  hasPdf: boolean;
  hasSaveable: boolean;
  noAdsOnPage: boolean;
  allowlistTier: AllowlistTier;
  requiresAdultPreview: boolean;
  source: "llm_web" | "llm_youtube";
};

/**
 * Map an LLM-reported grade label to a fit bucket. Defaults to needs_review
 * if the label is missing or unrecognized — those go in Mom's review queue.
 */
export function classifyGradeFit(gradeLabel: string | null | undefined): {
  fit: GradeFit;
  needsReview: boolean;
} {
  if (!gradeLabel) return { fit: "needs_review", needsReview: true };
  const norm = String(gradeLabel).toLowerCase();

  // Look for numeric grade hints.
  const numericMatches = norm.match(/\b(?:grade|gr\.?|level)?\s*([2-9])(?:st|nd|rd|th)?\b/g) || [];
  const numerics = numericMatches
    .map((m) => {
      const n = m.match(/([2-9])/);
      return n ? parseInt(n[1], 10) : NaN;
    })
    .filter((n) => !Number.isNaN(n));

  // Also handle the "K-5", "3-5", "4-6" range pattern.
  const range = norm.match(/\b([k1-9])\s*[-\u2013]\s*([1-9])\b/);
  let rangeLow: number | null = null;
  let rangeHigh: number | null = null;
  if (range) {
    rangeLow = range[1] === "k" ? 0 : parseInt(range[1], 10);
    rangeHigh = parseInt(range[2], 10);
  }

  const PRIMARY = 5;
  const inPrimary = numerics.includes(PRIMARY) || (rangeLow !== null && rangeHigh !== null && rangeLow <= PRIMARY && rangeHigh >= PRIMARY);
  if (inPrimary) return { fit: "primary", needsReview: false };

  const inAdjacent = numerics.some((n) => n === 4 || n === 6) ||
    (rangeLow !== null && rangeHigh !== null && (rangeLow <= 6 && rangeHigh >= 4));
  if (inAdjacent) return { fit: "adjacent", needsReview: false };

  const inLooseClose = numerics.some((n) => n === 3 || n === 7);
  if (inLooseClose) return { fit: "needs_review", needsReview: false };

  return { fit: "needs_review", needsReview: true };
}

const SYSTEM_PROMPT = `You are an educational research assistant for a 5th-grade homeschooler in Ohio named Reagan (age 10).

Your job: given a topic query and (optional) subject, return up to 6 specific, real, kid-safe resources from reputable educational sources that meet ALL of these requirements:

ALLOWLIST (you MUST pick URLs from these domains; anything else will be rejected):
  Federal / national education: ed.gov, loc.gov, archives.gov, si.edu, nasa.gov, noaa.gov, scijinks.gov, usgs.gov, nps.gov, nationalgeographic.com, kids.nationalgeographic.com, pbs.org, pbskids.org, pbslearningmedia.org, cdc.gov, usa.gov, congress.gov, census.gov, usmint.gov, federalreserveeducation.org, fws.gov, epa.gov, nih.gov
  Ohio state + Ohio K-12 districts: education.ohio.gov, ohio.gov, infohio.org, ohiohistorycentral.org, ohiomemory.org, *.k12.oh.us
  Kid-safe edu publishers (ad-free worksheets): khanacademy.org, ixl.com, commoncoresheets.com, superteacherworksheets.com, readworks.org, math-aids.com, mathsisfun.com, math.com, k12reader.com, mrnussbaum.com, mathplayground.com, scholastic.com, storyworks.scholastic.com, dogonews.com, newsela.com, epic.com, getepic.com, time.com (TIME for Kids at /tfk), timeforkids.com, sikids.com, kids.britannica.com, britannica.com, ducksters.com, worldbookonline.com, brainpop.com, brainpopjr.com, code.org, scratch.mit.edu, metmuseum.org, moma.org, classicsforkids.com, amnh.org, fieldmuseum.org, exploratorium.edu
  Video (only when the user asks for a video/lesson): youtube.com, youtu.be — only kid-edu channels (e.g. SciShow Kids, Crash Course Kids, Mark Rober, NumberRock, Free School, Mystery Doug, Khan Academy)

HARD CONSTRAINTS for every result:
  - Right age group: prefer Grade 5; Grade 4 or 6 fine; close grades 3 or 7 acceptable; flag anything else with grade_label = the actual grade level you see.
  - Free: NO paywall, NO "free trial then $," NO "sign up to view." Free-with-account (Khan/IXL) is OK.
  - PDF or downloadable: worksheets must have a real downloadable PDF or a clear "Download PDF" link without login (interactive Khan/IXL/Mr. Nussbaum interactives count too).
  - Saveable: Reagan can save her work via print, download, or in-app save (Khan/IXL).
  - NO ads on the worksheet page. NO auto-play video on the worksheet page.
  - Click-to-start interactives are fine. YouTube click-to-play is fine.

Return STRICT JSON only, matching this schema:
{
  "items": [
    {
      "title": string,
      "url": string (must start with https://),
      "snippet": string (one sentence describing what Reagan does),
      "type": "worksheet" | "video" | "lesson_plan" | "quiz" | "project" | "app_activity" | "reading" | "other",
      "subject_slug": "math" | "ela" | "reading" | "writing" | "science" | "ss" | "art" | "music" | "health" | "pe" | "other" | null,
      "estimated_minutes": number | null,
      "topic_code": string | null (closest Common Core / Ohio Learning Standard like "5.OA.1" or "5.NBT.3"),
      "grade_label": string | null (e.g. "Grade 5" / "5th" / "K-5" / "Grade 4-6"),
      "is_free": boolean,
      "has_pdf": boolean,
      "has_saveable": boolean,
      "no_ads_on_page": boolean,
      "kid_channel": boolean (TRUE if and only if the video is on a recognized kid-educational YouTube channel like SciShow Kids, Crash Course Kids, Mark Rober, NumberRock, Free School, Mystery Doug, Khan Academy, TED-Ed, NatGeo Kids, Smithsonian Kids, etc. FALSE for general YouTube creators or unknown channels. NULL for non-video results.)
    }
  ]
}

Return AT MOST 6 items. Skip rather than guess: if you can't find a real URL on the allowlist that meets every hard constraint, return fewer items (or an empty list).`;

export async function llmFindAssignments(args: {
  query: string;
  subjectSlug?: string | null;
  preferVideo?: boolean;
}): Promise<LLMFinderItem[]> {
  const q = args.query.trim();
  if (!q) return [];

  const userMessage = [
    `Topic: ${q}`,
    args.subjectSlug ? `Subject: ${args.subjectSlug}` : null,
    args.preferVideo ? "Prefer a short kid-edu YouTube video plus 1-2 worksheets." : "Prefer printable worksheets and interactive practice; video optional.",
  ].filter(Boolean).join("\n");

  let rawJson: any = null;
  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "assignment_finder_items",
          strict: true,
          schema: {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    url: { type: "string" },
                    snippet: { type: "string" },
                    type: {
                      type: "string",
                      enum: ["worksheet", "video", "lesson_plan", "quiz", "project", "app_activity", "reading", "other"],
                    },
                    subject_slug: { type: ["string", "null"] },
                    estimated_minutes: { type: ["number", "null"] },
                    topic_code: { type: ["string", "null"] },
                    grade_label: { type: ["string", "null"] },
                    is_free: { type: "boolean" },
                    has_pdf: { type: "boolean" },
                    has_saveable: { type: "boolean" },
                    no_ads_on_page: { type: "boolean" },
                    kid_channel: { type: ["boolean", "null"] },
                  },
                  required: [
                    "title", "url", "snippet", "type", "subject_slug",
                    "estimated_minutes", "topic_code", "grade_label",
                    "is_free", "has_pdf", "has_saveable", "no_ads_on_page",
                    "kid_channel",
                  ],
                  additionalProperties: false,
                },
              },
            },
            required: ["items"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response?.choices?.[0]?.message?.content;
    if (typeof content === "string") {
      rawJson = JSON.parse(content);
    } else if (content && typeof content === "object") {
      rawJson = content;
    }
  } catch (err) {
    // LLM unavailable, schema rejected, or timeout — return empty rather than throw.
    return [];
  }

  const items: any[] = Array.isArray(rawJson?.items) ? rawJson.items : [];
  const out: LLMFinderItem[] = [];

  for (const it of items) {
    if (!it || typeof it !== "object") continue;
    const title = String(it.title || "").trim();
    const url = String(it.url || "").trim();
    if (!title || !url) continue;

    // 1. Hard reject anything not in the allowlist (allow Tier 4 video only
    //    when the result type says it's a video).
    const wantsVideo = it.type === "video";
    const check = checkUrlAllowed(url, { forVideo: wantsVideo });
    if (!check.allowed) continue;

    // 2. Hard reject anything not free, no saveable path, or with ads on page.
    if (!it.is_free) continue;
    if (!it.has_saveable) continue;
    if (!it.no_ads_on_page) continue;
    // Worksheets specifically must be PDF-downloadable. Videos/interactives are exempt.
    if (it.type === "worksheet" && !it.has_pdf) continue;

    // 3. Grade-fit classification.
    const { fit, needsReview } = classifyGradeFit(it.grade_label);

    // 4. Compose final preview requirement.
    //    - Tier 4 video (YouTube/Vimeo): preview NOT required IF the LLM
    //      confirmed `kid_channel === true` AND the grade fits (primary or
    //      adjacent). Reagan's rule: on-topic + kid channel + right age = no
    //      preview, just attach.
    //    - Tier 5 soft .org and the .gov/.edu pattern soft-allow always
    //      need preview.
    //    - grade_fit "needs_review" always needs preview.
    const isKidChannelVideo =
      check.tier === "tier4Video" && it.kid_channel === true &&
      (fit === "primary" || fit === "adjacent");
    const requiresAdultPreview = isKidChannelVideo
      ? false
      : (check.requiresAdultPreview || fit === "needs_review");

    out.push({
      title,
      url,
      snippet: String(it.snippet || "").trim(),
      type: it.type,
      subjectSlug: it.subject_slug || null,
      estimatedMinutes: typeof it.estimated_minutes === "number" ? it.estimated_minutes : null,
      topicCode: it.topic_code || null,
      gradeLabel: it.grade_label || null,
      gradeFit: fit,
      gradeNeedsReview: needsReview,
      isFree: !!it.is_free,
      hasPdf: !!it.has_pdf,
      hasSaveable: !!it.has_saveable,
      noAdsOnPage: !!it.no_ads_on_page,
      allowlistTier: check.tier,
      requiresAdultPreview,
      source: wantsVideo ? "llm_youtube" : "llm_web",
    });
  }

  return out;
}
