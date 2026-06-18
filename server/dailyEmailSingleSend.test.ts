import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { summarizeForPdf } from "./_lib/agendaPdf";

/**
 * 2026-06-18 — Per Katy: adults should receive exactly ONE daily email — the
 * finished printables PDF. The old behavior fired THREE owner-facing messages:
 *   1. notifyOwner "school plan" summary (block list + Mastery Snapshot)
 *   2. the real sendEmail with the PDF + worksheets attached  ← keep this one
 *   3. a packet-audit notifyOwner ("N blocks printed with no work")
 * These tests lock in that (1) and (3) no longer send, and that the PDF cover
 * summary is clamped to a tidy preview.
 */

const ROOT = join(__dirname, "..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("summarizeForPdf — cover-card preview clamp", () => {
  it("returns empty for nullish", () => {
    expect(summarizeForPdf(null)).toBe("");
    expect(summarizeForPdf(undefined)).toBe("");
    expect(summarizeForPdf("")).toBe("");
  });

  it("strips raw URLs out of the preview", () => {
    const out = summarizeForPdf(
      "Watch this first: https://www.pbs.org/video/what-actually-makes-water-roll-off-a-ducks-back and learn why.",
    );
    expect(out).not.toMatch(/https?:\/\//);
  });

  it("drops === SECTION === scaffolding markers", () => {
    const out = summarizeForPdf(
      "Hydro means water today. === WATCH (~10 min) === some video stuff.",
    );
    expect(out).not.toContain("===");
  });

  it("takes the first sentence when reasonably sized", () => {
    const out = summarizeForPdf(
      "We are learning why water rolls off ducks. Then we test it in the lab with soap and feathers and lots more detail that goes on.",
    );
    expect(out).toBe("We are learning why water rolls off ducks.");
  });

  it("hard-caps very long single sentences with an ellipsis", () => {
    const long = "word ".repeat(80).trim() + " end";
    const out = summarizeForPdf(long, 160);
    expect(out.length).toBeLessThanOrEqual(161);
    expect(out.endsWith("\u2026")).toBe(true);
  });
});

describe("daily email is the PDF only — no summary, no audit email", () => {
  const routers = read("server/routers.ts");
  const assembler = read("server/_lib/agendaAssembler.ts");

  it("sendNow does NOT push the notifyOwner school-plan summary", () => {
    // The summary push was `notified = await notifyOwner({ title, content })`.
    // It must now be hard-disabled (notified = false) inside sendNow.
    expect(routers).toContain("const notified = false;");
    expect(routers).not.toContain("notified = await notifyOwner({ title, content });");
  });

  it("sendNow still sends the real email with the PDF attached", () => {
    expect(routers).toContain("buildPerBlockWorksheetAttachments");
    expect(routers).toMatch(/Agenda\.pdf`/);
    expect(routers).toContain("await sendEmail(");
  });

  it("sendNow email body is slimmed — no block dump / mastery in the HTML", () => {
    // The slimmed body points at the attachment instead of dumping blocks.
    expect(routers).toContain("Today's printables are attached as a PDF.");
    expect(routers).not.toContain("blockListHtml");
  });

  it("assembler no longer emails the packet-audit warning", () => {
    // The audit result is still computed (dashboard chip), but no notifyOwner.
    expect(assembler).toContain("auditPacket");
    expect(assembler).toContain("packetAuditResult = audit;");
    expect(assembler).not.toContain("formatAuditNotification");
    expect(assembler).not.toContain('notifyOwner(msg)');
  });
});
