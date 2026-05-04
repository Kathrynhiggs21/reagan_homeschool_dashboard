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

export type FinderResult = {
  source: "library" | "sonar_web" | "sonar_youtube";
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

async function sonarSearch(query: string, kidSafe: boolean): Promise<FinderResult[]> {
  const apiKey = process.env.SONAR_API_KEY;
  if (!apiKey) return [];

  const safetyLine = kidSafe
    ? "Restrict results to content explicitly safe and appropriate for a 10-year-old (5th grade). No ads, no gambling, no graphic content, no social-media platforms. Prefer Khan Academy, IXL, ReadWorks, PBS Kids, NASA Kids, National Geographic Kids, Common Sense Media-approved sources, and educational YouTube channels (SciShow Kids, Mark Rober, Crash Course Kids)."
    : "No restrictions, but prefer reputable educational sources.";

  const sysPrompt = `You are an educational research assistant for a 5th-grade homeschooler.
${safetyLine}
For the user's query, return up to 6 specific assignments / videos / activities they could drop into today's schedule.
Output a JSON object: { "items": [ { "title": string, "url": string, "type": "worksheet"|"video"|"lesson_plan"|"quiz"|"project"|"app_activity"|"reading"|"other", "snippet": string, "estimated_minutes": number, "subject_slug": "math"|"ela"|"reading"|"writing"|"science"|"ss"|"art"|"music"|"other", "topic_code": string } ] }
"topic_code" should be the closest 5th-grade Common Core / Ohio Learning Standard code (e.g. "5.OA.1", "5.RL.5.2", "5.NBT.3"). If you genuinely cannot identify one, use null.`;

  let json: any = null;
  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: query },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
      // Sonar can be slow; cap so the chat UI doesn't stall.
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return [];
    const body: any = await res.json();
    const content = body?.choices?.[0]?.message?.content || "{}";
    json = typeof content === "string" ? JSON.parse(content) : content;
  } catch {
    return [];
  }

  const rawItems: any[] = Array.isArray(json?.items) ? json.items : [];
  const out: FinderResult[] = [];
  for (const it of rawItems) {
    const title = String(it?.title || "").trim();
    if (!title) continue;
    const url = typeof it?.url === "string" ? it.url : null;
    const snippet = String(it?.snippet || "").trim();
    const type = String(it?.type || "other") as FinderResult["type"];
    const isYouTube = !!url && /youtube\.com|youtu\.be/.test(url);
    const blob = `${title} ${snippet} ${url || ""}`;
    const safe = !kidSafe || isKidSafe(blob);
    out.push({
      source: isYouTube ? "sonar_youtube" : "sonar_web",
      title,
      url,
      snippet,
      type,
      subjectSlug: it?.subject_slug ?? null,
      estimatedMinutes: typeof it?.estimated_minutes === "number" ? it.estimated_minutes : null,
      curriculumTopicCode: typeof it?.topic_code === "string" && /^[0-9A-Z]+\.[A-Z0-9.]+/i.test(it.topic_code) ? it.topic_code : null,
      curriculumTopicId: null,
      ageAppropriate: safe,
    });
  }
  return out;
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
    includeWeb ? sonarSearch(q, kidSafe).catch(() => []) : Promise.resolve([]),
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
