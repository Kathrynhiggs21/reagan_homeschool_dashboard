/**
 * Push 75 (2026-05-13) — shared "should this block get a generated payload?"
 * helper. Pulled out of agendaAssembler so the Today UI can use the same
 * logic via a tRPC query and stay in sync with the nightly PDF.
 *
 * Pure functions only: no DB, no IO. Inputs are already-fetched plain rows.
 */
import {
  buildReadingBlock,
  buildAdventureBlock,
  buildPracticeBlock,
  OWNED_BOOKS,
  type OwnedBookSlug,
  type AdventureTheme,
  type GeneratedBlock,
} from "./blockGenerators";
import type { PracticeSubject } from "./practiceLibrary";

export interface BlockRowForMatch {
  id: number;
  blockType?: string | null;
  subjectName?: string | null;
  durationMin?: number | null;
  description?: string | null;
}

export interface BookRefForMatch {
  bookTitle: string;
  fromPage: number;
  toPage: number;
}

export function matchOwnedBookSlug(title: string | null | undefined): OwnedBookSlug | null {
  if (!title) return null;
  const t = title.toLowerCase();
  for (const slug of Object.keys(OWNED_BOOKS) as OwnedBookSlug[]) {
    const ref = OWNED_BOOKS[slug].title.toLowerCase();
    if (t.includes(ref) || ref.includes(t)) return slug;
  }
  return null;
}

export function matchPracticeSubject(
  subjectName: string | null | undefined,
): PracticeSubject | null {
  const n = (subjectName ?? "").toLowerCase();
  if (!n) return null;
  if (n.includes("math")) return "math";
  if (n.includes("ela") || n.includes("language") || n.includes("reading")) return "ela";
  if (n.includes("science")) return "science";
  if (n.includes("social") || n.includes("history")) return "social";
  if (n.includes("spell")) return "spelling";
  return null;
}

/**
 * Decide whether a block should get a generated payload and produce it.
 * Returns null when the block already has rich content (a non-empty
 * `description`), unsupported type, or generator throws.
 */
export function deriveGeneratedForBlock(
  block: BlockRowForMatch,
  firstBookRef: BookRefForMatch | null,
): GeneratedBlock | null {
  // If the block already has its own description, skip — we don't want
  // to drown out tutor-authored notes with a canned payload.
  if (block.description && block.description.trim().length > 0) return null;

  const blockType = String(block.blockType ?? "");
  try {
    if (blockType === "read_aloud" && firstBookRef) {
      const slug = matchOwnedBookSlug(firstBookRef.bookTitle);
      if (slug) {
        const span = Math.max(1, firstBookRef.toPage - firstBookRef.fromPage + 1);
        return buildReadingBlock({
          bookSlug: slug,
          startPage: firstBookRef.fromPage,
          pagesPerDay: span,
        });
      }
    }
    if (blockType === "adventure") {
      const theme: AdventureTheme = "nature-scavenger";
      return buildAdventureBlock({
        theme,
        durationMin: block.durationMin ?? 30,
      });
    }
    if (blockType === "math") {
      const subj = matchPracticeSubject(block.subjectName) ?? "math";
      return buildPracticeBlock({ subject: subj, seed: `${block.id}` });
    }
  } catch {
    /* fall through */
  }
  return null;
}
