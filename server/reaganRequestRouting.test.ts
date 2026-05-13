/**
 * Push 111 (2026-05-13) — Reagan request → approval routing contract.
 */
import { describe, it, expect } from "vitest";
import { planReaganRequestRouting } from "./_lib/reaganRequestRouting";

describe("Push 111 — Reagan request routing", () => {
  it("schedule-change requires Mom AND Grandma both as required approvers", () => {
    const r = planReaganRequestRouting({
      kind: "schedule-change",
      body: "Can I do science before math today?",
    });
    expect(r.ok).toBe(true);
    expect(r.requiresUnanimousApproval).toBe(true);
    const mom = r.recipients.find((x) => x.label === "Mom");
    const grandma = r.recipients.find((x) => x.label === "Grandma");
    expect(mom?.required).toBe(true);
    expect(grandma?.required).toBe(true);
  });

  it("assignment request: Grandma is FYI (not required), Mom is canonical", () => {
    const r = planReaganRequestRouting({
      kind: "assignment",
      body: "Can I read Tuck Everlasting chapter 4 today?",
    });
    expect(r.ok).toBe(true);
    expect(r.requiresUnanimousApproval).toBe(false);
    const mom = r.recipients.find((x) => x.label === "Mom");
    const grandma = r.recipients.find((x) => x.label === "Grandma");
    expect(mom?.required).toBe(true);
    expect(grandma?.required).toBe(false);
  });

  it("adventure request: same Mom canonical / Grandma FYI rule", () => {
    const r = planReaganRequestRouting({
      kind: "adventure",
      body: "Can we go bird watching at the metro park?",
    });
    expect(r.ok).toBe(true);
    expect(r.requiresUnanimousApproval).toBe(false);
    expect(r.recipients.find((x) => x.label === "Grandma")?.required).toBe(false);
  });

  it("default recipient list includes Mom + Grandma + Dad with the canonical emails", () => {
    const r = planReaganRequestRouting({
      kind: "assignment",
      body: "anything",
    });
    const emails = r.recipients.map((x) => x.email);
    expect(emails).toContain("spear.cpt@gmail.com");
    expect(emails).toContain("marcy.spear@gmail.com");
    expect(emails).toContain("blakehiggs@hotmail.com");
  });

  it("dad: null in override removes Dad from recipients", () => {
    const r = planReaganRequestRouting({
      kind: "assignment",
      body: "anything",
      recipients: { dad: null },
    });
    expect(r.recipients.find((x) => x.label === "Dad")).toBeUndefined();
  });

  it("empty body → ok=false with rejectReason empty-body", () => {
    for (const body of ["", "   ", "\t\n"]) {
      const r = planReaganRequestRouting({ kind: "assignment", body });
      expect(r.ok).toBe(false);
      expect(r.rejectReason).toBe("empty-body");
    }
  });

  it("non-string body → ok=false with rejectReason non-string-body", () => {
    const r = planReaganRequestRouting({
      kind: "assignment",
      body: 123 as any,
    });
    expect(r.ok).toBe(false);
    expect(r.rejectReason).toBe("non-string-body");
  });

  it("unknown kind → ok=false with rejectReason unknown-kind", () => {
    const r = planReaganRequestRouting({
      kind: "billing-question" as any,
      body: "hi",
    });
    expect(r.ok).toBe(false);
    expect(r.rejectReason).toBe("unknown-kind");
  });

  it("smsLine has the kind-prefix and contains the body", () => {
    const r = planReaganRequestRouting({
      kind: "schedule-change",
      body: "switch to outdoor PE",
    });
    expect(r.smsLine).toMatch(/SCHEDULE CHANGE/);
    expect(r.smsLine).toMatch(/switch to outdoor PE/);
  });

  it("smsLine is trimmed to ≤160 chars with ellipsis when body is long", () => {
    const longBody = "x".repeat(400);
    const r = planReaganRequestRouting({ kind: "assignment", body: longBody });
    expect(r.smsLine.length).toBeLessThanOrEqual(160);
    expect(r.smsLine.endsWith("…")).toBe(true);
  });

  it("urgent flag set when body mentions emergency keywords", () => {
    const a = planReaganRequestRouting({
      kind: "assignment",
      body: "I'm sick and want to lay down",
    });
    expect(a.urgent).toBe(true);
    const b = planReaganRequestRouting({
      kind: "assignment",
      body: "Can I draw planets",
    });
    expect(b.urgent).toBe(false);
  });

  it("urgent keyword detection is case-insensitive and matches phrase forms", () => {
    const r = planReaganRequestRouting({
      kind: "schedule-change",
      body: "I am SCARED of the storm",
    });
    expect(r.urgent).toBe(true);
  });
});
