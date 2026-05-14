import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Push 165 source-level wiring contract:
 *   - today.gradeWorksheetDeterministic exists as publicProcedure that
 *     dynamically imports gradeWorksheetDeterministic from the helper.
 *   - today.reaganChoiceTime exists as publicProcedure that dynamically
 *     imports pickReaganChoiceTime from the helper.
 *   - Both procedures are inside the today router (i.e., declared after
 *     bookshelfRollup and before tomorrowChoice — so they remain reachable
 *     from `trpc.today.*`).
 */
const ROUTERS = path.resolve(__dirname, "routers.ts");

describe("Push 165 wiring", () => {
  const src = fs.readFileSync(ROUTERS, "utf8");

  it("declares gradeWorksheetDeterministic as publicProcedure", () => {
    expect(src).toMatch(/gradeWorksheetDeterministic\s*:\s*publicProcedure/);
  });
  it("declares reaganChoiceTime as publicProcedure", () => {
    expect(src).toMatch(/reaganChoiceTime\s*:\s*publicProcedure/);
  });
  it("imports gradeWorksheet from the deterministic grader helper", () => {
    expect(src).toMatch(
      /gradeWorksheet[\s\S]{0,500}_lib\/deterministicWorksheetGrader/,
    );
  });
  it("imports pickReaganChoiceTime from the picker helper", () => {
    expect(src).toMatch(/pickReaganChoiceTime[\s\S]{0,500}_lib\/reaganChoiceTimePicker/);
  });
  it("both wires sit in the today router (between bookshelfRollup and tomorrowChoice)", () => {
    const bookshelfIdx = src.indexOf("bookshelfRollup");
    const graderIdx = src.indexOf("gradeWorksheetDeterministic");
    const pickerIdx = src.indexOf("reaganChoiceTime: publicProcedure");
    const tomorrowIdx = src.indexOf("tomorrowChoice: publicProcedure");
    expect(bookshelfIdx).toBeGreaterThan(0);
    expect(graderIdx).toBeGreaterThan(bookshelfIdx);
    expect(pickerIdx).toBeGreaterThan(graderIdx);
    expect(tomorrowIdx).toBeGreaterThan(pickerIdx);
  });
});
