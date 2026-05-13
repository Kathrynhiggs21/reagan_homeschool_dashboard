/**
 * Push 103 (2026-05-13) — TapEditPopover validator contract.
 *
 * Push 87 already locks the UI + procedure wiring for inline tap-edits.
 * This Push adds the deterministic server-side validator that the
 * mutation will call before writing — bad-start / out-of-window /
 * bad-duration / out-of-range / past wind-down / collides-with-locked.
 */
import { describe, it, expect } from "vitest";
import { validateTapEdit } from "./_lib/tapEditPopover";

describe("Push 103 — TapEditPopover validator", () => {
  it("happy path: valid start + duration → ok with minutes", () => {
    const r = validateTapEdit({ startTime: "09:15", durationMinutes: 30 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.startMinutes).toBe(9 * 60 + 15);
      expect(r.endMinutes).toBe(9 * 60 + 45);
    }
  });

  it("bad start format", () => {
    for (const s of ["", "9", "9:5", "25:00", "abc", "12:60"]) {
      const r = validateTapEdit({ startTime: s, durationMinutes: 30 });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBe("bad-start-format");
    }
  });

  it("start out of 06:00–22:00 window", () => {
    const a = validateTapEdit({ startTime: "05:30", durationMinutes: 30 });
    expect(a.ok).toBe(false);
    if (!a.ok) expect(a.error).toBe("start-out-of-window");

    const b = validateTapEdit({ startTime: "22:15", durationMinutes: 5 });
    expect(b.ok).toBe(false);
    if (!b.ok) expect(b.error).toBe("start-out-of-window");
  });

  it("06:00 and 22:00 are inclusive bounds", () => {
    const a = validateTapEdit({ startTime: "06:00", durationMinutes: 30 });
    expect(a.ok).toBe(true);
    const b = validateTapEdit({ startTime: "22:00", durationMinutes: 30 });
    expect(b.ok).toBe(true);
  });

  it("duration must be a whole number", () => {
    const r = validateTapEdit({ startTime: "09:00", durationMinutes: 12.5 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("bad-duration");
  });

  it("duration out of 5–240 range", () => {
    const a = validateTapEdit({ startTime: "09:00", durationMinutes: 2 });
    expect(a.ok).toBe(false);
    if (!a.ok) expect(a.error).toBe("duration-out-of-range");

    const b = validateTapEdit({ startTime: "09:00", durationMinutes: 241 });
    expect(b.ok).toBe(false);
    if (!b.ok) expect(b.error).toBe("duration-out-of-range");
  });

  it("end after 22:30 wind-down rejected", () => {
    const r = validateTapEdit({ startTime: "21:30", durationMinutes: 90 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("end-past-wind-down");
  });

  it("collision with a locked tutor block detected and labelled", () => {
    const r = validateTapEdit({
      startTime: "10:00",
      durationMinutes: 60,
      lockedBlocks: [
        { startMinutes: 10 * 60 + 30, durationMinutes: 60, label: "Madison tutor session" },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe("collides-with-locked-block");
      expect(r.collidesWith).toBe("Madison tutor session");
    }
  });

  it("self-block at same start is skipped for collision check (in-place nudges)", () => {
    const r = validateTapEdit({
      startTime: "10:00",
      durationMinutes: 45,
      selfStartMinutes: 10 * 60,
      lockedBlocks: [
        { startMinutes: 10 * 60, durationMinutes: 30, label: "(same block)" },
      ],
    });
    expect(r.ok).toBe(true);
  });

  it("ends exactly at 22:30 boundary is allowed", () => {
    const r = validateTapEdit({ startTime: "21:30", durationMinutes: 60 });
    expect(r.ok).toBe(true);
  });

  it("touching-but-not-overlapping with locked block is allowed", () => {
    const r = validateTapEdit({
      startTime: "11:00",
      durationMinutes: 30,
      lockedBlocks: [
        { startMinutes: 10 * 60, durationMinutes: 60, label: "tutor" },
      ],
    });
    expect(r.ok).toBe(true);
  });
});
