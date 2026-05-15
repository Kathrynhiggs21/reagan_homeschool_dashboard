import { describe, it, expect } from "vitest";
import {
  tallyScheduleChangeApprovals,
  type ApprovalVote,
} from "./_lib/scheduleChangeApprovalTally";

function vote(email: string, decision: "approve" | "decline", at = "2026-05-15T10:00:00Z"): ApprovalVote {
  return { voterEmail: email, decision, votedAtIso: at };
}

describe("scheduleChangeApprovalTally — house rules", () => {
  it("returns pending when no votes recorded", () => {
    const r = tallyScheduleChangeApprovals({ votes: [] });
    expect(r.status).toBe("pending");
    expect(r.shouldApplyChange).toBe(false);
    expect(r.mom.decision).toBeNull();
    expect(r.grandma.decision).toBeNull();
  });

  it("BOTH mom and grandma must approve for status='approved'", () => {
    const r = tallyScheduleChangeApprovals({
      votes: [
        vote("spear.cpt@gmail.com", "approve"),
        vote("marcy.spear@gmail.com", "approve"),
      ],
    });
    expect(r.status).toBe("approved");
    expect(r.shouldApplyChange).toBe(true);
  });

  it("only mom approving is NOT enough", () => {
    const r = tallyScheduleChangeApprovals({
      votes: [vote("spear.cpt@gmail.com", "approve")],
    });
    expect(r.status).toBe("pending");
    expect(r.shouldApplyChange).toBe(false);
  });

  it("only grandma approving is NOT enough", () => {
    const r = tallyScheduleChangeApprovals({
      votes: [vote("marcy.spear@gmail.com", "approve")],
    });
    expect(r.status).toBe("pending");
    expect(r.shouldApplyChange).toBe(false);
  });

  it("one decline by either adult marks the request 'declined'", () => {
    const r1 = tallyScheduleChangeApprovals({
      votes: [
        vote("spear.cpt@gmail.com", "decline"),
        vote("marcy.spear@gmail.com", "approve"),
      ],
    });
    expect(r1.status).toBe("declined");
    expect(r1.shouldApplyChange).toBe(false);

    const r2 = tallyScheduleChangeApprovals({
      votes: [vote("marcy.spear@gmail.com", "decline")],
    });
    expect(r2.status).toBe("declined");
  });

  it("ignores votes from reagan.higgs33@ihsd.us (hard-blocked) and counts them as ignored", () => {
    const r = tallyScheduleChangeApprovals({
      votes: [
        vote("reagan.higgs33@ihsd.us", "approve"),
        vote("spear.cpt@gmail.com", "approve"),
        vote("marcy.spear@gmail.com", "approve"),
      ],
    });
    expect(r.status).toBe("approved");
    expect(r.ignoredVoteCount).toBe(1);
  });

  it("ignores random unknown emails and counts them as ignored", () => {
    const r = tallyScheduleChangeApprovals({
      votes: [
        vote("strangers@nope.com", "approve"),
        vote("spear.cpt@gmail.com", "approve"),
        vote("marcy.spear@gmail.com", "approve"),
      ],
    });
    expect(r.status).toBe("approved");
    expect(r.ignoredVoteCount).toBe(1);
  });

  it("most-recent vote per adult wins (mind-changes honored)", () => {
    const r = tallyScheduleChangeApprovals({
      votes: [
        vote("spear.cpt@gmail.com", "decline", "2026-05-15T09:00:00Z"),
        vote("spear.cpt@gmail.com", "approve", "2026-05-15T10:00:00Z"),
        vote("marcy.spear@gmail.com", "approve", "2026-05-15T10:00:00Z"),
      ],
    });
    expect(r.mom.decision).toBe("approve");
    expect(r.status).toBe("approved");
  });

  it("kidLine and adultLine never contain forbidden voice words", () => {
    const forbidden = /buddy|friend|yay|woohoo|great job|awesome/i;
    const cases = [
      tallyScheduleChangeApprovals({ votes: [] }),
      tallyScheduleChangeApprovals({
        votes: [
          vote("spear.cpt@gmail.com", "approve"),
          vote("marcy.spear@gmail.com", "approve"),
        ],
      }),
      tallyScheduleChangeApprovals({
        votes: [vote("spear.cpt@gmail.com", "decline")],
      }),
    ];
    for (const r of cases) {
      expect(r.kidLine).not.toMatch(forbidden);
      expect(r.adultLine).not.toMatch(forbidden);
    }
  });

  it("declined kidLine never blames Reagan", () => {
    const r = tallyScheduleChangeApprovals({
      votes: [vote("spear.cpt@gmail.com", "decline")],
    });
    expect(r.kidLine.toLowerCase()).not.toMatch(/your fault|you can'?t|never|won'?t/);
    expect(r.kidLine.toLowerCase()).toContain("not this time");
    expect(r.kidLine.toLowerCase()).toContain("ask again");
  });

  it("pending kidLine reflects who we're still waiting on", () => {
    const r = tallyScheduleChangeApprovals({
      votes: [vote("spear.cpt@gmail.com", "approve")],
    });
    expect(r.status).toBe("pending");
    expect(r.kidLine.toLowerCase()).toContain("grandma");
    expect(r.kidLine.toLowerCase()).not.toContain("mom");
  });

  it("is deterministic — same votes → same result", () => {
    const args = {
      votes: [
        vote("spear.cpt@gmail.com", "approve", "2026-05-15T10:00:00Z"),
        vote("marcy.spear@gmail.com", "approve", "2026-05-15T11:00:00Z"),
      ],
    };
    const a = tallyScheduleChangeApprovals(args);
    const b = tallyScheduleChangeApprovals(args);
    expect(a).toEqual(b);
  });

  it("email comparisons are case-insensitive", () => {
    const r = tallyScheduleChangeApprovals({
      votes: [
        vote("Spear.CPT@Gmail.com", "approve"),
        vote("MARCY.SPEAR@gmail.com", "approve"),
      ],
    });
    expect(r.status).toBe("approved");
  });

  it("handles malformed votes array (undefined) without throwing", () => {
    const r = tallyScheduleChangeApprovals({
      votes: undefined as unknown as ApprovalVote[],
    });
    expect(r.status).toBe("pending");
    expect(r.ignoredVoteCount).toBe(0);
  });

  it("votedAtIso is surfaced when present", () => {
    const r = tallyScheduleChangeApprovals({
      votes: [
        vote("spear.cpt@gmail.com", "approve", "2026-05-15T10:00:00Z"),
      ],
    });
    expect(r.mom.votedAtIso).toBe("2026-05-15T10:00:00Z");
    expect(r.grandma.votedAtIso).toBeNull();
  });

  it("decline always wins even if there's a later approve from the same adult... wait no, latest wins", () => {
    // Confirm latest-wins semantics: same adult declines first, then approves.
    const r = tallyScheduleChangeApprovals({
      votes: [
        vote("spear.cpt@gmail.com", "decline", "2026-05-15T08:00:00Z"),
        vote("spear.cpt@gmail.com", "approve", "2026-05-15T12:00:00Z"),
        vote("marcy.spear@gmail.com", "approve", "2026-05-15T13:00:00Z"),
      ],
    });
    expect(r.mom.decision).toBe("approve");
    expect(r.status).toBe("approved");
  });

  it("approved adultLine instructs caller to apply the change", () => {
    const r = tallyScheduleChangeApprovals({
      votes: [
        vote("spear.cpt@gmail.com", "approve"),
        vote("marcy.spear@gmail.com", "approve"),
      ],
    });
    expect(r.adultLine.toLowerCase()).toContain("apply");
  });
});
