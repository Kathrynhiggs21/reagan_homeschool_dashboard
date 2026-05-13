import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Push 57 (2026-05-13) — Demo-seed cleanup.
 *
 * Locks the three contracts that keep the books table from leaking
 * vitest fixtures into Mom's UI:
 *   1. The leaky listBooksFilter.test.ts now wraps its
 *      `caller.books.create(...)` in a try/finally so the cleanup
 *      `books.delete` runs even when an upstream assertion throws.
 *   2. listBooks() in server/db.ts continues to filter any title or
 *      author containing "vitest" so historical leaks stay invisible.
 *   3. routers.books.create carries a Push 57 marker comment so the
 *      audit trail is grep-able from CI.
 *
 * We deleted the 150 leaked __vitest book rows in production by hand;
 * these regression tests prevent the next leak.
 */

describe("Push 57 — demo-seed cleanup contracts", () => {
  const root = join(__dirname, "..");

  it("listBooksFilter test wraps create() in try/finally so cleanup runs on failure", () => {
    const src = readFileSync(join(root, "server/listBooksFilter.test.ts"), "utf8");
    expect(src).toContain("try {");
    expect(src).toContain("} finally {");
    // The cleanup call must live inside the finally block.
    const finallyIdx = src.indexOf("} finally {");
    const deleteIdx = src.indexOf("caller.books.delete", finallyIdx);
    expect(deleteIdx).toBeGreaterThan(finallyIdx);
    // Documents why the finally exists so future authors do not delete it.
    expect(src.toLowerCase()).toContain("push 57");
  });

  it("listBooks() in db.ts still filters any vitest-titled row out of the UI", () => {
    const src = readFileSync(join(root, "server/db.ts"), "utf8");
    const listBooksIdx = src.indexOf("export async function listBooks(");
    expect(listBooksIdx).toBeGreaterThan(-1);
    const slice = src.slice(listBooksIdx, listBooksIdx + 800);
    expect(slice).toContain("vitest");
    expect(slice).toMatch(/!t\.includes\(["']vitest["']\)/);
    expect(slice).toMatch(/!a\.includes\(["']vitest["']\)/);
  });

  it("books.create router carries the Push 57 marker comment", () => {
    const src = readFileSync(join(root, "server/routers.ts"), "utf8");
    const booksIdx = src.indexOf("books: router({");
    expect(booksIdx).toBeGreaterThan(-1);
    const createIdx = src.indexOf("create: protectedProcedure", booksIdx);
    expect(createIdx).toBeGreaterThan(-1);
    const slice = src.slice(createIdx, createIdx + 1200);
    expect(slice.toLowerCase()).toContain("push 57");
    expect(slice).toContain("__vitest");
  });
});
