/**
 * Classifies a schedule subject slug as "academic" (worksheet-style) vs an
 * activity (art/music/outdoors/pe/snack/break/wonder...).
 *
 * Used by the kid-facing fallback dialog (TodaySchoolWork) to decide the
 * PRIMARY action: academic subjects lead with the reliable self-hosted
 * "Print a paper copy" PDF (generateForSubject) and demote the external site to
 * a small secondary "practice online" link, because those external sites have
 * repeatedly gone dead / redirected / required login. Activity subjects keep
 * the external link primary because the activity IS the link.
 *
 * 2026-06-30 (Katy): worksheet/practice Open/Download reliability audit.
 */
export const ACADEMIC_SUBJECT_SLUGS = new Set<string>([
  "math",
  "arithmetic",
  "ela",
  "english",
  "language_arts",
  "reading",
  "writing",
  "science",
  "ss",
  "social_studies",
  "history",
  "spelling",
]);

export function isAcademicSubject(slug?: string | null): boolean {
  return ACADEMIC_SUBJECT_SLUGS.has((slug ?? "").toLowerCase().trim());
}
