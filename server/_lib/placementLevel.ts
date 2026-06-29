/**
 * placementLevel.ts — Working-grade-level estimator for the diagnostic.
 *
 * The diagnostic question bank tags every task with a gradeLevel probe:
 *   "4" = below-grade probe, "5" = on-grade probe, "6" = stretch probe.
 *
 * The kid flow records, per task: isCorrect (auto-graded) and feltIt
 * (easy | ok | hard | skip). This module turns those raw responses into a
 * human-readable "working grade level" per subject and per strand — the
 * adult-facing payoff the schema comment said was "not built here".
 *
 * Design rules:
 *   - PURE + deterministic. No DB, no network, no Date.now() in the math.
 *     Callers pass already-fetched rows; this file is 100% unit-testable.
 *   - Never invents data. A subject with no responses returns level=null
 *     ("not assessed yet"), never a fabricated grade.
 *   - Conservative: a grade level is only "secure" when the on-grade (and,
 *     for above-grade, the stretch) probes are mostly correct AND didn't feel
 *     "hard". This mirrors how IXL's diagnostic only moves you up on evidence.
 *   - Reagan never sees these numbers — they are parent-only. The estimator
 *     just produces the data; the UI gates visibility.
 */

/* ----------------------------------------------------------------------- */
/* Inputs                                                                  */
/* ----------------------------------------------------------------------- */

export type FeltIt = "easy" | "ok" | "hard" | "skip";

/** One answered probe, joined with its task's subject/strand/grade. */
export interface ProbeResponse {
  subjectSlug: string;
  strand: string | null;
  /** "3" | "4" | "5" | "6" — the probe's grade band. */
  gradeLevel: string;
  isCorrect: boolean | null; // null = ungraded (showMeHow / hand-graded)
  feltIt: FeltIt;
}

/* ----------------------------------------------------------------------- */
/* Outputs                                                                 */
/* ----------------------------------------------------------------------- */

export type Security = "secure" | "developing" | "emerging";

export interface BandStat {
  grade: string; // "4" | "5" | "6"
  answered: number;
  correct: number; // counts isCorrect === true
  graded: number; // answered probes that had a gradeable answer
  /** % correct of GRADED probes in this band, 0..100; null if none graded. */
  accuracy: number | null;
  easy: number;
  hard: number;
}

export interface StrandLevel {
  strand: string;
  estimatedGrade: number | null; // numeric working grade, e.g. 5; null if unassessed
  label: string; // human label, e.g. "On grade (5th)"
  security: Security;
  answered: number;
}

export interface SubjectLevel {
  subjectSlug: string;
  estimatedGrade: number | null; // null = not assessed yet
  /** half-step precision, e.g. 4.5 means "between 4th and 5th". */
  estimatedGradePrecise: number | null;
  label: string;
  security: Security;
  confidence: number; // 0..100, how much evidence + how it felt
  answered: number;
  totalProbes: number;
  bands: BandStat[];
  strands: StrandLevel[];
  /** One-line plain-language read for the parent dashboard. */
  summary: string;
  /** One concrete suggested next step. */
  nextStep: string;
}

/* ----------------------------------------------------------------------- */
/* Tunables                                                                */
/* ----------------------------------------------------------------------- */

// A band is "passed" when graded accuracy is at/above this AND not mostly hard.
const PASS_ACCURACY = 0.7;
// Above this, a band is "aced" (used for the stretch promotion + "easy" bonus).
const ACE_ACCURACY = 0.85;

const SUBJECT_NAME: Record<string, string> = {
  math: "Math",
  ela: "Reading & Writing",
  science: "Science",
  ss: "Social Studies",
};

