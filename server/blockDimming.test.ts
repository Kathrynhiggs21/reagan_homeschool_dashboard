import { describe, it, expect } from "vitest";
import { isBlockDone } from "../client/src/lib/blockDimming";

describe("isBlockDone — block greys ONLY after checked-done or all turned-in", () => {
  it("does NOT dim a planned block with no printables", () => {
    expect(isBlockDone({ status: "planned" }, [])).toBe(false);
  });

  it("does NOT dim an in_progress block with no printables", () => {
    expect(isBlockDone({ status: "in_progress" }, [])).toBe(false);
  });

  it("dims when the block is checked-done (status complete)", () => {
    expect(isBlockDone({ status: "complete" }, [])).toBe(true);
  });

  it("dims a complete block even if printables are not all done", () => {
    expect(
      isBlockDone({ status: "complete" }, [{ status: "pending" }]),
    ).toBe(true);
  });

  it("dims when every pinned worksheet is turned in (done)", () => {
    expect(
      isBlockDone({ status: "planned" }, [
        { status: "done" },
        { status: "done" },
      ]),
    ).toBe(true);
  });

  it("does NOT dim on partial turn-in (some worksheets still out)", () => {
    expect(
      isBlockDone({ status: "planned" }, [
        { status: "done" },
        { status: "pending" },
      ]),
    ).toBe(false);
  });

  it("does NOT dim a planned block whose only printable is pending", () => {
    expect(isBlockDone({ status: "planned" }, [{ status: "pending" }])).toBe(
      false,
    );
  });

  it("does NOT dim merely because time passed (no time input exists)", () => {
    // The predicate has no concept of time — proves dimming is status-only.
    expect(isBlockDone({ status: "in_progress" }, [{ status: "pending" }])).toBe(
      false,
    );
  });
});
