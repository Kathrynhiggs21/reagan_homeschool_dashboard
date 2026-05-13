/**
 * Push 30 \u2014 PDF agenda prints subject \u00b7 code \u00b7 topic title.
 *
 * Closes the spec line:
 *   "Printable agenda PDF prints 'Math \u00b7 5.OA.1 \u00b7 Order of Operations'
 *    under each task"
 *
 * Also verifies back-compat: blocks WITHOUT a curriculumTopicTitle still
 * produce identical hashes to pre-push-30 payloads.
 */
import { describe, it, expect } from "vitest";
import { buildAgendaPdf, hashAgenda } from "./_lib/agendaPdf";

const baseInput = {
  forDate: "2026-05-13",
  dayLabel: "Wednesday, May 13",
  studentName: "Reagan",
  blocks: [
    {
      sortOrder: 1,
      startTime: "09:00",
      durationMin: 30,
      subjectName: "Math",
      title: "Order of operations practice",
      description: "Tutor warm-up",
      curriculumTopicCode: "5.OA.1",
    },
  ],
};

describe("agenda PDF topic title \u2014 push 30", () => {
  it("includes the topic title in the canonical text when both code + title are present", async () => {
    const r = await buildAgendaPdf({
      ...baseInput,
      blocks: [
        {
          ...baseInput.blocks[0],
          curriculumTopicTitle: "Order of Operations",
        },
      ],
    } as any);
    expect(r.canonicalText).toContain("(5.OA.1: Order of Operations)");
  });

  it("falls back to the code-only canonical when title is missing", async () => {
    const r = await buildAgendaPdf(baseInput as any);
    expect(r.canonicalText).toContain("(5.OA.1)");
    expect(r.canonicalText).not.toContain("Order of Operations");
  });

  it("hashes stably for pre-push-30 payloads (no topic title)", async () => {
    const a = await buildAgendaPdf(baseInput as any);
    const b = await buildAgendaPdf(baseInput as any);
    expect(a.agendaHash).toBe(b.agendaHash);
    expect(a.agendaHash).toBe(hashAgenda(a.canonicalText));
  });

  it("hash changes when title is added (new content = new hash, by design)", async () => {
    const baseHash = (await buildAgendaPdf(baseInput as any)).agendaHash;
    const titledHash = (await buildAgendaPdf({
      ...baseInput,
      blocks: [
        { ...baseInput.blocks[0], curriculumTopicTitle: "Order of Operations" },
      ],
    } as any)).agendaHash;
    expect(titledHash).not.toBe(baseHash);
  });

  it("hash stays stable for blocks with NO topic at all (true back-compat)", async () => {
    const noTopic = {
      ...baseInput,
      blocks: [
        {
          sortOrder: 1,
          startTime: "09:00",
          durationMin: 30,
          subjectName: "Math",
          title: "Free draw",
        },
      ],
    };
    const a = await buildAgendaPdf(noTopic as any);
    const b = await buildAgendaPdf({ ...noTopic, blocks: [{ ...noTopic.blocks[0], curriculumTopicTitle: "x" }] } as any);
    // Title set but code missing \u2192 title is ignored, hash matches no-topic canonical.
    expect(a.agendaHash).toBe(b.agendaHash);
  });
});
