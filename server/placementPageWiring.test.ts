import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Lock the contract that Reagan can actually run the placement flow:
 *   - /placement is a real route mounting the Placement component (NOT a redirect)
 *   - The page wires status, tasks, and submit on the client
 *   - The page never shows scoring / right / wrong language to Reagan
 *   - The submit mutation forwards exactly { placementTaskId, kidAnswer, feltIt }
 */

const PROJECT_ROOT = path.resolve(__dirname, "..");
const PLACEMENT_PATH = path.join(PROJECT_ROOT, "client/src/pages/Placement.tsx");
const APP_PATH = path.join(PROJECT_ROOT, "client/src/App.tsx");

const placementSrc = fs.readFileSync(PLACEMENT_PATH, "utf8");
const appSrc = fs.readFileSync(APP_PATH, "utf8");

describe("Placement page exists and is mounted", () => {
  it("Placement.tsx exports a default component", () => {
    expect(placementSrc).toMatch(/export default function Placement\b/);
  });

  it("App.tsx imports the Placement page", () => {
    expect(appSrc).toMatch(/import\s+Placement\s+from\s+["']\.\/pages\/Placement["']/);
  });

  it("App.tsx mounts <Placement /> at /placement (not a redirect)", () => {
    // Real Route, not Redirect
    expect(appSrc).toMatch(/<Route\s+path=["']\/placement["']\s+component=\{Placement\}\s*\/>/);
    // Make sure the legacy redirect was removed
    expect(appSrc).not.toMatch(/path=["']\/placement["']\s*>\s*<Redirect/);
  });
});

describe("Placement page wires the placement procedures", () => {
  it("calls trpc.placement.status.useQuery", () => {
    expect(placementSrc).toMatch(/trpc\.placement\.status\.useQuery/);
  });

  it("calls trpc.placement.tasks.useQuery with subjectSlug", () => {
    expect(placementSrc).toMatch(/trpc\.placement\.tasks\.useQuery\s*\(\s*\{\s*subjectSlug\b/);
  });

  it("calls trpc.placement.submit.useMutation", () => {
    expect(placementSrc).toMatch(/trpc\.placement\.submit\.useMutation/);
  });

  it("submit forwards placementTaskId + feltIt and optional kidAnswer", () => {
    expect(placementSrc).toMatch(/placementTaskId\s*:/);
    expect(placementSrc).toMatch(/feltIt\b/);
    // kidAnswer is forwarded (or undefined) — the keyword must appear in the mutate body
    expect(placementSrc).toMatch(/kidAnswer\b/);
  });
});

describe("Placement page is kid-friendly (no scoring language to Reagan)", () => {
  // Strip JSDoc/line comments so we don't false-positive on design notes,
  // then scan ONLY text that ends up rendered to Reagan: JSX text content
  // (between > and <) and the visible string props placeholder/title/aria-label.
  const stripped = placementSrc
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments incl. JSDoc
    .replace(/(^|[^:])\/\/.*$/gm, "$1"); // line comments (but not URLs)
  const jsxText = Array.from(stripped.matchAll(/>([^<>{}\n]{4,})</g)).map((m) =>
    m[1].toLowerCase().trim(),
  );
  const visibleProps = Array.from(
    stripped.matchAll(/(?:placeholder|title|aria-label)=["']([^"'\n]{4,})["']/g),
  ).map((m) => m[1].toLowerCase());
  const visible = [...jsxText, ...visibleProps];

  it("does not say 'wrong' / 'incorrect' to the kid", () => {
    for (const s of visible) {
      expect(s).not.toMatch(/\bwrong\b|\bincorrect\b/);
    }
  });

  it("does not say 'score' to the kid (use 'how it felt' instead)", () => {
    for (const s of visible) {
      expect(s).not.toMatch(/\bscores?\b/);
    }
  });

  it("offers easy / ok / hard / skip feltIt buttons", () => {
    expect(placementSrc).toMatch(/handleSubmit\(["']easy["']\)/);
    expect(placementSrc).toMatch(/handleSubmit\(["']ok["']\)/);
    expect(placementSrc).toMatch(/handleSubmit\(["']hard["']\)/);
    expect(placementSrc).toMatch(/handleSubmit\(["']skip["']/);
  });
});
