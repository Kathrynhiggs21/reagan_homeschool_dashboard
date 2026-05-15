/**
 * May 15, 2026 — BlockEditor full-field save contract.
 *
 * Before this push, BlockEditor's save() in edit mode forwarded only
 * { id, title, description, durationMin, sortOrder } — startTime, blockType,
 * and subjectSlug were silently dropped on save. Mom or Grandma would change
 * a block's start time in the dialog, hit Save, and the value never
 * persisted.
 *
 * This test locks the fix in by source inspection (no React test runtime
 * needed): the update mutation call must forward every editable field the
 * form exposes, and the form must expose a Subject selector.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");
const EDITOR_SRC = readFileSync(
  join(ROOT, "client", "src", "components", "BlockEditor.tsx"),
  "utf8",
);
const ROUTERS_SRC = readFileSync(
  join(ROOT, "server", "routers.ts"),
  "utf8",
);

describe("May 15 2026 — BlockEditor full-field save contract", () => {
  it("form mounts a Subject Select (subject is editable)", () => {
    // Subject query is loaded, and a "Subject" label exists in the JSX.
    expect(EDITOR_SRC).toContain("trpc.subjects.list.useQuery");
    expect(EDITOR_SRC).toMatch(/<Label>\s*Subject\s*<\/Label>/);
  });

  it("subjectSlug state is wired into the Select", () => {
    expect(EDITOR_SRC).toMatch(/setSubjectSlug/);
    // The Select value must come from the state, not be hard-coded.
    expect(EDITOR_SRC).toMatch(/value=\{subjectSlug\}/);
  });

  it("update mutation forwards every editable form field (no silent drop)", () => {
    // Locate the update branch's mutateAsync payload.
    const updateMatch = EDITOR_SRC.match(
      /updateM\.mutateAsync\(\{([\s\S]*?)\}\)/,
    );
    expect(updateMatch).not.toBeNull();
    const payload = updateMatch![1];
    // Every field the form exposes MUST be in the payload.
    for (const field of [
      "id",
      "title",
      "description",
      "blockType",
      "durationMin",
      "startTime",
      "sortOrder",
      "subjectSlug",
    ]) {
      expect(payload, `update payload should include ${field}`).toContain(field);
    }
  });

  it("create mutation forwards subjectSlug too (parity with update)", () => {
    const createMatch = EDITOR_SRC.match(
      /createM\.mutateAsync\(\{([\s\S]*?)\} as any\)|createM\.mutateAsync\(\{([\s\S]*?)\}\)/,
    );
    expect(createMatch).not.toBeNull();
    const payload = (createMatch![1] || createMatch![2]) as string;
    expect(payload).toContain("subjectSlug");
  });

  it("Radix Select.Item never receives empty string value (uses NO_SUBJECT_VALUE sentinel)", () => {
    // Empty-string Select.Item is forbidden by Radix. We use a sentinel.
    expect(EDITOR_SRC).toContain("NO_SUBJECT_VALUE");
    expect(EDITOR_SRC).not.toMatch(/<SelectItem\s+value=""/);
  });

  it("save() normalizes the sentinel back to null before sending to the server", () => {
    // The server expects subjectSlug: string | null, never the sentinel literal.
    expect(EDITOR_SRC).toMatch(
      /subjectSlug\s*===\s*NO_SUBJECT_VALUE\s*\?\s*null\s*:\s*subjectSlug/,
    );
  });

  it("blocks.update server procedure still accepts every field BlockEditor sends", () => {
    // Verify the server schema actually accepts what the client now sends.
    // The blocks.update procedure is the one whose input schema includes
    // durationMin (plans.update does not), so we scan every match and pick
    // the one that actually contains the durationMin field within its slice.
    const re = /update:\s*familyAdminProcedure\.input\(z\.object\(\{/g;
    let slice = "";
    for (let m; (m = re.exec(ROUTERS_SRC)) !== null; ) {
      const candidate = ROUTERS_SRC.slice(m.index, m.index + 1500);
      if (candidate.includes("durationMin")) {
        slice = candidate;
        break;
      }
    }
    expect(slice.length).toBeGreaterThan(0);
    for (const field of [
      "title",
      "description",
      "blockType",
      "durationMin",
      "startTime",
      "sortOrder",
      "subjectSlug",
    ]) {
      expect(slice, `blocks.update should accept ${field}`).toContain(field);
    }
  });

  it("update procedure stays behind familyAdminProcedure (defense-in-depth, Reagan can't write)", () => {
    expect(ROUTERS_SRC).toMatch(/\n\s*update:\s*familyAdminProcedure\.input/);
  });

  it("save() invalidates the blocks.list cache after a successful save", () => {
    expect(EDITOR_SRC).toContain("utils.blocks.list.invalidate");
  });
});
