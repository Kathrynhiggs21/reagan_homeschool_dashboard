/**
 * ixlDiagnostic.ts — PURE helpers for Reagan's real IXL Real-Time Diagnostic levels.
 *
 * IXL's Diagnostic reports a "level" on a roughly 0–800+ scale per subject
 * (Math, Language Arts) and per strand, and maps that scale to a grade
 * equivalent (e.g. level ~500 ≈ end of 5th grade). An adult reads those
 * numbers off ixl.com (Diagnostic → Levels) and records them; this module
 * turns them into the same parent-facing "working grade level" vocabulary the
 * rest of the dashboard already uses (see placementLevel.ts), so the IXL data
 * is first-class alongside the in-app Skill Check-up.
 *
 * Design rules (match placementLevel.ts):
 *   - PURE + deterministic. No DB, no network, no Date.now() in the math.
 *   - Never invents data. No levels recorded ⇒ report says "not recorded yet".
 *   - Reagan NEVER sees these numbers — parent-only. This file only produces
 *     data; the UI/route gating enforces visibility.
 *   - Framing is calm and non-testing: language avoids "score/test/fail".
 */

/* ----------------------------------------------------------------------- */
/* Subjects + strands                                                      */
/* ----------------------------------------------------------------------- */

/** IXL diagnostic is offered for Math and Language Arts (we slug ELA). */
export const IXL_SUBJECTS = ["math", "ela"] as const;
export type IxlSubjectSlug = (typeof IXL_SUBJECTS)[number];

export function ixlSubjectName(slug: string): string {
  if (slug === "math") return "Math";
  if (slug === "ela") return "Language Arts";
  return slug;
}

/**
 * IXL's published strand groupings (5th-grade view). Used to offer the adult a
 * ready set of rows to fill in rather than free-typing. Keys are slugified.
 */
export const IXL_STRANDS: Record<IxlSubjectSlug, { key: string; label: string }[]> = {
  math: [
    { key: "overall", label: "Overall" },
    { key: "numbers-and-operations", label: "Numbers & Operations" },
    { key: "algebra-and-algebraic-thinking", label: "Algebra & Algebraic Thinking" },
    { key: "fractions", label: "Fractions" },
    { key: "geometry", label: "Geometry" },
    { key: "measurement", label: "Measurement" },
    { key: "data-statistics-and-probability", label: "Data, Statistics & Probability" },
  ],
  ela: [
    { key: "overall", label: "Overall" },
    { key: "reading-strategies", label: "Reading Strategies" },
    { key: "reading-comprehension", label: "Reading Comprehension" },
    { key: "writing-strategies", label: "Writing Strategies" },
    { key: "grammar-and-mechanics", label: "Grammar & Mechanics" },
    { key: "vocabulary", label: "Vocabulary" },
  ],
};

/** Slugify any strand label an adult types so it's a stable upsert key. */
export function strandKeyFromLabel(label: string): string {
  return (
    label
      .trim()
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "strand"
  );
}

/* ----------------------------------------------------------------------- */
/* IXL level number → grade equivalent                                     */
/* ----------------------------------------------------------------------- */

/**
 * IXL's diagnostic scale runs ~0–1000, where each ~100 points ≈ one grade and
 * a level of N00 sits at roughly the START of grade N's analog. IXL's own
 * published anchors (approximate, used widely by parents):
 *   100 ≈ K · 200 ≈ 1st · 300 ≈ 2nd · 400 ≈ 3rd · 500 ≈ 4th ·
 *   600 ≈ 5th · 700 ≈ 6th · 800 ≈ 7th ...
 * i.e. grade ≈ (level / 100) - 1. We expose this as a grade equivalent number
 * with one decimal (e.g. 560 → grade 4.6). Returns null for nonsense input.
 */
