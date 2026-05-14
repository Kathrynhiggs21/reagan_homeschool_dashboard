import { describe, it, expect } from "vitest";
import {
  buildExitTicket,
  type ExitTicketBlock,
} from "./_lib/exitTicketBuilder";

const isoMay15 = "2026-05-15";

const fullDay: ExitTicketBlock[] = [
  { blockId: "math1", label: "math", ran: true },
  { blockId: "read1", label: "reading", ran: true },
  { blockId: "sci1", label: "science", ran: true },
  { blockId: "art1", label: "art", ran: true },
  { blockId: "rec1", label: "recess", ran: true },
];

describe("Push 175 — exit ticket builder", () => {
  it("emits exactly 3 prompts in mood -> favorite -> tomorrow order", () => {
    const t = buildExitTicket({ iso: isoMay15, name: "Reagan", blocks: fullDay });
    expect(t.prompts).toHaveLength(3);
    expect(t.prompts.map((p) => p.promptId)).toEqual([
      "mood",
      "favorite",
      "tomorrow",
    ]);
  });

  it("mood prompt always offers the 4 fixed options in fixed order", () => {
    const t = buildExitTicket({ iso: isoMay15, name: "Reagan", blocks: fullDay });
    const mood = t.prompts[0];
    expect(mood.options.map((o) => o.value)).toEqual([
      "great",
      "okay",
      "tired",
      "frustrated",
    ]);
    expect(mood.allowFreeText).toBe(false);
  });

  it("favorite options are capped at 4 and built from actual ran blocks", () => {
    const t = buildExitTicket({ iso: isoMay15, name: "Reagan", blocks: fullDay });
    const fav = t.prompts[1];
    expect(fav.options.length).toBeGreaterThanOrEqual(2);
    expect(fav.options.length).toBeLessThanOrEqual(4);
    for (const opt of fav.options) {
      // Each label fits on a phone tap (rough cap: 22 chars).
      expect(opt.label.length).toBeLessThanOrEqual(22);
    }
  });

  it("favorite falls back to today/just-okay/tough when no blocks ran", () => {
    const skipped: ExitTicketBlock[] = [
      { blockId: "math1", label: "math", ran: false },
    ];
    const t = buildExitTicket({ iso: isoMay15, name: "Reagan", blocks: skipped });
    const fav = t.prompts[1];
    const labels = fav.options.map((o) => o.label).join("|");
    expect(labels).toMatch(/today felt good|today was just okay|today was tough/);
  });

  it("tomorrow prompt offers the 4 quick-picks and allows free text", () => {
    const t = buildExitTicket({ iso: isoMay15, name: "Reagan", blocks: fullDay });
    const tom = t.prompts[2];
    expect(tom.options.map((o) => o.value)).toEqual([
      "more outside",
      "more art",
      "more games",
      "more reading",
    ]);
    expect(tom.allowFreeText).toBe(true);
  });

  it("is deterministic per (iso, name) — same input -> same output", () => {
    const a = buildExitTicket({ iso: isoMay15, name: "Reagan", blocks: fullDay });
    const b = buildExitTicket({ iso: isoMay15, name: "Reagan", blocks: fullDay });
    expect(a).toEqual(b);
  });

  it("all questions and options are kid-readable (no jargon)", () => {
    const t = buildExitTicket({ iso: isoMay15, name: "Reagan", blocks: fullDay });
    const banned = /\brate\b|\bscale\b|evaluate|assessment|mindfulness|reflection|anxious|depress|disorder|adhd|autism/i;
    for (const p of t.prompts) {
      expect(p.question.length).toBeLessThanOrEqual(50);
      expect(p.question).not.toMatch(banned);
      for (const opt of p.options) {
        expect(opt.label).not.toMatch(banned);
      }
    }
  });

  it("when 5+ blocks ran, favorite still includes 'all of it' option only when room", () => {
    const t = buildExitTicket({ iso: isoMay15, name: "Reagan", blocks: fullDay });
    const fav = t.prompts[1];
    // Capped at 4 — picked blocks fill the slots, no 'all' added.
    expect(fav.options).toHaveLength(4);
    expect(fav.options.map((o) => o.value)).not.toContain("all");
  });

  it("when exactly 2 ran blocks, favorite gets the 2 + 'all of it'", () => {
    const two: ExitTicketBlock[] = [
      { blockId: "a", label: "math", ran: true },
      { blockId: "b", label: "reading", ran: true },
    ];
    const t = buildExitTicket({ iso: isoMay15, name: "Reagan", blocks: two });
    const fav = t.prompts[1];
    expect(fav.options).toHaveLength(3);
    expect(fav.options.map((o) => o.value)).toContain("all");
  });
});
