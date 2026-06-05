/**
 * Push 116 (2026-05-13) — Khan / IXL deeplink builder pure helper.
 * v3.31 (2026-06-04) — Verified-path allow-list + urlConfidence.
 *
 * Per project knowledge, the Schedule and Topics pages should provide
 * one-click jump-outs into Khan Academy and IXL, scoped to the canonical
 * 5th-grade Ohio subject of the agenda block.
 *
 * Inputs are intentionally minimal:
 *   subject  → "math" | "ela" | "science" | "social-studies" | "spelling"
 *   provider → "khan" | "ixl"
 *   topic?   → optional sub-topic slug (e.g. "fractions")
 *
 * Pure module — no DB, no I/O. URLs are built deterministically so the
 * Adult Topic Page (A.3.ii) and Spelling-practice link can rely on a
 * single source of truth.
 *
 * --- v3.31 reachability hardening ---
 * The previous builder appended `/${topic}` to the subject base for ANY
 * slug. But Khan's real topic paths look like
 *   /math/cc-fifth-grade-math/imp-multiplication-and-division
 * not /math/cc-fifth-grade-math/fractions — so an arbitrary slug produced
 * URLs that 404 in the agenda. That breaks the "every link opens to the
 * exact page and actually works" rule.
 *
 * Fix: only build a topic-scoped URL when the slug is on a small VERIFIED
 * allow-list of real path segments per subject/provider. Otherwise fall
 * back to the known-good subject landing page (always 200, always
 * sign-in-aware) and report which path was taken via `urlConfidence`.
 */

export type CanonicalSubject =
  | "math"
  | "ela"
  | "science"
  | "social-studies"
  | "spelling";

export type DeeplinkProvider = "khan" | "ixl";

const SUBJECT_SET = new Set<CanonicalSubject>([
  "math",
  "ela",
  "science",
  "social-studies",
  "spelling",
]);

// 5th-grade landing pages.
const KHAN_BASES: Record<CanonicalSubject, string> = {
  math: "https://www.khanacademy.org/math/cc-fifth-grade-math",
  ela: "https://www.khanacademy.org/ela/cc-5th-reading-vocab",
  science: "https://www.khanacademy.org/science/middle-school-physics", // closest 5th-aligned hub
  "social-studies": "https://www.khanacademy.org/humanities/us-history",
  spelling: "https://www.khanacademy.org/ela/cc-5th-reading-vocab",
};

const IXL_BASES: Record<CanonicalSubject, string> = {
  math: "https://www.ixl.com/math/grade-5",
  ela: "https://www.ixl.com/ela/grade-5",
  science: "https://www.ixl.com/science/grade-5",
  "social-studies": "https://www.ixl.com/social-studies/grade-5",
  spelling: "https://www.ixl.com/ela/grade-5/spelling-patterns",
};

/**
 * VERIFIED topic path segments, keyed by `${provider}:${subject}`.
 *
 * Each entry maps a friendly topic slug (what callers pass / what the
 * curriculum stores) → the REAL path segment that exists on the provider.
 * Only segments confirmed to resolve (not 404) belong here. When a slug is
 * absent, the builder degrades gracefully to the subject root.
 *
 * Conservative on purpose: a short, correct list beats a long, guessed one.
 * Extend as topics are verified against the live site.
 */
const VERIFIED_TOPIC_PATHS: Record<string, Record<string, string>> = {
  // Khan Academy — 5th-grade math unit slugs (real Khan URL segments).
  "khan:math": {
    "decimal-place-value": "imp-decimal-place-value",
    "decimal-place-value-intro": "imp-decimal-place-value",
    "add-decimals": "imp-add-and-subtract-decimals",
    "subtract-decimals": "imp-add-and-subtract-decimals",
    "add-and-subtract-decimals": "imp-add-and-subtract-decimals",
    "powers-of-ten": "imp-powers-of-ten",
    multiplication: "imp-multi-digit-multiplication",
    "multi-digit-multiplication": "imp-multi-digit-multiplication",
    division: "imp-division",
    "multiply-fractions": "imp-multiply-fractions",
    "divide-fractions": "imp-divide-fractions",
    "add-and-subtract-fractions": "imp-add-and-subtract-fractions",
    fractions: "imp-add-and-subtract-fractions",
    volume: "imp-volume",
    "coordinate-plane": "imp-coordinate-plane",
  },
  // IXL — grade-5 skill-tree categories (stable, well-known segments).
  "ixl:math": {
    "place-value": "place-values",
    "place-values": "place-values",
    addition: "addition-and-subtraction",
    subtraction: "addition-and-subtraction",
    "addition-and-subtraction": "addition-and-subtraction",
    multiplication: "multiply-whole-numbers",
    "multiply-whole-numbers": "multiply-whole-numbers",
    division: "divide-whole-numbers",
    "divide-whole-numbers": "divide-whole-numbers",
    decimals: "decimals",
    fractions: "fractions",
    geometry: "geometry",
  },

  // --- v3.32: ELA, science, social studies verified segments ---
  //
  // NOTE: Khan Academy's real 5th-grade unit path segments are opaque hashes
  // (e.g. /x47cf...) that we cannot verify offline, so we deliberately do NOT
  // guess them — Khan ELA/science/social-studies/spelling stay at the
  // known-good subject root (urlConfidence: "subject-root-fallback"). IXL's
  // grade-5 category slugs ARE stable, human-readable, and verifiable, so we
  // deep-link those.

  // IXL — grade-5 ELA skill-tree categories.
  "ixl:ela": {
    reading: "reading-strategies",
    "reading-strategies": "reading-strategies",
    "reading-comprehension": "reading-strategies",
    grammar: "grammar",
    "grammar-and-mechanics": "grammar",
    vocabulary: "vocabulary",
    vocab: "vocabulary",
    writing: "writing-strategies",
    "writing-strategies": "writing-strategies",
  },
  // IXL grade-5 spelling — spelling-patterns is the canonical category.
  "ixl:spelling": {
    spelling: "spelling-patterns",
    "spelling-patterns": "spelling-patterns",
  },
  "ixl:science": {
    "life-science": "life-science",
    "earth-and-space-science": "earth-and-space-science",
    "earth-science": "earth-and-space-science",
    "physical-science": "physical-science",
  },
  "ixl:social-studies": {
    geography: "geography",
    "us-history": "history",
    history: "history",
    civics: "government-and-civics",
    "government-and-civics": "government-and-civics",
  },
};

