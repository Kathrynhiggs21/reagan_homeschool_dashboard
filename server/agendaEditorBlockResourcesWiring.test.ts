/**
 * v2.15 (2026-05-17) — AgendaEditor BlockResourcesPanel wiring tests.
 *
 * Source-pattern (string-grep) tests because vitest is configured for
 * the node environment (no jsdom). Locks the integration shape so a future
 * refactor cannot silently strip the panel from AgendaEditor or break the
 * tRPC procedure surface it depends on.
 *
 * Asserts:
 *  1. BlockResourcesPanel.tsx exists.
 *  2. It calls trpc.curriculum.topicByCode (resolve code → id).
 *  3. It calls trpc.curriculum.rollup (read).
 *  4. It calls trpc.curriculum.addResource (create).
 *  5. It calls trpc.curriculum.removeResource (delete).
 *  6. It accepts a `topicCode` prop and short-circuits when missing.
 *  7. AgendaEditor.tsx imports BlockResourcesPanel.
 *  8. AgendaEditor.tsx mounts <BlockResourcesPanel inside ManualBlockRow,
 *     forwarding curriculumTopicCode.
 *  9. routers.ts defines curriculum.topicByCode procedure.
 */

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const PANEL_PATH = path.join(ROOT, "client/src/components/BlockResourcesPanel.tsx");
const EDITOR_PATH = path.join(ROOT, "client/src/pages/AgendaEditor.tsx");
const ROUTERS_PATH = path.join(ROOT, "server/routers.ts");

function read(p: string): string {
  return fs.readFileSync(p, "utf8");
}

describe("v2.15 — BlockResourcesPanel wiring", () => {
  it("BlockResourcesPanel.tsx exists on disk", () => {
    expect(fs.existsSync(PANEL_PATH)).toBe(true);
  });

  it("BlockResourcesPanel uses trpc.curriculum.topicByCode to resolve code → id", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/trpc\.curriculum\.topicByCode\.useQuery/);
  });

  it("BlockResourcesPanel reads existing resources via trpc.curriculum.rollup", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/trpc\.curriculum\.rollup\.useQuery/);
  });

  it("BlockResourcesPanel creates resources via trpc.curriculum.addResource", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/trpc\.curriculum\.addResource\.useMutation/);
  });

  it("BlockResourcesPanel removes resources via trpc.curriculum.removeResource", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/trpc\.curriculum\.removeResource\.useMutation/);
  });

  it("BlockResourcesPanel accepts topicCode prop and bails out when missing", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/topicCode\s*:\s*string\s*\|\s*null\s*\|\s*undefined/);
    // Defensive null-bail (return null when no topicCode).
    expect(src).toMatch(/if\s*\(\s*!\s*topicCode\s*\)\s*return\s+null/);
  });

  it("BlockResourcesPanel invalidates the rollup cache after add/remove", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/utils\.curriculum\.rollup\.invalidate/);
  });

  it("AgendaEditor.tsx imports BlockResourcesPanel", () => {
    const src = read(EDITOR_PATH);
    expect(src).toMatch(/from\s+["']@\/components\/BlockResourcesPanel["']/);
    expect(src).toMatch(/import\s*\{\s*BlockResourcesPanel\s*\}/);
  });

  it("AgendaEditor.tsx mounts <BlockResourcesPanel forwarding curriculumTopicCode", () => {
    const src = read(EDITOR_PATH);
    expect(src).toMatch(/<BlockResourcesPanel\b/);
    // Must forward the block's topic code (not a hard-coded value).
    expect(src).toMatch(/topicCode=\{\s*block\.curriculumTopicCode/);
  });

  it("routers.ts defines curriculum.topicByCode protectedProcedure", () => {
    const src = read(ROUTERS_PATH);
    expect(src).toMatch(/topicByCode:\s*protectedProcedure/);
    // It should call resolveTopicId from topicCatalog.
    expect(src).toMatch(/resolveTopicId/);
  });

  it("v2.15 — addResource + removeResource are gated by familyAdminProcedure (adult-only writes)", () => {
    const src = read(ROUTERS_PATH);
    // Adult-only write protection: kid view (Reagan) cannot add or remove
    // resources even if she's signed in. Defense-in-depth at the procedure.
    expect(src).toMatch(/addResource:\s*familyAdminProcedure/);
    expect(src).toMatch(/removeResource:\s*familyAdminProcedure/);
  });

  it("BlockResourcesPanel surfaces explicit error UI for topicByCode + rollup failures", () => {
    const src = read(PANEL_PATH);
    // Both queries must have a visible error branch in the JSX.
    expect(src).toMatch(/topicByCode\.isError/);
    expect(src).toMatch(/rollup\.isError/);
    // Error message strings should reference the underlying error.
    expect(src).toMatch(/topicByCode\.error\?\.message/);
    expect(src).toMatch(/rollup\.error\?\.message/);
  });
});
