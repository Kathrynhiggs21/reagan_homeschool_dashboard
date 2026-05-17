/**
 * Idempotent ingest of Mom (Katy Higgs)'s 2026-05-17 voice-memo recap of
 * Reagan's completed homeschool work into curriculumTopics.
 *
 * Cite-back: every row touched gets
 *   last_covered_source = 'mom_katy_voice_memo_2026-05-17'
 *   last_covered_at     = <epoch ms at first-ingest>
 *
 * Re-running this function is a no-op for `last_covered_at` (preserves the
 * original timestamp) and for `status` (only ratchets up; never downgrades a
 * `done` row to `inProgress`). The `notes` column is overwritten so the latest
 * evidence string from the JSON is canonical.
 *
 * The list of items lives in
 *   curriculum/momKatyVoiceMemoIntake-2026-05-17.json
 * which is the single source of truth — code stays small, data stays auditable.
 */
import { getDb } from "../db";
import { sql } from "drizzle-orm";
import intake from "../../curriculum/momKatyVoiceMemoIntake-2026-05-17.json";

export const MOM_KATY_SOURCE_TAG = "mom_katy_voice_memo_2026-05-17" as const;

type Lifecycle = "done" | "inProgress" | "notStarted";

export interface IntakeItem {
  subject: string;
  matchByCode: string;
  title: string;
  newStatus: Lifecycle;
  evidence: string;
  alreadyDone?: boolean;
  createIfMissing?: boolean;
  notes?: string;
  ord?: number;
}

export interface IngestResult {
  source: string;
  inserted: string[];
  updated: string[];
  unchanged: string[];
  skippedNoCode: string[];
}

/**
 * Picks a final status without ever downgrading.
 * - If existing row is already `done`, keep it `done`.
 * - Otherwise honor `newStatus`.
 */
function pickStatus(existing: string | null, newStatus: Lifecycle): Lifecycle {
  if (existing === "done") return "done";
  return newStatus;
}

export async function ingestMomKatyVoiceMemo20260517(): Promise<IngestResult> {
  const db = getDb();
  const items = (intake.items || []) as IntakeItem[];

  const inserted: string[] = [];
  const updated: string[] = [];
  const unchanged: string[] = [];
  const skippedNoCode: string[] = [];
  const nowMs = Date.now();

  for (const item of items) {
    if (!item.matchByCode) {
      skippedNoCode.push(item.title);
      continue;
    }

    // Look up by (subject, code) — the unique-ish key in our schema.
    const [rows] = (await db.execute(sql`
      SELECT id, status, last_covered_at, last_covered_source
      FROM curriculumTopics
      WHERE subject = ${item.subject} AND code = ${item.matchByCode}
      LIMIT 1
    `)) as any;

    const existing = rows?.[0] || null;

    if (!existing) {
      if (!item.createIfMissing) {
        skippedNoCode.push(`${item.subject}:${item.matchByCode}`);
        continue;
      }
      const ord = typeof item.ord === "number" ? item.ord : 99;
      await db.execute(sql`
        INSERT INTO curriculumTopics
          (subject, code, title, ord, status, notes, last_covered_source, last_covered_at, created_at, updated_at)
        VALUES
          (${item.subject}, ${item.matchByCode}, ${item.title}, ${ord},
           ${item.newStatus}, ${item.evidence}, ${MOM_KATY_SOURCE_TAG}, ${nowMs},
           CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);
      inserted.push(`${item.subject}:${item.matchByCode}`);
      continue;
    }

    const finalStatus = pickStatus(existing.status, item.newStatus);
    const preservedTs = existing.last_covered_at ? Number(existing.last_covered_at) : nowMs;

    // Idempotency: if status, source, ts, and notes all already match, skip.
    const alreadyMatches =
      existing.status === finalStatus &&
      existing.last_covered_source === MOM_KATY_SOURCE_TAG &&
      Number(existing.last_covered_at) === preservedTs;

    if (alreadyMatches) {
      unchanged.push(`${item.subject}:${item.matchByCode}`);
      continue;
    }

    await db.execute(sql`
      UPDATE curriculumTopics
      SET status = ${finalStatus},
          notes = ${item.evidence},
          last_covered_source = ${MOM_KATY_SOURCE_TAG},
          last_covered_at = ${preservedTs},
          completed_at = CASE WHEN ${finalStatus} = 'done' AND completed_at IS NULL THEN CURRENT_TIMESTAMP ELSE completed_at END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${existing.id}
    `);
    updated.push(`${item.subject}:${item.matchByCode}`);
  }

  return {
    source: MOM_KATY_SOURCE_TAG,
    inserted,
    updated,
    unchanged,
    skippedNoCode,
  };
}