export function ixlScoreToGrade(score: number | null | undefined): number | null {
  if (score == null || !Number.isFinite(score)) return null;
  if (score < 0 || score > 1200) return null;
  const grade = score / 100 - 1;
  // clamp to a sane K–12 band and round to 1 decimal
  const clamped = Math.max(0, Math.min(12, grade));
  return Math.round(clamped * 10) / 10;
}

/** Parse a grade-equivalent string the adult may type ("4.5", "4", "K"). */
export function parseGradeEquivalent(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  if (s === "") return null;
  if (s === "k" || s === "kindergarten") return 0;
  if (s === "pre-k" || s === "prek" || s === "pk") return -1 < 0 ? 0 : 0;
  const n = Number.parseFloat(s.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(12, Math.round(n * 10) / 10));
}

function ordinal(n: number): string {
  const v = Math.round(n);
  const s = ["th", "st", "nd", "rd"];
  const m = v % 100;
  return v + (s[(m - 20) % 10] || s[m] || s[0]);
}

/**
 * Compare a measured grade to Reagan's actual grade (5) and produce calm,
 * parent-facing language. Never uses "test/score/fail".
 */
export function gradeLabel(grade: number | null, currentGrade = 5): string {
  if (grade == null) return "Not recorded yet";
  const diff = grade - currentGrade;
  if (diff >= 1) return `Working above grade (about ${ordinal(grade)})`;
  if (diff >= 0.3) return `On grade, reaching ahead (about ${ordinal(grade)})`;
  if (diff >= -0.3) return `Right on grade (about ${ordinal(grade)})`;
  if (diff >= -1) return `Approaching grade (about ${ordinal(grade)})`;
  if (diff >= -2) return `About a year below (about ${ordinal(grade)})`;
  return `Building foundations (about ${ordinal(grade)})`;
}

/* ----------------------------------------------------------------------- */
/* Report types + builder                                                  */
/* ----------------------------------------------------------------------- */

/** One recorded IXL level row (already fetched from DB). */
export interface IxlLevelRow {
  subjectSlug: string;
  strandKey: string;
  strandLabel: string;
  ixlScore: number | null;
  gradeEquivalent: string | null;
  measuredAt: Date | number | string;
}

export interface IxlStrandReport {
  strandKey: string;
  strandLabel: string;
  ixlScore: number | null;
  grade: number | null;
  label: string;
}

export interface IxlSubjectReport {
  subjectSlug: string;
  subjectName: string;
  overallGrade: number | null;
  overallScore: number | null;
  overallLabel: string;
  measuredAtIso: string | null;
  strands: IxlStrandReport[];
  summary: string;
  nextStep: string;
}

export interface IxlDiagnosticReport {
  subjects: IxlSubjectReport[];
  recordedCount: number;
  /** Compact one-paragraph read for the AI agenda answer-context. */
  narrative: string;
}

function toIso(d: Date | number | string): string | null {
  try {
    const dt = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString();
  } catch {
    return null;
  }
}

/** Resolve a row's grade: prefer explicit grade equivalent, else map score. */
export function rowGrade(row: IxlLevelRow): number | null {
  const fromGE = parseGradeEquivalent(row.gradeEquivalent);
  if (fromGE != null) return fromGE;
  return ixlScoreToGrade(row.ixlScore);
}

