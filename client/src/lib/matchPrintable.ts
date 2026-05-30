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


/**
 * 2026-05-30 — block-pinned matchers (preferred over subject-only).
 *
 * The homepage agenda was opening the first subject-matching printable for
 * the day (e.g., any Math worksheet) instead of the worksheet pinned to the
 * specific block the user tapped. These helpers compare the tapped block's
 * id against `TodayPrintableItem.blockId` (which is a varchar on the server
 * side, so we coerce both sides to string before comparing) and only fall
 * through to the subject-slug helpers when no pinned row exists.
 */
function sameBlockId(
  itemBlockId: string | null | undefined,
  blockId: number | string | null | undefined,
): boolean {
  if (itemBlockId == null || blockId == null) return false;
  return String(itemBlockId).trim() === String(blockId).trim();
}

export function findBestPrintableForBlock(
  items: TodayPrintableItem[],
  block: { id?: number | string | null; subjectSlug?: string | null; title?: string | null; blockType?: string | null },
): TodayPrintableItem | null {
  if (items.length === 0) return null;
  if (block.id != null) {
    const pinned = items.filter((it) => sameBlockId(it.blockId, block.id));
    if (pinned.length > 0) {
      // Prefer non-done pinned rows; otherwise return the most recent one.
      const live = pinned.filter((it) => it.status !== "done");
      return (live[0] ?? pinned[pinned.length - 1]) ?? null;
    }
  }
  // Fall back to subject-slug ranking when nothing is pinned to the block.
  const slug = detectSubjectSlug(block);
  return findBestPrintableForSubject(items, slug);
}

export function findAllPrintablesForBlock(
  items: TodayPrintableItem[],
  block: { id?: number | string | null; subjectSlug?: string | null; title?: string | null; blockType?: string | null },
  limit = 3,
): TodayPrintableItem[] {
  if (items.length === 0) return [];
  const pinned = block.id != null
    ? items.filter((it) => sameBlockId(it.blockId, block.id))
    : [];
  if (pinned.length >= limit) {
    // Pinned rows are the truth for this block; do not pad with subject-only
    // rows that may belong to a different worksheet.
    return pinned
      .slice()
      .sort((a, b) => Number(a.status === "done") - Number(b.status === "done"))
      .slice(0, limit);
  }
  const slug = detectSubjectSlug(block);
  const subjectMatches = findAllPrintablesForSubject(items, slug, limit);
  // Pinned first, then de-duped subject matches up to the limit.
  const out: TodayPrintableItem[] = [...pinned];
  for (const m of subjectMatches) {
    if (out.find((x) => x.id === m.id)) continue;
    out.push(m);
    if (out.length >= limit) break;
  }
  return out.slice(0, limit);
}
