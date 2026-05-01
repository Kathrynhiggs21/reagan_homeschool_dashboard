/**
 * Pure helper used by SubjectSparklines: groups submissions by subjectSlug, filters
 * to last `daysBack` days, and computes per-subject value list + n + avg.
 */
export type SubmissionInput = {
  submittedAt?: string | Date | number;
  createdAt?: string | Date | number;
  subjectSlug?: string | null;
  rubricScore?: number | null;
};

export function groupSubmissionsForSparklines(
  subs: SubmissionInput[],
  daysBack: number = 30,
  now: number = Date.now(),
): Record<string, { values: number[]; n: number; avg: number }> {
  const cutoff = now - daysBack * 24 * 60 * 60 * 1000;
  const out: Record<string, { values: number[]; n: number; avg: number }> = {};
  const sorted = [...subs]
    .filter((s) => {
      const t = new Date((s.submittedAt as any) || (s.createdAt as any) || 0).getTime();
      return t >= cutoff && typeof s.rubricScore === "number";
    })
    .sort(
      (a, b) =>
        new Date((a.submittedAt as any) || (a.createdAt as any) || 0).getTime() -
        new Date((b.submittedAt as any) || (b.createdAt as any) || 0).getTime(),
    );
  for (const s of sorted) {
    const slug = s.subjectSlug || "general";
    if (!out[slug]) out[slug] = { values: [], n: 0, avg: 0 };
    out[slug].values.push(s.rubricScore as number);
    out[slug].n += 1;
  }
  for (const k of Object.keys(out)) {
    const v = out[k].values;
    out[k].avg = v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0;
  }
  return out;
}
