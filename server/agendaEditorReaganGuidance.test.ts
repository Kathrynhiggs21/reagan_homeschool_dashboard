/**
 * The AI Agenda Editor must include Reagan-specific What-Works guidance in
 * every system prompt so the LLM does not regenerate generic advice that
 * contradicts the IEP. Asserted by inspecting the module source — the
 * SYSTEM_PROMPT itself isn't exported.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { whatWorksPromptAddendum } from "./_lib/whatWorks";

describe("Agenda editor injects Reagan-specific guidance into the LLM prompt", () => {
  const src = readFileSync(resolve(__dirname, "_lib/agendaEditor.ts"), "utf8");

  it("imports whatWorksPromptAddendum", () => {
    expect(src).toContain('from "./whatWorks"');
    expect(src).toContain("whatWorksPromptAddendum");
  });

  it("interpolates the addendum into SYSTEM_PROMPT", () => {
    expect(src).toContain("${whatWorksPromptAddendum()}");
  });

  it("addendum content includes the canonical situation labels (smoke check)", () => {
    const text = whatWorksPromptAddendum();
    expect(text).toContain("Morning Arrival");
    expect(text).toContain("Anxiety Rising");
    expect(text).toContain("During Crisis");
    expect(text).toContain("Writing Tasks");
  });

  it("system prompt has explicit anxious/shorten/yellow guidance line", () => {
    expect(src.toLowerCase()).toContain("yellow zone");
    expect(src.toLowerCase()).toContain("never add timed work");
  });
});
