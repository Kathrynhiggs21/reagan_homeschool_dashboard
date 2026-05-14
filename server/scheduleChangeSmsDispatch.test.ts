/**
 * Push 129 (2026-05-13) — Schedule-change SMS dispatch contract.
 */
import { describe, it, expect } from "vitest";
import {
  planScheduleChangeSmsDispatch,
  scheduleChangeSmsIdempotencyKey,
  composeScheduleChangeSmsBody,
} from "./_lib/scheduleChangeSmsDispatch";

const NOW = Date.parse("2026-05-13T17:30:00Z");

const MOM = {
  role: "mom" as const,
  displayName: "Mom",
  phoneE164: "+15135550101",
};
const GRANDMA = {
  role: "grandma" as const,
  displayName: "Grandma Marcy",
  phoneE164: "+15135550102",
};
const DAD = {
  role: "dad-fyi" as const,
  displayName: "Dad",
  phoneE164: "+15135550103",
};

const BASE = {
  requestId: "req_abc123",
  reaganSummary: "Can math move to after lunch?",
  forDateIso: "2026-05-14",
  urgent: false,
  approveTokenUrl: "https://reaganschool.manus.space/v?t=ok123",
  rejectTokenUrl: "https://reaganschool.manus.space/v?t=no123",
  nowMs: NOW,
};

describe("Push 129 — planScheduleChangeSmsDispatch", () => {
  it("emits one payload per voting recipient (Mom + Grandma)", () => {
    const out = planScheduleChangeSmsDispatch({
      ...BASE,
      recipients: [MOM, GRANDMA],
    });
    expect(out.kind).toBe("ready");
    if (out.kind === "ready") {
      expect(out.payloads.length).toBe(2);
      expect(out.payloads.map((p) => p.role).sort()).toEqual(
        ["grandma", "mom"],
      );
      for (const p of out.payloads) {
        expect(p.toPhoneE164.startsWith("+1513555")).toBe(true);
        expect(p.body).toContain("Reagan asks");
        expect(p.body).toContain(BASE.forDateIso);
        expect(p.body).toContain("OK:");
        expect(p.body).toContain("No:");
        expect(p.idempotencyKey).toBe(
          scheduleChangeSmsIdempotencyKey(BASE.requestId, p.role),
        );
        expect(p.audit.requestId).toBe(BASE.requestId);
        expect(p.audit.builtAtMs).toBe(NOW);
      }
    }
  });

  it("skips Dad as FYI without sending SMS but stays ready", () => {
    const out = planScheduleChangeSmsDispatch({
      ...BASE,
      recipients: [MOM, GRANDMA, DAD],
    });
    expect(out.kind).toBe("ready");
    if (out.kind === "ready") {
      expect(out.payloads.length).toBe(2);
      expect(out.skippedReasons.find((s) => s.role === "dad-fyi")?.reason).toBe(
        "fyi-role-no-vote-needed",
      );
    }
  });

  it("URGENT prefix appears in body when urgent=true", () => {
    const out = planScheduleChangeSmsDispatch({
      ...BASE,
      urgent: true,
      recipients: [MOM, GRANDMA],
    });
    if (out.kind === "ready") {
      for (const p of out.payloads) {
        expect(p.body.startsWith("URGENT — ")).toBe(true);
      }
    }
  });

  it("blocks when Mom is missing", () => {
    const out = planScheduleChangeSmsDispatch({
      ...BASE,
      recipients: [GRANDMA],
    });
    expect(out.kind).toBe("blocked");
    if (out.kind === "blocked") expect(out.reason).toBe("missing-mom-approver");
  });

  it("blocks when Grandma is missing (Push 124 invariant)", () => {
    const out = planScheduleChangeSmsDispatch({
      ...BASE,
      recipients: [MOM],
    });
    expect(out.kind).toBe("blocked");
    if (out.kind === "blocked")
      expect(out.reason).toBe("missing-grandma-approver");
  });

  it("blocks when recipient list is empty", () => {
    const out = planScheduleChangeSmsDispatch({ ...BASE, recipients: [] });
    expect(out.kind).toBe("blocked");
    if (out.kind === "blocked") expect(out.reason).toBe("no-recipients");
  });

  it("skips a recipient with missing/invalid phone but reports it; blocks if it leaves Mom or Grandma without dispatch", () => {
    const out = planScheduleChangeSmsDispatch({
      ...BASE,
      recipients: [MOM, { ...GRANDMA, phoneE164: null }],
    });
    expect(out.kind).toBe("blocked");
    if (out.kind === "blocked")
      expect(out.reason).toBe("missing-grandma-approver");
  });

  it("dedupes duplicate-role entries (only first one wins)", () => {
    const out = planScheduleChangeSmsDispatch({
      ...BASE,
      recipients: [
        MOM,
        { ...MOM, phoneE164: "+15135550999" },
        GRANDMA,
      ],
    });
    expect(out.kind).toBe("ready");
    if (out.kind === "ready") {
      expect(out.payloads.length).toBe(2);
      const momPayload = out.payloads.find((p) => p.role === "mom");
      expect(momPayload?.toPhoneE164).toBe(MOM.phoneE164);
      expect(out.skippedReasons.some((s) => s.reason === "duplicate-role")).toBe(
        true,
      );
    }
  });

  it("idempotency key is deterministic and role-bound", () => {
    expect(scheduleChangeSmsIdempotencyKey("req_abc123", "mom")).toBe(
      "sched-change-sms:req_abc123:mom",
    );
    expect(scheduleChangeSmsIdempotencyKey("req_abc123", "grandma")).toBe(
      "sched-change-sms:req_abc123:grandma",
    );
    // Same call returns same key: vital for retry safety.
    expect(scheduleChangeSmsIdempotencyKey("req_abc123", "mom")).toBe(
      scheduleChangeSmsIdempotencyKey("req_abc123", "mom"),
    );
  });

  it("blocks on missing-request-id, missing-summary, bad-date", () => {
    expect(
      planScheduleChangeSmsDispatch({
        ...BASE,
        requestId: "",
        recipients: [MOM, GRANDMA],
      }).kind,
    ).toBe("blocked");
    expect(
      planScheduleChangeSmsDispatch({
        ...BASE,
        reaganSummary: "   ",
        recipients: [MOM, GRANDMA],
      }).kind,
    ).toBe("blocked");
    expect(
      planScheduleChangeSmsDispatch({
        ...BASE,
        forDateIso: "2026/05/14",
        recipients: [MOM, GRANDMA],
      }).kind,
    ).toBe("blocked");
  });

  it("composeScheduleChangeSmsBody truncates very long Reagan summaries", () => {
    const long = "A".repeat(500);
    const body = composeScheduleChangeSmsBody({
      role: "mom",
      reaganSummary: long,
      forDateIso: "2026-05-14",
      urgent: false,
      approveTokenUrl: "https://x/y",
      rejectTokenUrl: "https://x/n",
    });
    // 90-char cap on the quoted summary
    expect(body).toContain("A".repeat(90));
    expect(body).not.toContain("A".repeat(91));
  });
});
