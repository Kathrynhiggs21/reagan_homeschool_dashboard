import type { TodayPrintableItem } from "@/components/TodaySchoolWork";

/**
 * Guess the subject slug a block maps to from its title/type.
 * Returns one of: "math" | "ela" | "reading" | "science" | "ss" | null
 */
export function detectSubjectSlug(block: { title?: string | null; blockType?: string | null; subjectSlug?: string | null }): string | null {
  if (block.subjectSlug) return block.subjectSlug;
  const raw = `${block.blockType ?? ""} ${block.title ?? ""}`.toLowerCase();
  if (!raw.trim()) return null;
  // direct slug matches
  if (/\bmath\b|arithmet|fraction|decimal|geometry|algebra/.test(raw)) return "math";
  if (/\bela\b|language arts|grammar|writing|spelling|vocab/.test(raw)) return "ela";
  if (/\bread|reading|book|novel|chapter|literature|tuck/.test(raw)) return "reading";
  if (/\bscience|biology|chemistry|physics|experiment|nature\b/.test(raw)) return "science";
  if (/\bss\b|social|history|geography|civic/.test(raw)) return "ss";
  return null;
}

/** Given a list of today's printables and a subject slug, return the best matching printable (or null). */
export function findBestPrintableForSubject(
  items: TodayPrintableItem[],
  subjectSlug: string | null,
): TodayPrintableItem | null {
  if (!subjectSlug || items.length === 0) return null;
  const bucketRank: Record<string, number> = { have_to_do: 0, optional: 1, extra: 2 };

  // Equivalence groups so "ela" matches "reading"-tagged items if no strict ELA item exists.
  const equiv: Record<string, string[]> = {
    math: ["math"],
    ela: ["ela", "reading", "writing"],
    reading: ["reading", "ela"],
    science: ["science"],
    ss: ["ss", "social_studies", "history"],
  };
  const groups = equiv[subjectSlug] ?? [subjectSlug];

  const scored = items
    .map(it => {
      const slug = (it.subjectSlug ?? "").toLowerCase();
      let subjectScore = 0;
      if (slug && groups.includes(slug)) subjectScore += 100;
      // Fallback: sniff the title/description
      const hay = `${it.title ?? ""} ${it.description ?? ""}`.toLowerCase();
      if (subjectSlug === "math" && /math|fraction|decimal|geometry|algebra|number/.test(hay)) subjectScore += 20;
      if ((subjectSlug === "ela" || subjectSlug === "reading") && /read|story|passage|vocab|grammar|writing|spell/.test(hay)) subjectScore += 20;
      if (subjectSlug === "science" && /science|nature|bird|plant|animal|experiment/.test(hay)) subjectScore += 20;
      if (subjectSlug === "ss" && /history|geography|map|state|civic|explorer/.test(hay)) subjectScore += 20;
      // Bucket bonus and done-penalty only apply when there's some subject signal,
      // so unrelated items don't ride along on bucket priority alone.
      let score = subjectScore;
      if (subjectScore > 0) {
        score += (3 - (bucketRank[it.bucket ?? "extra"] ?? 2)) * 5;
        if (it.status === "done") score -= 50;
      }
      return { it, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.it ?? null;
}

/** Return all matching printables for a subject, ranked best-first (used to surface a thumbnail strip on schedule blocks). */
export function findAllPrintablesForSubject(
  items: TodayPrintableItem[],
  subjectSlug: string | null,
  limit = 3,
): TodayPrintableItem[] {
  if (!subjectSlug || items.length === 0) return [];
  const bucketRank: Record<string, number> = { have_to_do: 0, optional: 1, extra: 2 };
  const equiv: Record<string, string[]> = {
    math: ["math"],
    ela: ["ela", "reading", "writing"],
    reading: ["reading", "ela"],
    science: ["science"],
    ss: ["ss", "social_studies", "history"],
  };
  const groups = equiv[subjectSlug] ?? [subjectSlug];
  const scored = items
    .map(it => {
      const slug = (it.subjectSlug ?? "").toLowerCase();
      let subjectScore = 0;
      if (slug && groups.includes(slug)) subjectScore += 100;
      const hay = `${it.title ?? ""} ${it.description ?? ""}`.toLowerCase();
      if (subjectSlug === "math" && /math|fraction|decimal|geometry|algebra|number/.test(hay)) subjectScore += 20;
      if ((subjectSlug === "ela" || subjectSlug === "reading") && /read|story|passage|vocab|grammar|writing|spell/.test(hay)) subjectScore += 20;
      if (subjectSlug === "science" && /science|nature|bird|plant|animal|experiment/.test(hay)) subjectScore += 20;
      if (subjectSlug === "ss" && /history|geography|map|state|civic|explorer/.test(hay)) subjectScore += 20;
      let score = subjectScore;
      if (subjectScore > 0) {
        score += (3 - (bucketRank[it.bucket ?? "extra"] ?? 2)) * 5;
        if (it.status === "done") score -= 50;
      }
      return { it, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(s => s.it);
}
