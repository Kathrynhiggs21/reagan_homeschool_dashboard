#!/usr/bin/env node
/**
 * Postbuild: copy server/_assets -> dist/_assets so the PDF brand kit
 * (Fredoka/Nunito TTFs + kiwi_logo.png) resolves next to the esbuild bundle
 * in the deployed runtime, where process.cwd() is NOT guaranteed to be the
 * repo root. pdfBrand.ts checks join(__thisDir, "_assets") first, which in
 * prod is dist/_assets.
 *
 * Idempotent. Never throws the build — logs and exits 0 even if the source
 * dir is missing, so a partial asset set can't block a deploy.
 */
import { existsSync, mkdirSync, readdirSync, copyFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const SRC = join(repoRoot, "server", "_assets");
const DEST = join(repoRoot, "dist", "_assets");

function copyDir(src, dest) {
  if (!existsSync(src)) {
    console.warn(`[copy-assets] source dir missing, skipping: ${src}`);
    return 0;
  }
  mkdirSync(dest, { recursive: true });
  let n = 0;
  for (const entry of readdirSync(src)) {
    const s = join(src, entry);
    const d = join(dest, entry);
    if (statSync(s).isDirectory()) {
      n += copyDir(s, d);
    } else {
      copyFileSync(s, d);
      n += 1;
    }
  }
  return n;
}

try {
  const count = copyDir(SRC, DEST);
  console.log(`[copy-assets] copied ${count} file(s) ${SRC} -> ${DEST}`);
} catch (err) {
  console.warn(`[copy-assets] non-fatal copy error: ${err?.message ?? err}`);
}
process.exit(0);
