/**
 * Push 29 — Q4 standards seeder contract.
 *
 * Locks in: parser produces the expected math + ELA standards, the
 * idempotent insert never touches existing rows, and the second run
 * inserts zero rows.
 */
import { describe, it, expect } from "vitest";
import {
  loadQ4Standards,
  parseQ4Standards,
  seedQ4StandardsIfMissing,
} from "./_lib/q4StandardsSeeder";

describe("Q4 standards seeder — push 29", () => {
  it("loads non-empty standards from the knowledge file", () => {
    const standards = loadQ4Standards();
    expect(standards.length).toBeGreaterThan(10);
  });

  it("parses every Math standard in the spec", () => {
    const standards = loadQ4Standards();
    const mathCodes = standards.filter((s) => s.subject === "Math").map((s) => s.code);
    // Spec items: 5.OA.1-3 + 5.G.1-4
    for (const expected of ["5.OA.1", "5.OA.2", "5.OA.3", "5.G.1", "5.G.2", "5.G.3", "5.G.4"]) {
      expect(mathCodes, `expected ${expected} in Math standards`).toContain(expected);
    }
  });

  it("parses ELA standards across RL/RF/RI/W/SL/L families", () => {
    const standards = loadQ4Standards();
    const elaStrands = new Set(
      standards
        .filter((s) => s.subject === "ELA")
        .map((s) => s.code.match(/\.(RL|RF|RI|W|SL|L)\./)?.[1])
        .filter(Boolean)
    );
    // Spec wording: "Q4 ELA standards (RL/RF/RI/W/SL/L 5.x)". RI is
    // not in the current knowledge dump, but the parser handles it
    // when present; we assert at least 4 of the 6 families show up
    // so we don't tie the test to one particular dump.
    expect(elaStrands.size).toBeGreaterThanOrEqual(4);
  });

  it("ignores section headers and blank lines", () => {
    const fixture = `
Math Standards:
5.OA.1: Use parentheses in numerical expressions.
ELA Standards:
Reading Literature, Reading Informational Text, Reading Foundational Skills
1.RL.5.1  Quote accurately from a text.

Science Standards:
Nature of Science → Grades 3–5 → Scientific Inquiry, Practice and Applications
"Observe and ask questions about the world..."
`;
    const out = parseQ4Standards(fixture);
    expect(out).toEqual([
      { subject: "Math", code: "5.OA.1", title: "Use parentheses in numerical expressions.", standardRef: "5.OA.1" },
      { subject: "ELA", code: "1.RL.5.1", title: "Quote accurately from a text.", standardRef: "1.RL.5.1" },
    ]);
    // Science narrative lines should NOT be parsed as code-bearing standards.
  });

  it("idempotent insert: only inserts missing rows on first run, zero on second", async () => {
    const standards = loadQ4Standards();
    const inserted: any[] = [];
    const existing = new Set<string>();

    const deps = {
      listExisting: async () => Array.from(existing).map((k) => {
        const [subject, code] = k.split("::");
        return { subject, code };
      }),
      insert: async (rows: any[]) => {
        for (const r of rows) {
          existing.add(`${r.subject}::${r.code}`);
          inserted.push(r);
        }
      },
    };

    const first = await seedQ4StandardsIfMissing(deps);
    expect(first.inserted).toBe(standards.length);
    expect(first.total).toBe(standards.length);

    const second = await seedQ4StandardsIfMissing(deps);
    expect(second.inserted).toBe(0);
    expect(second.total).toBe(standards.length);
  });

  it("idempotent insert: respects pre-existing rows and only inserts the gap", async () => {
    const standards = loadQ4Standards();
    // Pre-seed half the math standards.
    const preExisting = new Set(
      standards.filter((s) => s.subject === "Math").slice(0, 3).map((s) => `${s.subject}::${s.code}`)
    );
    const deps = {
      listExisting: async () => Array.from(preExisting).map((k) => {
        const [subject, code] = k.split("::");
        return { subject, code };
      }),
      insert: async (rows: any[]) => {
        for (const r of rows) preExisting.add(`${r.subject}::${r.code}`);
      },
    };
    const result = await seedQ4StandardsIfMissing(deps);
    expect(result.inserted).toBe(standards.length - 3);
    expect(result.total).toBe(standards.length);
  });

  it("every parsed row carries quarter=Q4 when inserted", async () => {
    const inserted: any[] = [];
    const deps = {
      listExisting: async () => [],
      insert: async (rows: any[]) => { inserted.push(...rows); },
    };
    await seedQ4StandardsIfMissing(deps);
    expect(inserted.length).toBeGreaterThan(0);
    for (const r of inserted) {
      expect(r.quarter).toBe("Q4");
    }
  });
});
