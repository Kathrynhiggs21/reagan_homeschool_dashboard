#!/usr/bin/env node
/**
 * scripts/cleanup-vitest-books-standalone.mjs (v3.28, 2026-06-01)
 * ================================================================
 *
 * Pre-existing evidence script kept on disk so future contributors
 * remember why we have a `dbOverride` mechanism for db-touching tests.
 *
 * Background: before commit 97b528c (2026-05-30), several vitest specs
 * (notably server/drivePushDedupe.test.ts and server/bookshelf*.test.ts)
 * were hitting the live TiDB pool. Each test run inserted demo/fixture
 * rows that polluted production tables. The most visible artifact was
 * the `Test Book 1777379912525` row in the `books` table, but the same
 * pattern produced the 4 placeholder URL rows in drive_push_queue that
 * we cleaned up in v3.24 and the 182 "Untitled" Drive files we cleaned
 * up in v3.23.
 *
 * This standalone script is the canonical "panic button" to scrub any
 * vitest-pattern row from the `books` table. It exists side-by-side
 * with prune_bookshelf_to_four.mjs so the URGENT-SCRUB invariant test
 * has two distinct evidence files to assert on (both lifestyle scripts
 * + their distinct semantics are required so the cleanup discipline
 * cannot silently disappear).
 *
 * Usage:
 *
 *   node scripts/cleanup-vitest-books-standalone.mjs           # dry-run
 *   node scripts/cleanup-vitest-books-standalone.mjs --apply   # commit
 *
 * Recognised vitest-test row patterns (case-insensitive substring match
 * on `title`):
 *
 *   - "vitest"
 *   - "test book "
 *   - "fixture"
 *   - "placeholder"
 */

import process from "node:process";

const PATTERNS = [/vitest/i, /test book\s/i, /fixture/i, /placeholder/i];
const APPLY = process.argv.includes("--apply");

function looksLikeTestRow(book) {
  const title = String(book?.title ?? "");
  return PATTERNS.some((p) => p.test(title));
}

async function main() {
  const url = process.env.DASHBOARD_URL || "http://localhost:3000";
  const bearer = process.env.DASHBOARD_BEARER || "";
  if (!bearer) {
    console.error(
      "[cleanup-vitest-books] DASHBOARD_BEARER env var is required (admin session token).",
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
    console.error(`[cleanup-vitest-books] listAll ${resp.status}`);
    process.exit(3);
  }
  const data = await resp.json();
  const books = data?.result?.data?.json ?? [];
  const toDelete = books.filter(looksLikeTestRow);
  console.log(
    `[cleanup-vitest-books] would delete ${toDelete.length} test-shaped book(s) out of ${books.length} total:`,
  );
  for (const b of toDelete) {
    console.log(`  - #${b.id}  ${b.title}`);
  }
  if (!APPLY) {
    console.log("[cleanup-vitest-books] dry-run only; rerun with --apply to commit.");
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
    console.log(`[cleanup-vitest-books] deleted #${b.id} (${del.status})`);
  }
}

main().catch((e) => {
  console.error(`[cleanup-vitest-books] fatal: ${e?.message ?? e}`);
  process.exit(1);
});
