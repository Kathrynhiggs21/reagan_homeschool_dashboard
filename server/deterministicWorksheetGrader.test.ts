import { describe, it, expect } from "vitest";
import {
  gradeWorksheet,
  type WorksheetItem,
  type ReaganAnswer,
} from "./_lib/deterministicWorksheetGrader";

const items: WorksheetItem[] = [
  { itemId: "q1", kind: "fill-in", prompt: "A word for a person, place, or thing", expected: "noun", accept: ["a noun"] },
  { itemId: "q2", kind: "multiple-choice", prompt: "Which is a primary color?", expected: "Red", choices: ["Red", "Green", "Purple"] },
  { itemId: "q3", kind: "number", prompt: "How many cm in a meter?", expected: 100, unit: "cm", tolerance: 0 },
  { itemId: "q4", kind: "boolean", prompt: "The Earth is flat.", expected: false },
  { itemId: "q5", kind: "fill-in", prompt: "Capital of Ohio", expected: "Columbus" },
];

function answer(id: string, raw: string): ReaganAnswer { return { itemId: id, raw }; }

describe("Push 163 — gradeWorksheet", () => {
  it("rejects non-array inputs", () => {
    expect(() => gradeWorksheet(null as any, [])).toThrow();
    expect(() => gradeWorksheet([], null as any)).toThrow();
  });

  it("all-correct gives 100% and a great-job kid line", () => {
    const r = gradeWorksheet(items, [
      answer("q1", "noun"),
      answer("q2", "Red"),
      answer("q3", "100 cm"),
      answer("q4", "no"),
      answer("q5", "Columbus"),
    ]);
    expect(r.scorePct).toBe(100);
    expect(r.kidLine.toLowerCase()).toMatch(/great job/);
  });

  it("fill-in is normalized (case + trailing punctuation + extra space)", () => {
    const r = gradeWorksheet([items[0]], [answer("q1", "  Noun.  ")]);
    expect(r.items[0].status).toBe("right");
    expect(r.items[0].pointsEarned).toBe(1);
  });

  it("fill-in accept-list works", () => {
    const r = gradeWorksheet([items[0]], [answer("q1", "a noun")]);
    expect(r.items[0].status).toBe("right");
  });

  it("fill-in close-call (off by trailing s/es) → half credit", () => {
    const r = gradeWorksheet([items[0]], [answer("q1", "nouns")]);
    expect(r.items[0].status).toBe("close");
    expect(r.items[0].pointsEarned).toBe(0.5);
  });

  it("multiple-choice catches a question-template error (expected not in choices)", () => {
    const bad: WorksheetItem = {
      itemId: "qX",
      kind: "multiple-choice",
      prompt: "?",
      expected: "Yellow",
      choices: ["Red", "Blue"],
    };
    const r = gradeWorksheet([bad], [answer("qX", "Red")]);
    expect(r.items[0].status).toBe("ungradable");
    expect(r.scorePct).toBe(0);
  });

  it("number with right value but missing unit → half credit by default", () => {
    const r = gradeWorksheet([items[2]], [answer("q3", "100")]);
    expect(r.items[0].status).toBe("close");
    expect(r.items[0].pointsEarned).toBe(0.5);
    expect(r.items[0].explanation.toLowerCase()).toMatch(/unit/);
  });

  it("number tolerance: within tol → right; just outside but within 2*tol → close", () => {
    const item: WorksheetItem = { itemId: "qN", kind: "number", prompt: "?", expected: 50, tolerance: 2 };
    expect(gradeWorksheet([item], [answer("qN", "51")]).items[0].status).toBe("right");
    expect(gradeWorksheet([item], [answer("qN", "53")]).items[0].status).toBe("close");
    expect(gradeWorksheet([item], [answer("qN", "60")]).items[0].status).toBe("wrong");
  });

  it("boolean accepts yes/no/true/false/y/n/1/0 case-insensitive", () => {
    const item: WorksheetItem = { itemId: "qB", kind: "boolean", prompt: "?", expected: true };
    for (const v of ["yes", "Y", "true", "T", "1"]) {
      expect(gradeWorksheet([item], [answer("qB", v)]).items[0].status).toBe("right");
    }
    for (const v of ["no", "N", "false", "F", "0"]) {
      expect(gradeWorksheet([item], [answer("qB", v)]).items[0].status).toBe("wrong");
    }
  });

  it("blank answers are flagged 'blank' (zero points, kid-friendly explanation)", () => {
    const r = gradeWorksheet(items, [answer("q1", ""), answer("q2", "   "), answer("q3", ""), answer("q4", ""), answer("q5", "")]);
    for (const it of r.items) {
      expect(it.status).toBe("blank");
      expect(it.pointsEarned).toBe(0);
    }
    expect(r.scorePct).toBe(0);
  });

  it("missing answer (no row at all) is treated as blank, not as wrong", () => {
    const r = gradeWorksheet(items, []);
    for (const it of r.items) expect(it.status).toBe("blank");
  });

  it("explanations are kid-readable (no 'undefined', no jargon)", () => {
    const r = gradeWorksheet(items, [
      answer("q1", "verb"),
      answer("q2", "Purple"),
      answer("q3", "10 cm"),
      answer("q4", "yes"),
      answer("q5", "Cleveland"),
    ]);
    for (const it of r.items) {
      expect(it.explanation).not.toMatch(/undefined|null|NaN/);
      expect(it.explanation.length).toBeGreaterThan(2);
    }
  });

  it("scorePct is rounded integer and pointsMax respected", () => {
    const item: WorksheetItem = { itemId: "qP", kind: "fill-in", prompt: "?", expected: "yes", pointsMax: 4 };
    const r = gradeWorksheet([item], [answer("qP", "yes")]);
    expect(r.items[0].pointsMax).toBe(4);
    expect(r.items[0].pointsEarned).toBe(4);
    expect(r.scorePct).toBe(100);
  });

  it("kidLine adapts band: high / good / mid / low", () => {
    const it1: WorksheetItem = { itemId: "a", kind: "boolean", prompt: "?", expected: true };
    const it2: WorksheetItem = { itemId: "b", kind: "boolean", prompt: "?", expected: true };
    const it3: WorksheetItem = { itemId: "c", kind: "boolean", prompt: "?", expected: true };
    const it4: WorksheetItem = { itemId: "d", kind: "boolean", prompt: "?", expected: true };
    const all = [it1, it2, it3, it4];
    const allYes = [answer("a", "yes"), answer("b", "yes"), answer("c", "yes"), answer("d", "yes")];
    const threeYes = [answer("a", "yes"), answer("b", "yes"), answer("c", "yes"), answer("d", "no")];
    const oneYes = [answer("a", "yes"), answer("b", "no"), answer("c", "no"), answer("d", "no")];
    expect(gradeWorksheet(all, allYes).kidLine.toLowerCase()).toMatch(/great job/);
    expect(gradeWorksheet(all, threeYes).kidLine.toLowerCase()).toMatch(/good work/);
    expect(gradeWorksheet(all, oneYes).kidLine.toLowerCase()).toMatch(/slow down|try a few/);
  });
});
