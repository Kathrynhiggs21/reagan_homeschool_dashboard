/**
 * Push 118 (2026-05-13) — Worksheet-photo submission preflight contract.
 */
import { describe, it, expect } from "vitest";
import {
  preflightWorksheetPhoto,
  WORKSHEET_PHOTO_LIMITS,
} from "./_lib/worksheetPhotoSubmission";

const OK_PHOTO = {
  mimeType: "image/jpeg",
  sizeBytes: 200_000,
  blurScore: 0.8,
  filename: "math.jpg",
};

describe("Push 118 — Worksheet-photo preflight", () => {
  it("accepts a normal-sized JPEG with sane blur score", () => {
    const r = preflightWorksheetPhoto({
      blockId: "blk_1",
      kidId: "reagan",
      photo: OK_PHOTO,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.normalized.blockId).toBe("blk_1");
    expect(r.normalized.kidId).toBe("reagan");
    expect(r.normalized.mimeType).toBe("image/jpeg");
    expect(r.normalized.sizeBytes).toBe(200_000);
    expect(r.normalized.filename).toBe("math.jpg");
  });

  it("rejects missing blockId / kidId with distinct reasons", () => {
    const a = preflightWorksheetPhoto({
      blockId: "  ",
      kidId: "reagan",
      photo: OK_PHOTO,
    });
    const b = preflightWorksheetPhoto({
      blockId: "blk_1",
      kidId: "",
      photo: OK_PHOTO,
    });
    expect(a.ok).toBe(false);
    if (a.ok) return;
    expect(a.rejectReason).toBe("missing-block-id");
    expect(b.ok).toBe(false);
    if (b.ok) return;
    expect(b.rejectReason).toBe("missing-kid-id");
  });

  it("rejects missing or non-image mime types", () => {
    const a = preflightWorksheetPhoto({
      blockId: "blk_1",
      kidId: "reagan",
      photo: { mimeType: "", sizeBytes: 200_000 },
    });
    const b = preflightWorksheetPhoto({
      blockId: "blk_1",
      kidId: "reagan",
      photo: { mimeType: "application/pdf", sizeBytes: 200_000 },
    });
    expect(a.ok).toBe(false);
    if (a.ok) return;
    expect(a.rejectReason).toBe("missing-mime");
    expect(b.ok).toBe(false);
    if (b.ok) return;
    expect(b.rejectReason).toBe("unsupported-mime");
  });

  it("accepts JPG/PNG/HEIC/HEIF/WebP (case-insensitive)", () => {
    for (const m of [
      "IMAGE/JPEG",
      "image/png",
      "image/heic",
      "image/heif",
      "image/webp",
    ]) {
      const r = preflightWorksheetPhoto({
        blockId: "blk_1",
        kidId: "reagan",
        photo: { mimeType: m, sizeBytes: 200_000 },
      });
      expect(r.ok).toBe(true);
    }
  });

  it("rejects too-small photos (< MIN_BYTES) and too-large (> MAX_BYTES)", () => {
    const a = preflightWorksheetPhoto({
      blockId: "blk_1",
      kidId: "reagan",
      photo: { mimeType: "image/jpeg", sizeBytes: 100 },
    });
    const b = preflightWorksheetPhoto({
      blockId: "blk_1",
      kidId: "reagan",
      photo: { mimeType: "image/jpeg", sizeBytes: 50 * 1024 * 1024 },
    });
    expect(a.ok).toBe(false);
    if (a.ok) return;
    expect(a.rejectReason).toBe("too-small");
    expect(b.ok).toBe(false);
    if (b.ok) return;
    expect(b.rejectReason).toBe("too-large");
  });

  it("rejects when sizeBytes is non-finite", () => {
    const r = preflightWorksheetPhoto({
      blockId: "blk_1",
      kidId: "reagan",
      photo: { mimeType: "image/jpeg", sizeBytes: NaN },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.rejectReason).toBe("missing-size");
  });

  it("rejects when blurScore below floor", () => {
    const r = preflightWorksheetPhoto({
      blockId: "blk_1",
      kidId: "reagan",
      photo: { mimeType: "image/jpeg", sizeBytes: 200_000, blurScore: 0.05 },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.rejectReason).toBe("blur-suspected");
  });

  it("ignores non-finite blurScore (treats as unknown, not blur-suspected)", () => {
    const r = preflightWorksheetPhoto({
      blockId: "blk_1",
      kidId: "reagan",
      photo: {
        mimeType: "image/jpeg",
        sizeBytes: 200_000,
        blurScore: NaN as any,
      },
    });
    expect(r.ok).toBe(true);
  });

  it("kid messages never frame Reagan as 'wrong'", () => {
    const cases: Array<Parameters<typeof preflightWorksheetPhoto>[0]> = [
      { blockId: "", kidId: "reagan", photo: OK_PHOTO },
      { blockId: "blk_1", kidId: "", photo: OK_PHOTO },
      {
        blockId: "blk_1",
        kidId: "reagan",
        photo: { mimeType: "application/pdf", sizeBytes: 200_000 },
      },
      {
        blockId: "blk_1",
        kidId: "reagan",
        photo: { mimeType: "image/jpeg", sizeBytes: 100 },
      },
    ];
    for (const c of cases) {
      const r = preflightWorksheetPhoto(c);
      expect(r.ok).toBe(false);
      if (r.ok) continue;
      expect(r.kidMessage.toLowerCase()).not.toMatch(
        /wrong|bad|fail|error|invalid/,
      );
    }
  });

  it("missing photo object yields missing-mime reject", () => {
    const r = preflightWorksheetPhoto({
      blockId: "blk_1",
      kidId: "reagan",
      photo: undefined as any,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.rejectReason).toBe("missing-mime");
  });

  it("exposes WORKSHEET_PHOTO_LIMITS constants", () => {
    expect(WORKSHEET_PHOTO_LIMITS.MIN_BYTES).toBeGreaterThan(0);
    expect(WORKSHEET_PHOTO_LIMITS.MAX_BYTES).toBeGreaterThan(
      WORKSHEET_PHOTO_LIMITS.MIN_BYTES,
    );
    expect(WORKSHEET_PHOTO_LIMITS.ACCEPTED_MIMES).toContain("image/jpeg");
    expect(WORKSHEET_PHOTO_LIMITS.BLUR_FLOOR).toBeGreaterThan(0);
  });
});