export function buildIxlDiagnosticReport(
  rows: IxlLevelRow[],
  currentGrade = 5,
): IxlDiagnosticReport {
  const bySubject = new Map<string, IxlLevelRow[]>();
  for (const r of rows) {
    if (!bySubject.has(r.subjectSlug)) bySubject.set(r.subjectSlug, []);
    bySubject.get(r.subjectSlug)!.push(r);
  }

  // Always present both IXL subjects so the UI shows "not recorded yet".
  const subjectSlugs = Array.from(
    new Set<string>([...IXL_SUBJECTS, ...bySubject.keys()]),
  );

  const subjects: IxlSubjectReport[] = subjectSlugs.map((slug) => {
    const subjRows = bySubject.get(slug) ?? [];
    const overallRow = subjRows.find((r) => r.strandKey === "overall");
    const strandRows = subjRows.filter((r) => r.strandKey !== "overall");

    const overallGrade = overallRow ? rowGrade(overallRow) : null;
    const overallScore = overallRow?.ixlScore ?? null;

    const strands: IxlStrandReport[] = strandRows
      .map((r) => {
        const g = rowGrade(r);
        return {
          strandKey: r.strandKey,
          strandLabel: r.strandLabel,
          ixlScore: r.ixlScore,
          grade: g,
          label: gradeLabel(g, currentGrade),
        };
      })
      .sort((a, b) => (a.grade ?? 99) - (b.grade ?? 99)); // weakest first

    const measuredAtIso =
      overallRow ? toIso(overallRow.measuredAt) : subjRows[0] ? toIso(subjRows[0].measuredAt) : null;

    const name = ixlSubjectName(slug);
    let summary: string;
    let nextStep: string;

    if (overallGrade == null && strands.length === 0) {
      summary = `${name}: no IXL Diagnostic level recorded yet.`;
      nextStep = `Have Reagan spend a few low-key minutes in the IXL Diagnostic, then record her ${name} level here.`;
    } else {
      const headGrade =
        overallGrade ??
        (strands.length
          ? Math.round((strands.reduce((a, s) => a + (s.grade ?? 0), 0) / strands.length) * 10) / 10
          : null);
      summary = `${name}: ${gradeLabel(headGrade, currentGrade).toLowerCase()}.`;
      const weakest = strands.find((s) => s.grade != null);
      if (headGrade != null && headGrade >= currentGrade) {
        nextStep = `${name} is a relative strength — keep her in grade-level work and offer occasional challenges.`;
      } else if (weakest) {
        nextStep = `Focus ${name} support on the lowest strand first: ${weakest.strandLabel}. Keep sessions short and pressure-free.`;
      } else {
        nextStep = `Build ${name} fundamentals in short, confidence-first sessions before pushing to grade level.`;
      }
    }

    return {
      subjectSlug: slug,
      subjectName: name,
      overallGrade,
      overallScore,
      overallLabel: gradeLabel(overallGrade, currentGrade),
      measuredAtIso,
      strands,
      summary,
      nextStep,
    };
  });

  const recordedCount = rows.length;
  const recordedSubjects = subjects.filter(
    (s) => s.overallGrade != null || s.strands.some((st) => st.grade != null),
  );
  const narrative =
    recordedSubjects.length === 0
      ? "No IXL Diagnostic levels have been recorded yet, so there's no IXL-measured grade level on file."
      : recordedSubjects
          .map((s) => {
            const g = s.overallGrade;
            return g != null
              ? `${s.subjectName}: about ${ordinal(g)}-grade level on IXL${
                  s.strands[0] && s.strands[0].grade != null
                    ? ` (weakest strand: ${s.strands[0].strandLabel})`
                    : ""
                }.`
              : `${s.subjectName}: IXL strand levels recorded.`;
          })
          .join(" ");

  return { subjects, recordedCount, narrative };
}

/* ----------------------------------------------------------------------- */
/* IXL Diagnostic link                                                     */
/* ----------------------------------------------------------------------- */

/**
 * The link that drops Reagan into IXL's Diagnostic arena. When she's already
 * signed in (saved IXL web password), /diagnostic loads the arena directly;
 * when signed out, IXL prompts sign-in then forwards. We never put credentials
 * in the URL. Verified live (HTTP 200): https://www.ixl.com/diagnostic
 */
export const IXL_DIAGNOSTIC_URL = "https://www.ixl.com/diagnostic";
export const IXL_SIGNIN_URL = "https://www.ixl.com/signin";
export const IXL_DIAGNOSTIC_INFO_URL = "https://www.ixl.com/diagnostic/info";
