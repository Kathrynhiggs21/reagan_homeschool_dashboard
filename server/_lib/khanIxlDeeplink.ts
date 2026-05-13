/**
 * Push 116 (2026-05-13) — Khan / IXL deeplink builder pure helper.
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

export interface DeeplinkPlan {
  url: string;
  provider: DeeplinkProvider;
  subject: CanonicalSubject;
  /** Cleaned topic slug, or undefined when no usable topic was provided. */
  topic?: string;
  /** True when the URL points to a topic-scoped page (vs. subject root). */
  topicScoped: boolean;
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

  if (!topic) {
    return {
      ok: true,
      plan: {
        url: base,
        provider,
        subject,
        topicScoped: false,
      },
    };
  }

  // Both providers append a slugged path segment.
  const url = `${base}/${topic}`;
  return {
    ok: true,
    plan: {
      url,
      provider,
      subject,
      topic,
      topicScoped: true,
    },
  };
}
