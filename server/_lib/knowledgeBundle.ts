/**
 * knowledgeBundle — loads the curated static knowledge files placed in
 * `server/_knowledge/` (Q4 standards, IEP snapshot, scope/sequence, the
 * existing assignment tracker, and a thin slice of the IHHS course catalog
 * for forward planning) and renders them into a compact reference block
 * the AI agenda generator can drop into its system prompt.
 *
 * Intentionally synchronous + cached: the files ship inside the build,
 * so we read them once at boot and reuse the same Buffer for every
 * `generateScheduleDraft` call. This keeps the LLM prompt deterministic
 * and avoids per-request disk hits.
 *
 * The HS catalog is large; we only surface a 30-line excerpt under a
 * "Looking ahead" label so the model knows it exists without flooding
 * the prompt with unrelated data.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

let cache: KnowledgeBundle | null = null;

export type KnowledgeBundle = {
  q4Standards: string;
  scopeSequence: string;
  iepSnapshot: string;
  assignmentTracker: string;
  hsCatalogExcerpt: string;
  /** Concatenated reference block ready to inline into a system prompt. */
  promptBlock: string;
  /** Approximate character count, useful for tests + logs. */
  totalChars: number;
};

function safeRead(p: string, max = 40000): string {
  try {
    if (!existsSync(p)) return "";
    const raw = readFileSync(p, "utf8");
    return raw.length > max ? raw.slice(0, max) + "\n…(truncated)" : raw;
  } catch {
    return "";
  }
}

/**
 * Resolve the knowledge folder relative to this file rather than the
 * runtime CWD. Works under both `tsx` (dev) and the built bundle.
 */
function knowledgeDir(): string {
  // ESM module path → server/_lib/, knowledge dir is sibling: server/_knowledge/
  // We avoid referencing __dirname directly because under prod ESM it is not
  // defined and even the catch branch was throwing ReferenceError at runtime.
  let here: string | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const url = (eval("import.meta") as any)?.url as string | undefined;
    if (url) here = dirname(fileURLToPath(url));
  } catch { /* swallow */ }
  if (!here) {
    try {
      // typeof guard so referencing the symbol never throws.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const maybe = (globalThis as any).__dirname as string | undefined;
      if (typeof maybe === "string") here = maybe;
    } catch { /* swallow */ }
  }
  if (!here) {
    // Last-ditch: assume the build keeps _knowledge under server/. Resolve
    // against the process CWD when neither ESM nor CJS metadata is present.
    here = join(process.cwd(), "server", "_lib");
  }
  return join(here, "..", "_knowledge");
}

export function loadKnowledgeBundle(force = false): KnowledgeBundle {
  if (cache && !force) return cache;
  const dir = knowledgeDir();
  const q4Standards = safeRead(join(dir, "q4_standards.txt"), 8000);
  const scopeSequence = safeRead(join(dir, "scope_sequence.md"), 8000);
  const iepSnapshot = safeRead(join(dir, "iep_snapshot.md"), 8000);
  const assignmentTracker = safeRead(join(dir, "assignment_tracker.csv"), 12000);
  const hsCatalogFull = safeRead(join(dir, "hs_catalog.txt"), 200000);
  const hsCatalogExcerpt = hsCatalogFull
    .split("\n")
    .slice(0, 40)
    .join("\n")
    .slice(0, 4000);

  const promptBlock = [
    "===== REAGAN KNOWLEDGE BUNDLE (use as ground truth) =====",
    "",
    "----- Ohio 5th-grade Q4 standards (current focus) -----",
    q4Standards || "(missing)",
    "",
    "----- IEP snapshot + accommodations -----",
    iepSnapshot || "(missing)",
    "",
    "----- 5th-grade scope & sequence checklist -----",
    scopeSequence || "(missing)",
    "",
    "----- Existing prebuilt assignment tracker (CSV) -----",
    assignmentTracker || "(missing)",
    "",
    "----- Looking ahead: IHHS 2026-2027 catalog excerpt (for forward planning only) -----",
    hsCatalogExcerpt || "(missing)",
    "",
    "===== END KNOWLEDGE BUNDLE =====",
  ].join("\n");

  cache = {
    q4Standards,
    scopeSequence,
    iepSnapshot,
    assignmentTracker,
    hsCatalogExcerpt,
    promptBlock,
    totalChars: promptBlock.length,
  };
  return cache;
}

/** Test-only: reset the in-memory cache so a fresh disk read is forced. */
export function _resetKnowledgeBundleCache() {
  cache = null;
}
