/**
 * Push 157 (2026-05-14) — Off-curriculum-topic auto-classifier.
 *
 * Mom's locked policy:
 *
 *   "If the day does not follow the planned agenda, ensure the actual
 *    agenda is recorded and used for curriculum checks. ... If a topic
 *    covered is not in the curriculum, add it as a topic in Google Drive."
 *
 * AND:
 *
 *   "Ensure that curriculum progress and topic details are up-to-date
 *    and visibly obtainable. All files, worksheets, assignments,
 *    lessons, and videos should have the appropriate topic assignment
 *    label."
 *
 * The actual day rarely matches the planned agenda — Reagan goes off on
 * tangents (rocks in the creek, a YouTube video about volcanoes, a long
 * conversation about why honeybees dance). Mom's reasonable ask: when
 * Kiwi or the day-log captures a transcript chunk like
 *
 *     "Today we talked about how octopuses have three hearts and watched
 *      a video about volcanoes erupting under the ocean."
 *
 * the system should:
 *   1) try to match it to one of Reagan's existing curriculum topics
 *      (e.g. "Earth & space science / volcanoes"),
 *   2) and when no good match exists, surface a *new-topic candidate*
 *      Mom can one-tap-add to the curriculum (e.g. "Marine biology /
 *      cephalopods").
 *
 * This helper is pure: it does no LLM call, no DB lookup, no file IO.
 * The caller passes the kid's transcript chunk + the existing
 * curriculum-topic catalog and gets back a structured classification.
 * The route can later swap the heuristic for an LLM-backed version
 * without changing call sites.
 */

export interface CurriculumTopicCandidate {
  /** Stable id from the curriculum table (whatever the caller uses). */
  id: string;
  /** Subject the topic belongs to (e.g., "science", "social_studies"). */
  subject: string;
  /** Human label as shown on Mom's adult curriculum page. */
  label: string;
  /** Optional list of trigger words / phrases that map to this topic. */
  keywords?: readonly string[];
}

export type OffCurriculumDecision =
  | "matched_existing" // chunk maps cleanly to an existing topic
  | "new_topic_candidate" // looks educational but no existing topic — propose a new one
  | "no_topic"; // chatter / off-topic — don't surface anything

export interface OffCurriculumClassification {
  decision: OffCurriculumDecision;
  /** Verbatim chunk preserved for the day-log row. */
  rawChunk: string;
  /** When matched_existing, the matched topic id + label. */
  matchedTopicId?: string;
  matchedTopicLabel?: string;
  /** Confidence score 0..1 for the match (higher = stronger). */
  confidence: number;
  /** When new_topic_candidate, the suggested subject + label + keywords. */
  proposedSubject?: string;
  proposedLabel?: string;
  proposedKeywords?: string[];
  /** Pre-rendered Mom-facing one-line copy, kid-readable, no jargon. */
  adultCopy: string;
}

/**
 * Light heuristic catalog of subject hints. Used to *propose* a subject
 * for new-topic candidates when the chunk doesn't match the catalog.
 * Order matters — first-match wins.
 */
const SUBJECT_HEURISTICS: Array<{ subject: string; re: RegExp }> = [
  { subject: "science", re: /\b(volcano(?:es)?|earthquake|ocean|planet|gravity|atom|cell|organism|species|ecosystem|weather|cloud(?:s)?|rainbow|magnet|electric|circuit|chemical|molecule|gene|dna|fossil|dinosaur|insect|bird(?:s)?|fish|mammal|reptile|amphibian|cephalopod|octopus(?:es)?|jellyfish|whale|shark|honeybee|pollination|photosynthesis|mitosis|water cycle|food chain|food web|heart(?:s)?)\b/ },
  { subject: "social_studies", re: /\b(president|election|senate|congress|constitution|amendment|civil rights|war|treaty|colony|continent|country|state capital|map|latitude|longitude|culture|tradition|holiday|economy|trade|tax|government|democracy|monarchy|empire|ancient|medieval|revolution)\b/ },
  { subject: "math", re: /\b(fraction|decimal|percent|ratio|proportion|geometry|angle|triangle|polygon|area|perimeter|volume|graph|chart|mean|median|mode|equation|variable|exponent|prime|factor|multiple|integer|negative number|order of operations|measurement|metric|customary unit)\b/ },
  { subject: "ela", re: /\b(metaphor|simile|alliteration|onomatopoeia|theme|plot|setting|character|narrator|point of view|noun|verb|adjective|adverb|conjunction|preposition|paragraph|essay|thesis|topic sentence|punctuation|spelling|vocabulary|prefix|suffix|root word|sentence structure)\b/ },
  { subject: "art", re: /\b(painting|sketch|sculpture|color wheel|primary color|secondary color|shading|perspective|portrait|landscape|abstract|collage)\b/ },
  { subject: "music", re: /\b(rhythm|melody|harmony|tempo|pitch|chord|scale|symphony|orchestra|composer)\b/ },
  { subject: "pe_health", re: /\b(exercise|stretch|cardio|nutrition|food group|hydration|sleep|hygiene|mental health)\b/ },
];

/**
 * Words that are clearly chatter, not topical learning. If the chunk
 * is *only* these, we return decision = "no_topic" so we don't spam
 * Mom's adult curriculum page with "Reagan said hi to the dog".
 */
