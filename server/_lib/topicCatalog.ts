/**
 * topicCatalog — pulls the current curriculumTopics rows out of the database,
 * normalizes the codes (uppercased, trimmed), and exposes two views:
 *
 *   1. `loadTopicCatalog()` → array of { code, title, subjectSlug, status }
 *      that the AI generator can drop into its system prompt.
 *   2. `resolveTopicId(code)` → numeric topic id for the commit step, so
 *      every block is anchored to a real topic row before it lands in
 *      `scheduleBlocks`.
 *
 * Subject slugs are derived from the `subject` column on `curriculumTopics`
 * (math / ela / science / social_studies / etc.). The two map cleanly because
 * the curriculum seeder uses the same slugs as the `subjects` table.
 *
 * Read-only — never mutates topic rows. Cached for 60 s to keep the AI loop
 * cheap even when the future-days sync runs five days back-to-back.
 */
import { sql } from "drizzle-orm";
import { getDb } from "../db";
import type { AICurriculumTopicHint } from "./aiScheduleGenerator";

type CatalogRow = AICurriculumTopicHint & { id: number };

const CACHE_TTL_MS = 60_000;
let cache: { at: number; rows: CatalogRow[] } | null = null;

function normalizeCode(raw: string | null | undefined): string {
  return String(raw || "").trim().toUpperCase().slice(0, 30);
}

async function fetchCatalog(): Promise<CatalogRow[]> {
  const db = getDb();
  const rows: any[] = ((await db.execute(sql`
    SELECT id, subject, code, title, status
    FROM curriculumTopics
    WHERE code IS NOT NULL AND code != ''
    ORDER BY subject ASC, ord ASC
  `)) as any)[0] ?? [];
  return rows.map((r) => ({
    id: Number(r.id),
    code: normalizeCode(r.code),
    title: String(r.title || ""),
    subjectSlug: String(r.subject || ""),
    status: String(r.status || "notStarted"),
  })).filter((r) => r.code.length > 0);
}

export async function loadTopicCatalog(force = false): Promise<CatalogRow[]> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.rows;
  const rows = await fetchCatalog();
  cache = { at: Date.now(), rows };
  return rows;
}

/**
 * Returns the not-yet-done topics first (limit 80), with a small tail of
 * recently completed ones so the LLM can choose them for review days.
 */
export async function loadTopicHintsForPrompt(): Promise<AICurriculumTopicHint[]> {
  const rows = await loadTopicCatalog();
  const open = rows.filter((r) => r.status !== "done").slice(0, 70);
  const done = rows.filter((r) => r.status === "done").slice(0, 10);
  return [...open, ...done].map((r) => ({
    code: r.code,
    title: r.title,
    subjectSlug: r.subjectSlug,
    status: r.status,
  }));
}

export async function resolveTopicId(code: string | null | undefined): Promise<number | null> {
  const norm = normalizeCode(code);
  if (!norm) return null;
  const rows = await loadTopicCatalog();
  const hit = rows.find((r) => r.code === norm);
  return hit ? hit.id : null;
}

/** Resolve many codes in one pass, returning a map for the commit step. */
export async function resolveTopicIds(codes: Array<string | null | undefined>): Promise<Map<string, number>> {
  const rows = await loadTopicCatalog();
  const codeToId = new Map<string, number>();
  for (const r of rows) codeToId.set(r.code, r.id);
  const out = new Map<string, number>();
  for (const c of codes) {
    const norm = normalizeCode(c);
    if (!norm) continue;
    const id = codeToId.get(norm);
    if (id) out.set(norm, id);
  }
  return out;
}

/** Test-only — drops the in-memory cache so a fresh DB read is forced. */
export function _resetTopicCatalogCache() { cache = null; }