export function subjectName(slug: string): string {
  return SUBJECT_NAME[slug] ?? slug;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/* ----------------------------------------------------------------------- */
/* Band stats                                                              */
/* ----------------------------------------------------------------------- */

function emptyBand(grade: string): BandStat {
  return { grade, answered: 0, correct: 0, graded: 0, accuracy: null, easy: 0, hard: 0 };
}

function computeBands(responses: ProbeResponse[]): BandStat[] {
  const byGrade = new Map<string, BandStat>();
  for (const g of ["4", "5", "6"]) byGrade.set(g, emptyBand(g));

  for (const r of responses) {
    const band = byGrade.get(r.gradeLevel);
    if (!band) continue; // ignore unexpected bands (e.g. "3")
    if (r.feltIt === "skip") {
      band.answered += 1; // a skip is still an answered probe (counts against coverage)
      continue;
    }
    band.answered += 1;
    if (r.feltIt === "easy") band.easy += 1;
    if (r.feltIt === "hard") band.hard += 1;
    if (r.isCorrect != null) {
      band.graded += 1;
      if (r.isCorrect) band.correct += 1;
    }
  }
  for (const band of byGrade.values()) {
    band.accuracy = band.graded > 0 ? Math.round((band.correct / band.graded) * 100) : null;
  }
  return ["4", "5", "6"].map((g) => byGrade.get(g)!);
}

/** A band "passes" when graded accuracy >= PASS and it didn't feel mostly hard. */
function bandPassed(b: BandStat): boolean {
  if (b.graded === 0) return false;
  const acc = (b.accuracy ?? 0) / 100;
  const mostlyHard = b.answered > 0 && b.hard / b.answered > 0.5;
  return acc >= PASS_ACCURACY && !mostlyHard;
}

function bandAced(b: BandStat): boolean {
  if (b.graded === 0) return false;
  return (b.accuracy ?? 0) / 100 >= ACE_ACCURACY && b.hard === 0;
}

/* ----------------------------------------------------------------------- */
/* Grade estimate from bands                                               */
/* ----------------------------------------------------------------------- */

interface GradeEstimate {
  grade: number | null;
  precise: number | null;
  security: Security;
}

/**
 * Convert the three band stats into a working grade level.
 *
 * Logic (conservative, evidence-based):
 *   - No graded probes at all → null (not assessed).
 *   - Passes the on-grade (5) band:
 *       - also aces the stretch (6) band → 6 (working above grade)
 *       - passes stretch → 5.5
 *       - else → 5 (solidly on grade)
 *   - Fails on-grade but passes the below-grade (4) band → 4.5 if 5 was close,
 *     else 4 (working a year below).
 *   - Fails both 4 and 5 → 3.5 (needs foundational support below 4th).
 * Security reflects how much it leaned on "easy" vs "hard".
 */
function estimateFromBands(bands: BandStat[]): GradeEstimate {
  const b4 = bands.find((b) => b.grade === "4")!;
  const b5 = bands.find((b) => b.grade === "5")!;
  const b6 = bands.find((b) => b.grade === "6")!;

  const anyGraded = bands.some((b) => b.graded > 0);
  if (!anyGraded) return { grade: null, precise: null, security: "emerging" };

  const pass4 = bandPassed(b4);
  const pass5 = bandPassed(b5);
  const pass6 = bandPassed(b6);
  const ace5 = bandAced(b5);
  const ace6 = bandAced(b6);

  // Security: aced bands → secure; passed-but-effortful → developing; barely → emerging
  const securityFor = (passed: boolean, aced: boolean): Security =>
    aced ? "secure" : passed ? "developing" : "emerging";

  if (pass5) {
    if (ace6) return { grade: 6, precise: 6, security: "secure" };
    if (pass6) return { grade: 6, precise: 5.5, security: securityFor(true, ace5) };
    return { grade: 5, precise: ace5 ? 5 : 5, security: securityFor(true, ace5) };
  }
  // didn't pass on-grade
  if (pass4) {
    // close to 5? (5 graded, accuracy between 50-70 OR mostly "ok")
    const fiveClose = b5.graded > 0 && (b5.accuracy ?? 0) >= 50;
    return { grade: 4, precise: fiveClose ? 4.5 : 4, security: securityFor(true, bandAced(b4)) };
  }
  // failed both 4 and 5 — foundational
  const fourClose = b4.graded > 0 && (b4.accuracy ?? 0) >= 50;
  return { grade: fourClose ? 4 : 3, precise: fourClose ? 3.5 : 3, security: "emerging" };
}

function labelFor(precise: number | null): string {
  if (precise == null) return "Not assessed yet";
  if (precise >= 6) return "Working above grade (6th+)";
  if (precise >= 5.5) return "On grade, reaching into 6th";
  if (precise >= 5) return "On grade (5th)";
  if (precise >= 4.5) return "Approaching grade (high 4th)";
  if (precise >= 4) return "About a year below (4th)";
  if (precise >= 3.5) return "Foundational (high 3rd / low 4th)";
  return "Foundational (3rd)";
}

/* ----------------------------------------------------------------------- */
/* Confidence                                                              */
/* ----------------------------------------------------------------------- */

function computeConfidence(bands: BandStat[]): number {
  const answered = bands.reduce((a, b) => a + b.answered, 0);
  const graded = bands.reduce((a, b) => a + b.graded, 0);
  const easy = bands.reduce((a, b) => a + b.easy, 0);
  const hard = bands.reduce((a, b) => a + b.hard, 0);
  if (answered === 0) return 0;
  // Base on how many probes were answered (coverage) + gradeability.
  let conf = Math.min(70, answered * 8) + Math.min(15, graded * 3);
  // Felt-it nudges: lots of "easy"/"hard" consistency raises certainty.
  conf += Math.min(15, (easy + hard) * 2);
  return Math.max(10, Math.min(95, Math.round(conf)));
}

/* ----------------------------------------------------------------------- */
/* Strand-level rollup                                                     */
/* ----------------------------------------------------------------------- */

function computeStrands(responses: ProbeResponse[]): StrandLevel[] {
  const byStrand = new Map<string, ProbeResponse[]>();
  for (const r of responses) {
    const key = r.strand || "General";
    if (!byStrand.has(key)) byStrand.set(key, []);
    byStrand.get(key)!.push(r);
  }
  const out: StrandLevel[] = [];
  for (const [strand, rs] of byStrand) {
    const bands = computeBands(rs);
    const est = estimateFromBands(bands);
    out.push({
      strand,
      estimatedGrade: est.grade,
      label: labelFor(est.precise),
      security: est.security,
      answered: rs.filter((r) => r.feltIt !== "skip" || true).length,
    });
  }
  out.sort((a, b) => a.strand.localeCompare(b.strand));
  return out;
}

/* ----------------------------------------------------------------------- */
/* Public: one subject                                                     */
/* ----------------------------------------------------------------------- */

export function computeSubjectLevel(
  subjectSlug: string,
  responses: ProbeResponse[],
  totalProbes: number,
): SubjectLevel {
  const subjResponses = responses.filter((r) => r.subjectSlug === subjectSlug);
  const bands = computeBands(subjResponses);
  const est = estimateFromBands(bands);
  const confidence = computeConfidence(bands);
  const strands = computeStrands(subjResponses);
  const answered = bands.reduce((a, b) => a + b.answered, 0);
  const name = subjectName(subjectSlug);

  let summary: string;
  let nextStep: string;

  if (est.grade == null) {
    summary = `${name} hasn't been checked yet — no diagnostic questions answered.`;
    nextStep = `Have Reagan run the ${name} Skill Check-up so we can place her accurately.`;
  } else if ((est.precise ?? 0) >= 6) {
    summary = `${name} is a strength — she's handling 6th-grade-level probes comfortably.`;
    nextStep = `Offer stretch/enrichment work in ${name}; she's ready for more challenge.`;
  } else if ((est.precise ?? 0) >= 5.5) {
    summary = `${name} is solidly on 5th-grade level and starting to reach into 6th.`;
    nextStep = `Keep her on 5th-grade work and sprinkle in a few 6th-grade challenges.`;
  } else if ((est.precise ?? 0) >= 5) {
    summary = `${name} is right on 5th-grade level.`;
    nextStep = `Stay the course on grade-level ${name}; revisit any "tricky"-flagged strands.`;
  } else if ((est.precise ?? 0) >= 4.5) {
    summary = `${name} is approaching grade level — strong at 4th, not yet secure on 5th.`;
    nextStep = `Bridge the 4th→5th gap in ${name}; target the weakest strand first.`;
  } else if ((est.precise ?? 0) >= 4) {
    summary = `${name} is working about a year below grade (4th-grade level).`;
    nextStep = `Build 4th-grade fundamentals in ${name} before pushing to 5th-grade work.`;
  } else {
    summary = `${name} needs foundational support (below 4th grade).`;
    nextStep = `Start with foundational ${name} skills and short, confidence-building wins.`;
  }

  // Add a strand callout to nextStep when there's a clear weakest strand.
  const assessedStrands = strands.filter((s) => s.estimatedGrade != null);
  if (assessedStrands.length > 1) {
    const weakest = assessedStrands.reduce((min, s) =>
      (s.estimatedGrade ?? 99) < (min.estimatedGrade ?? 99) ? s : min,
    );
    if ((weakest.estimatedGrade ?? 99) < (est.grade ?? 0)) {
      nextStep += ` Weakest area: ${weakest.strand}.`;
    }
  }

  return {
    subjectSlug,
    estimatedGrade: est.grade,
    estimatedGradePrecise: est.precise,
    label: labelFor(est.precise),
    security: est.security,
    confidence,
    answered,
    totalProbes,
    bands,
    strands,
    summary,
    nextStep,
  };
}

/* ----------------------------------------------------------------------- */
/* Public: whole report                                                    */
/* ----------------------------------------------------------------------- */

export interface PlacementLevelReport {
  subjects: SubjectLevel[];
  /** Compact one-paragraph read for the AI agenda answer-context. */
  narrative: string;
  assessedCount: number;
  subjectCount: number;
}

export function buildPlacementLevelReport(
  responses: ProbeResponse[],
  probeTotals: Record<string, number>,
): PlacementLevelReport {
  const subjectSlugs = Array.from(
    new Set([...Object.keys(probeTotals), ...responses.map((r) => r.subjectSlug)]),
  ).sort();

  const subjects = subjectSlugs.map((slug) =>
    computeSubjectLevel(slug, responses, probeTotals[slug] ?? 0),
  );

  const assessed = subjects.filter((s) => s.estimatedGrade != null);
  const narrative =
    assessed.length === 0
      ? "Reagan hasn't completed any diagnostic Skill Check-ups yet, so there's no measured working grade level on file."
      : assessed
          .map(
            (s) =>
              `${subjectName(s.subjectSlug)}: ${s.label.toLowerCase()} (confidence ${s.confidence}%).`,
          )
          .join(" ");

  return {
    subjects,
    narrative,
    assessedCount: assessed.length,
    subjectCount: subjects.length,
  };
}