const CHATTER_RE = /^(hi|hello|hey|bye|goodbye|love you|thanks|thank you|good morning|good night|i'?m hungry|i'?m tired|can i have|where is|what time|i don'?t know|nothing|maybe|okay|ok|yes|no)[\s\W]*$/i;

const CONFIDENCE_STRONG = 0.85;
const CONFIDENCE_MEDIUM = 0.6;
const CONFIDENCE_WEAK = 0.3;

function tokenize(text: string): Set<string> {
  const cleaned = text
    .toLowerCase()
    .replace(/[^a-z0-9\s\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return new Set(cleaned.split(" ").filter((w) => w.length >= 3));
}

function scoreCatalogMatch(
  chunk: string,
  topic: CurriculumTopicCandidate,
): number {
  const tokens = tokenize(chunk);
  if (tokens.size === 0) return 0;
  const lowerChunk = chunk.toLowerCase();
  const labelHit = topic.label
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 4 && w !== "science" && w !== "earth" && w !== "life" && w !== "math")
    .some((w) => tokens.has(w) || tokens.has(w + "s"));
  let keywordHits = 0;
  for (const kw of topic.keywords ?? []) {
    const lower = kw.toLowerCase();
    if (lower.includes(" ")) {
      if (lowerChunk.includes(lower)) keywordHits += 2;
    } else if (tokens.has(lower) || tokens.has(lower + "s") || tokens.has(lower + "es")) {
      keywordHits += 1;
    }
  }
  // Score: label-hit base + per-keyword bonus, capped at 1.
  let s = labelHit ? 0.5 : 0;
  s += Math.min(0.8, keywordHits * 0.35);
  return Math.min(1, s);
}

function detectNewTopicSubject(chunk: string): { subject: string; matchedTerm: string } | undefined {
  const lower = chunk.toLowerCase();
  for (const { subject, re } of SUBJECT_HEURISTICS) {
    const m = re.exec(lower);
    if (m) return { subject, matchedTerm: m[0] };
  }
  return undefined;
}

function buildProposedLabel(
  subject: string,
  matchedTerm: string,
): string {
  // Title-case the matched term and stick a kid-readable subject prefix.
  const term = matchedTerm
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  switch (subject) {
    case "science":
      return `Science — ${term}`;
    case "social_studies":
      return `Social studies — ${term}`;
    case "math":
      return `Math — ${term}`;
    case "ela":
      return `Reading & writing — ${term}`;
    case "art":
      return `Art — ${term}`;
    case "music":
      return `Music — ${term}`;
    case "pe_health":
      return `Health & PE — ${term}`;
    default:
      return `New topic — ${term}`;
  }
}

function buildAdultCopyMatched(label: string, chunk: string): string {
  const head = chunk.replace(/\s+/g, " ").trim().slice(0, 90);
  return `Reagan covered "${label}" today (heard: "${head}").`;
}

function buildAdultCopyNewCandidate(label: string, chunk: string): string {
  const head = chunk.replace(/\s+/g, " ").trim().slice(0, 90);
  return `New topic to add? "${label}" — based on: "${head}". Tap to add it to the curriculum.`;
}

function buildAdultCopyNoTopic(chunk: string): string {
  const head = chunk.replace(/\s+/g, " ").trim().slice(0, 90);
  return `No topic match for: "${head}".`;
}

export interface ClassifyOptions {
  /** Override for the strong-match threshold; default 0.6. */
  matchThreshold?: number;
}

export function classifyOffCurriculum(
  rawChunk: string,
  catalog: readonly CurriculumTopicCandidate[],
  options: ClassifyOptions = {},
): OffCurriculumClassification {
  if (typeof rawChunk !== "string") {
    throw new Error("classifyOffCurriculum: rawChunk must be a string");
  }
  const trimmed = rawChunk.trim();
  if (trimmed.length === 0) {
    throw new Error("classifyOffCurriculum: rawChunk cannot be empty");
  }

  // Pure chatter: skip cleanly without surfacing anything to Mom.
  if (CHATTER_RE.test(trimmed)) {
    return {
      decision: "no_topic",
      rawChunk: trimmed,
      confidence: 0,
      adultCopy: buildAdultCopyNoTopic(trimmed),
    };
  }

  const threshold = options.matchThreshold ?? CONFIDENCE_MEDIUM;

  // Try to match the chunk to an existing curriculum topic.
  let bestMatch: { topic: CurriculumTopicCandidate; score: number } | undefined;
  for (const topic of catalog) {
    const score = scoreCatalogMatch(trimmed, topic);
    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { topic, score };
    }
  }

  if (bestMatch && bestMatch.score >= threshold) {
    return {
      decision: "matched_existing",
      rawChunk: trimmed,
      matchedTopicId: bestMatch.topic.id,
      matchedTopicLabel: bestMatch.topic.label,
      confidence:
        bestMatch.score >= CONFIDENCE_STRONG
          ? CONFIDENCE_STRONG
          : bestMatch.score,
      adultCopy: buildAdultCopyMatched(bestMatch.topic.label, trimmed),
    };
  }

  // No existing match: try to propose a new topic.
  const proposed = detectNewTopicSubject(trimmed);
  if (proposed) {
    const label = buildProposedLabel(proposed.subject, proposed.matchedTerm);
    return {
      decision: "new_topic_candidate",
      rawChunk: trimmed,
      proposedSubject: proposed.subject,
      proposedLabel: label,
      proposedKeywords: [proposed.matchedTerm.toLowerCase()],
      confidence: CONFIDENCE_WEAK,
      adultCopy: buildAdultCopyNewCandidate(label, trimmed),
    };
  }

  // Real chatter that didn't fall into our regex: still log decision.
  return {
    decision: "no_topic",
    rawChunk: trimmed,
    confidence: 0,
    adultCopy: buildAdultCopyNoTopic(trimmed),
  };
}
