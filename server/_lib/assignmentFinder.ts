/**
 * assignmentFinder.ts
 *
 * Universal "find me something to drop on the schedule" search used by the
 * adult AI bar. Three sources, in this order:
 *   1. Internal `assignments_library` rows already in our DB.
 *   2. Kid-safe web + YouTube via Perplexity Sonar (uses SONAR_API_KEY).
 *   3. (Image input) Gemini Vision identifies the worksheet first, then we
 *      run the matched text query through #1 and #2.
 *
 * Every returned item carries a candidate `curriculumTopicCode` so the caller
 * can reject anything that does not anchor to a real topic.
 */
import * as db from "../db";
import { resolveTopicId } from "./topicCatalog";
import { llmFindAssignments } from "./llmAssignmentFinder";

export type FinderResult = {
  // v2.96 (2026-05-27): replaced sonar_* sources with llm_* — Sonar branch is gone.
  source: "library" | "llm_web" | "llm_youtube";
  title: string;
  url: string | null;
  snippet: string;
  type: "worksheet" | "video" | "lesson_plan" | "quiz" | "project" | "app_activity" | "reading" | "other";
  subjectSlug: string | null;
  estimatedMinutes: number | null;
  curriculumTopicCode: string | null;          // candidate topic the AI suggests
  curriculumTopicId: number | null;            // resolved id if it matched the catalog
  ageAppropriate: boolean;                     // false → flagged as not kid-safe
  thumbnail?: string | null;
  internalId?: number | null;                  // assignments_library id when source==="library"
  /** v2.96: grade fit + adult-preview flags for the new LLM-backed finder. */
  gradeLabel?: string | null;
  gradeFit?: "primary" | "adjacent" | "needs_review" | null;
  gradeNeedsReview?: boolean;
  requiresAdultPreview?: boolean;
  allowlistTier?: string | null;
};

const KID_UNSAFE_PATTERNS = [
  /\b(porn|nsfw|gore|kill\s+yourself|graphic violence|adults? only|18\+)\b/i,
];

function isKidSafe(text: string): boolean {
  return !KID_UNSAFE_PATTERNS.some((re) => re.test(text));
}

async function searchLibrary(query: string, subjectSlug: string | null): Promise<FinderResult[]> {
  const rows = await db.listAssignmentsLibrary({
    q: query,
    subjectSlug: subjectSlug ?? undefined,
    limit: 8,
  } as any);
  return rows.map((r: any) => ({
    source: "library" as const,
    title: r.title,
    url: r.fileLink || r.sourceUrl || null,
    snippet: [r.topic, r.notes].filter(Boolean).join(" — ").slice(0, 240),
    type: (r.type as any) || "other",
    subjectSlug: r.subjectSlug ?? subjectSlug,
    estimatedMinutes: null,
    curriculumTopicCode: null,
    curriculumTopicId: null,
    ageAppropriate: true,
    internalId: r.id,
  }));
}

/**
 * v2.96 (2026-05-27): replaces the old sonarSearch. Uses the built-in LLM
 * (no new API key) via llmAssignmentFinder.ts; honors the kid-safe allowlist,
 * grade-fit rules, and the worksheet ad-free + free + PDF + saveable
 * requirements baked into the LLM prompt + post-validator.
 */
async function llmSearch(query: string, kidSafe: boolean, subjectSlug: string | null): Promise<FinderResult[]> {
  if (!kidSafe) {
    // Reagan's whole dashboard is kid-only — no "adult" path. If a caller asks
    // for the un-safe mode, just return [].
    return [];
  }
  let items: Awaited<ReturnType<typeof llmFindAssignments>> = [];
  try {
    items = await llmFindAssignments({ query, subjectSlug });
  } catch {
    return [];
  }

  return items.map((it) => ({
    source: it.source,
    title: it.title,
    url: it.url,
    snippet: it.snippet,
    type: it.type,
    subjectSlug: it.subjectSlug,
    estimatedMinutes: it.estimatedMinutes,
    curriculumTopicCode: it.topicCode,
    curriculumTopicId: null,
    ageAppropriate: true, // already validated by llmFindAssignments
    gradeLabel: it.gradeLabel,
    gradeFit: it.gradeFit,
    gradeNeedsReview: it.gradeNeedsReview,
    requiresAdultPreview: it.requiresAdultPreview,
    allowlistTier: it.allowlistTier,
  }));
}

/**
 * Decode an uploaded image (data URL or remote URL) and ask Gemini what it
 * is, so we can search for matching assignments. Returns a search query the
 * caller can pass through findAssignments again.
 */
export async function describeImageForSearch(imageUrl: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  try {
    const body: any = {
      contents: [
        {
          role: "user",
          parts: [
            { text: "Identify this homeschool worksheet/printable in one short search query suitable for finding similar assignments online. Reply with ONLY the query, no extra words." },
            // Gemini can fetch a remote URL when given as fileData.
            ...(imageUrl.startsWith("data:")
              ? [{ inlineData: { mimeType: imageUrl.split(";")[0].slice(5), data: imageUrl.split(",")[1] } }]
              : [{ fileData: { fileUri: imageUrl, mimeType: "image/jpeg" } }]),
          ],
        },
      ],
    };
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const json: any = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string") return null;
    return text.trim().slice(0, 200) || null;
  } catch {
    return null;
  }
}

export async function findAssignments(args: {
  query: string;
  subjectSlug?: string | null;
  imageUrl?: string | null;
  kidSafe?: boolean;            // forced true for kid sessions
  includeWeb?: boolean;         // default true
  includeLibrary?: boolean;     // default true
}): Promise<FinderResult[]> {
  let q = args.query.trim();
  if (args.imageUrl) {
    const fromImage = await describeImageForSearch(args.imageUrl);
    if (fromImage) q = q ? `${q} — ${fromImage}` : fromImage;
  }
  if (!q) return [];

  const includeLibrary = args.includeLibrary !== false;
  const includeWeb = args.includeWeb !== false;
  const kidSafe = args.kidSafe !== false; // default safe-on
  const subjectSlug = args.subjectSlug ?? null;

  const [libRaw, webRaw] = await Promise.all([
    includeLibrary ? searchLibrary(q, subjectSlug).catch(() => []) : Promise.resolve([]),
    includeWeb ? llmSearch(q, kidSafe, subjectSlug).catch(() => []) : Promise.resolve([]),
  ]);

  // Resolve topic codes to real ids so the caller can refuse non-tagged items.
  const all = [...libRaw, ...webRaw];
  await Promise.all(
    all.map(async (r) => {
      if (r.curriculumTopicCode) {
        const id = await resolveTopicId(r.curriculumTopicCode).catch(() => null);
        if (id) r.curriculumTopicId = id;
      }
    }),
  );

  // Drop kid-unsafe results entirely when kidSafe is on.
  return all.filter((r) => (kidSafe ? r.ageAppropriate : true));
}
