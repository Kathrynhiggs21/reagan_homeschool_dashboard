/**
 * Push 116 (2026-05-13) — Khan / IXL deeplink builder contract.
 */
import { describe, it, expect } from "vitest";
import { buildKhanIxlDeeplink } from "./_lib/khanIxlDeeplink";

describe("Push 116 — Khan / IXL deeplink builder", () => {
  it("Khan + math (no topic) returns 5th-grade math root", () => {
    const r = buildKhanIxlDeeplink({ subject: "math", provider: "khan" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.url).toBe(
      "https://www.khanacademy.org/math/cc-fifth-grade-math",
    );
    expect(r.plan.topicScoped).toBe(false);
    expect(r.plan.topic).toBeUndefined();
  });

  it("IXL + math + topic appends slug segment", () => {
    const r = buildKhanIxlDeeplink({
      subject: "math",
      provider: "ixl",
      topic: "Fractions",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.url).toBe("https://www.ixl.com/math/grade-5/fractions");
    expect(r.plan.topicScoped).toBe(true);
    expect(r.plan.topic).toBe("fractions");
  });

  it("topic with spaces / punctuation is slugified", () => {
    const r = buildKhanIxlDeeplink({
      subject: "ela",
      provider: "ixl",
      topic: "Reading Comprehension!! (5th)",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.topic).toBe("reading-comprehension-5th");
    expect(r.plan.url.endsWith("/reading-comprehension-5th")).toBe(true);
  });

  it("blank or whitespace topic falls back to subject root", () => {
    for (const topic of ["", "   ", null, undefined]) {
      const r = buildKhanIxlDeeplink({
        subject: "spelling",
        provider: "khan",
        topic: topic as any,
      });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.plan.topicScoped).toBe(false);
      expect(r.plan.topic).toBeUndefined();
    }
  });

  it("subject + provider matching are case-insensitive", () => {
    const r = buildKhanIxlDeeplink({
      subject: "MATH" as any,
      provider: "Khan" as any,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.subject).toBe("math");
    expect(r.plan.provider).toBe("khan");
  });

  it("unknown subject is rejected with unknown-subject", () => {
    const r = buildKhanIxlDeeplink({
      subject: "art" as any,
      provider: "khan",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.rejectReason).toBe("unknown-subject");
  });

  it("unknown provider is rejected with unknown-provider", () => {
    const r = buildKhanIxlDeeplink({
      subject: "math",
      provider: "duolingo" as any,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.rejectReason).toBe("unknown-provider");
  });

  it("each canonical subject has both Khan and IXL roots", () => {
    const subjects = [
      "math",
      "ela",
      "science",
      "social-studies",
      "spelling",
    ] as const;
    for (const s of subjects) {
      const k = buildKhanIxlDeeplink({ subject: s, provider: "khan" });
      const i = buildKhanIxlDeeplink({ subject: s, provider: "ixl" });
      expect(k.ok && i.ok).toBe(true);
      if (k.ok) expect(k.plan.url.startsWith("https://")).toBe(true);
      if (i.ok) expect(i.plan.url.startsWith("https://")).toBe(true);
    }
  });

  it("topic that becomes empty after slugify falls back to subject root", () => {
    const r = buildKhanIxlDeeplink({
      subject: "math",
      provider: "ixl",
      topic: "!!! ___ !!!",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.topicScoped).toBe(false);
    expect(r.plan.topic).toBeUndefined();
  });

  it("non-string topic (number, object) falls back to subject root", () => {
    const r1 = buildKhanIxlDeeplink({
      subject: "math",
      provider: "ixl",
      topic: 42 as any,
    });
    const r2 = buildKhanIxlDeeplink({
      subject: "math",
      provider: "ixl",
      topic: { foo: "bar" } as any,
    });
    expect(r1.ok && r2.ok).toBe(true);
    if (r1.ok) expect(r1.plan.topicScoped).toBe(false);
    if (r2.ok) expect(r2.plan.topicScoped).toBe(false);
  });

  it("Spelling+IXL routes to spelling-patterns deep link by default", () => {
    const r = buildKhanIxlDeeplink({
      subject: "spelling",
      provider: "ixl",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.url).toContain("spelling-patterns");
  });
});
