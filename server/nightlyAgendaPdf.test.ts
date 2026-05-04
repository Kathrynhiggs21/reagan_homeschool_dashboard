import { describe, it, expect } from "vitest";
import { buildAgendaPdf, hashAgenda } from "./_lib/agendaPdf";

const samplePayload = {
  forDate: "2026-05-04",
  dayLabel: "Monday, May 4",
  studentName: "Reagan",
  tutorName: "Marcy",
  tutorArrival: "9:00 AM",
  tutorDeparture: "1:00 PM",
  blocks: [
    {
      sortOrder: 1,
      startTime: "09:00",
      durationMin: 25,
      subjectName: "Math",
      subjectEmoji: "➕",
      title: "Fractions warm-up",
      description: "Khan Academy 5 problems",
      curriculumTopicCode: "5.NF.1",
      bookPageRefs: [],
      printablesAttached: 0,
    },
    {
      sortOrder: 2,
      startTime: "09:30",
      durationMin: 30,
      subjectName: "ELA",
      subjectEmoji: "📚",
      title: "Read Michael's World",
      description: null,
      curriculumTopicCode: "5.RL.1",
      bookPageRefs: [{ bookTitle: "Michael's World", fromPage: 31, toPage: 35 }],
      printablesAttached: 0,
    },
  ],
  tutorNotesYesterday: { tutorName: "Marcy", notes: "Reagan was sharp on math; struggled with grammar exercises." },
  schoolDayWindow: { start: "09:00", end: "13:00" },
};

describe("nightly agenda PDF builder", () => {
  it("renders a non-empty PDF buffer with %PDF header", async () => {
    const r = await buildAgendaPdf(samplePayload as any);
    expect(r.pdfBuffer).toBeInstanceOf(Buffer);
    expect(r.pdfBuffer.length).toBeGreaterThan(800);
    expect(r.pdfBuffer.subarray(0, 4).toString()).toBe("%PDF");
    expect(r.agendaHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces a stable hash for the same input", async () => {
    const a = await buildAgendaPdf(samplePayload as any);
    const b = await buildAgendaPdf(samplePayload as any);
    expect(a.agendaHash).toBe(b.agendaHash);
    expect(a.canonicalText).toBe(b.canonicalText);
  });

  it("produces a different hash when the agenda changes", async () => {
    const a = await buildAgendaPdf(samplePayload as any);
    const mutated = JSON.parse(JSON.stringify(samplePayload));
    mutated.blocks[0].title = "Fractions warm-up (new title)";
    const b = await buildAgendaPdf(mutated as any);
    expect(a.agendaHash).not.toBe(b.agendaHash);
  });

  it("canonical text includes tutor name + book page refs", async () => {
    const r = await buildAgendaPdf(samplePayload as any);
    expect(r.canonicalText).toContain("Tutor: Marcy");
    expect(r.canonicalText).toContain("Book: Michael's World pg.31-35");
    expect(r.canonicalText).toContain("(5.NF.1)");
  });

  it("hashAgenda is deterministic on the same canonical string", () => {
    const s = "AGENDA: 2026-05-04\nfoo\nbar";
    expect(hashAgenda(s)).toBe(hashAgenda(s));
    expect(hashAgenda(s)).toMatch(/^[0-9a-f]{64}$/);
  });
});
