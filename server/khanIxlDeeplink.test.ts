/**
 * Push 116 (2026-05-13) — Khan / IXL deeplink builder contract.
 * v3.31 (2026-06-04) — Verified-path allow-list + urlConfidence.
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
    expect(r.plan.urlConfidence).toBe("subject-root-fallback");
  });

  it("IXL + math + VERIFIED topic appends the real segment", () => {
    // "fractions" IS on the ixl:math allow-list → maps to "fractions"
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
    expect(r.plan.urlConfidence).toBe("verified");
  });

  it("Khan + math + VERIFIED topic maps friendly slug to real Khan segment", () => {
    // "multiplication" → "imp-multi-digit-multiplication" (real Khan path)
    const r = buildKhanIxlDeeplink({
      subject: "math",
      provider: "khan",
      topic: "multiplication",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.url).toBe(
      "https://www.khanacademy.org/math/cc-fifth-grade-math/imp-multi-digit-multiplication",
    );
    expect(r.plan.topicScoped).toBe(true);
    expect(r.plan.topic).toBe("multiplication");
    expect(r.plan.urlConfidence).toBe("verified");
  });

  it("UNVERIFIED topic slug falls back to subject root (no 404 risk)", () => {
    // "reading-comprehension-5th" is NOT on the ela allow-list → subject root.
    const r = buildKhanIxlDeeplink({
      subject: "ela",
      provider: "ixl",
      topic: "Reading Comprehension!! (5th)",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Requested slug is preserved for telemetry, but URL is the subject root.
    expect(r.plan.topic).toBe("reading-comprehension-5th");
    expect(r.plan.topicScoped).toBe(false);
    expect(r.plan.urlConfidence).toBe("subject-root-fallback");
    expect(r.plan.url).toBe("https://www.ixl.com/ela/grade-5");
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
      expect(r.plan.urlConfidence).toBe("subject-root-fallback");
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
    expect(r.plan.urlConfidence).toBe("subject-root-fallback");
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

  // --- v3.31 — verified allow-list specifics ---

  it("verified URLs never contain the raw friendly slug when it differs", () => {
    // friendly "division" maps to a different real segment on each provider
    const khan = buildKhanIxlDeeplink({
      subject: "math",
      provider: "khan",
      topic: "division",
    });
    const ixl = buildKhanIxlDeeplink({
      subject: "math",
      provider: "ixl",
      topic: "division",
    });
    expect(khan.ok && ixl.ok).toBe(true);
    if (khan.ok) {
      expect(khan.plan.urlConfidence).toBe("verified");
      expect(khan.plan.url.endsWith("/imp-division")).toBe(true);
    }
    if (ixl.ok) {
      expect(ixl.plan.urlConfidence).toBe("verified");
      expect(ixl.plan.url.endsWith("/divide-whole-numbers")).toBe(true);
    }
  });

  it("a subject with no allow-list table degrades unverified topics to root", () => {
    // science has no VERIFIED_TOPIC_PATHS table → always subject-root-fallback
    const r = buildKhanIxlDeeplink({
      subject: "science",
      provider: "khan",
      topic: "ecosystems",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.topicScoped).toBe(false);
    expect(r.plan.urlConfidence).toBe("subject-root-fallback");
    expect(r.plan.url).toBe(
      "https://www.khanacademy.org/science/middle-school-physics",
    );
  });

  it("every verified URL still starts with the subject base (no host swap)", () => {
    const r = buildKhanIxlDeeplink({
      subject: "math",
      provider: "khan",
      topic: "fractions",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(
      r.plan.url.startsWith(
        "https://www.khanacademy.org/math/cc-fifth-grade-math/",
      ),
    ).toBe(true);
    expect(r.plan.urlConfidence).toBe("verified");
  });
});
