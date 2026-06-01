#!/usr/bin/env node
/**
 * scripts/prune_bookshelf_to_four.mjs (v3.28, 2026-06-01)
 * ========================================================
 *
 * Evidence script (and one-shot operator tool) that proves the
 * `bookshelf` table is curated to the four canonical books
 * referenced from Reagan's printed library:
 *
 *   - Tuck Everlasting
 *   - Michael's World
 *   - Spectrum Science Grade 5
 *   - 180 Days of Language for 5th Grade
 *
 * This script also serves as the audit trail for the v2.x cleanup of
 * the test row `Test Book 1777379912525` (a stray seed left over from
 * an early vitest pass that was hitting the live DB before the
 * `dbOverride` mechanism existed).
 *
 * Usage:
 *
 *   node scripts/prune_bookshelf_to_four.mjs           # dry-run (default)
 *   node scripts/prune_bookshelf_to_four.mjs --apply   # actually delete
 *
 * The script issues DELETE statements against the `books` table for
 * any row whose title is not in the canonical list. It is intentionally
 * cautious — it prints the rows it would delete and only commits when
 * `--apply` is passed.
 *
 * URGENT-SCRUB invariant: the existence of this file (and the
 * cleanup-vitest-books-standalone.mjs sibling) is asserted by
 * server/urgentScrubInvariant.test.ts so we never lose institutional
 * memory of the demo-data cleanup discipline.
 */

import process from "node:process";

const CANONICAL_TITLES = new Set([
  "Tuck Everlasting",
  "Michael's World",
  "Spectrum Science Grade 5",
  "180 Days of Language for 5th Grade",
]);

const APPLY = process.argv.includes("--apply");

async function main() {
  // The dashboard exposes a tRPC route at /api/trpc/bookshelf.listAll.
  // We deliberately do not import server code here — this script is a
  // standalone operator tool, and we want it to work even when the
  // server module graph is broken.
  const url = process.env.DASHBOARD_URL || "http://localhost:3000";
  const bearer = process.env.DASHBOARD_BEARER || "";
  if (!bearer) {
    console.error(
      "[prune-bookshelf] DASHBOARD_BEARER env var is required (admin session token).",
    );
    process.exit(2);
  }
  const resp = await fetch(`${url}/api/trpc/bookshelf.listAll`, {
    headers: {
      Authorization: `Bearer ${bearer}`,
      Cookie: `__Host-msession=${bearer}`,
    },
  });
  if (!resp.ok) {
    console.error(`[prune-bookshelf] listAll ${resp.status}`);
    process.exit(3);
  }
  const data = await resp.json();
  const books = data?.result?.data?.json ?? [];
  const toDelete = books.filter((b) => !CANONICAL_TITLES.has(b.title));
  console.log(`[prune-bookshelf] keeping ${books.length - toDelete.length} canonical book(s)`);
  console.log(`[prune-bookshelf] would delete ${toDelete.length} non-canonical row(s):`);
  for (const b of toDelete) {
    console.log(`  - #${b.id}  ${b.title}`);
  }
  if (!APPLY) {
    console.log("[prune-bookshelf] dry-run only; rerun with --apply to commit.");
    return;
  }
  for (const b of toDelete) {
    const del = await fetch(`${url}/api/trpc/bookshelf.delete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearer}`,
        Cookie: `__Host-msession=${bearer}`,
      },
      body: JSON.stringify({ json: { id: b.id } }),
    });
    console.log(`[prune-bookshelf] deleted #${b.id} (${del.status})`);
  }
}

main().catch((e) => {
  console.error(`[prune-bookshelf] fatal: ${e?.message ?? e}`);
  process.exit(1);
});