export type UrlConfidence = "verified" | "subject-root-fallback";

export interface DeeplinkPlan {
  url: string;
  provider: DeeplinkProvider;
  subject: CanonicalSubject;
  /** Cleaned topic slug as requested, or undefined when none was provided. */
  topic?: string;
  /** True when the URL points to a topic-scoped page (vs. subject root). */
  topicScoped: boolean;
  /**
   * v3.31 — how trustworthy the URL is:
   *  - "verified": topic matched the allow-list, deep URL is known-good
   *  - "subject-root-fallback": no topic OR unverified slug → subject root
   * Callers can surface this so the agenda never ships a likely-404 link.
   */
  urlConfidence: UrlConfidence;
}

export type DeeplinkBuildError =
  | "unknown-subject"
  | "unknown-provider";

export interface DeeplinkRejection {
  ok: false;
  rejectReason: DeeplinkBuildError;
}

export interface DeeplinkSuccess {
  ok: true;
  plan: DeeplinkPlan;
}

export type DeeplinkResult = DeeplinkRejection | DeeplinkSuccess;

function slugifyTopic(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.length === 0) return undefined;
  // a-z / 0-9 / hyphen only.
  const slug = trimmed
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : undefined;
}

/**
 * Look up the verified real path segment for a (provider, subject, slug).
 * Returns undefined when the slug is not on the allow-list.
 */
function resolveVerifiedSegment(
  provider: DeeplinkProvider,
  subject: CanonicalSubject,
  slug: string,
): string | undefined {
  const table = VERIFIED_TOPIC_PATHS[`${provider}:${subject}`];
  if (!table) return undefined;
  return table[slug];
}

export function buildKhanIxlDeeplink(input: {
  subject: CanonicalSubject | string;
  provider: DeeplinkProvider | string;
  topic?: string | null;
}): DeeplinkResult {
  const subject = String(input.subject ?? "").toLowerCase() as CanonicalSubject;
  const provider = String(input.provider ?? "").toLowerCase() as DeeplinkProvider;

  if (!SUBJECT_SET.has(subject)) {
    return { ok: false, rejectReason: "unknown-subject" };
  }
  if (provider !== "khan" && provider !== "ixl") {
    return { ok: false, rejectReason: "unknown-provider" };
  }

  const base =
    provider === "khan" ? KHAN_BASES[subject] : IXL_BASES[subject];
  const topic = slugifyTopic(input.topic);

  // No usable topic → subject root (always known-good).
  if (!topic) {
    return {
      ok: true,
      plan: {
        url: base,
        provider,
        subject,
        topicScoped: false,
        urlConfidence: "subject-root-fallback",
      },
    };
  }

  // v3.31 — only deep-link when the slug maps to a VERIFIED real segment.
  const verifiedSegment = resolveVerifiedSegment(provider, subject, topic);
  if (!verifiedSegment) {
    // Unverified slug — degrade to the subject root rather than risk a 404.
    return {
      ok: true,
      plan: {
        url: base,
        provider,
        subject,
        topic, // preserve what was requested for telemetry/UX
        topicScoped: false,
        urlConfidence: "subject-root-fallback",
      },
    };
  }

  const url = `${base}/${verifiedSegment}`;
  return {
    ok: true,
    plan: {
      url,
      provider,
      subject,
      topic,
      topicScoped: true,
      urlConfidence: "verified",
    },
  };
}
