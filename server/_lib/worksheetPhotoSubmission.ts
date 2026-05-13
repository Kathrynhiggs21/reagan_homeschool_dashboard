/**
 * Push 118 (2026-05-13) — Worksheet-photo submission accept/reject helper.
 *
 * Per project knowledge: Reagan can submit completed worksheets as a
 * picture (or via adult input). This pure helper pre-flights the photo
 * before the upload procedure touches storage so we never burn S3 on
 * obviously-bad submissions.
 *
 * Pure module — no DB, no I/O. The caller is responsible for the actual
 * upload and for persisting the audit trail.
 */

export type SubmissionRejectReason =
  | "missing-mime"
  | "unsupported-mime"
  | "missing-size"
  | "too-large"
  | "too-small"
  | "missing-block-id"
  | "missing-kid-id"
  | "blur-suspected";

export interface PhotoMeta {
  mimeType: string;
  /** File size in bytes. */
  sizeBytes: number;
  /** Optional client-side blur score (0..1, lower = blurrier). */
  blurScore?: number;
  /** Optional original filename (informational; not required). */
  filename?: string;
}

export interface PreflightInput {
  blockId: string;
  kidId: string;
  photo: PhotoMeta;
}

export interface PreflightAccepted {
  ok: true;
  /** Normalized values for the upload procedure to use. */
  normalized: {
    blockId: string;
    kidId: string;
    mimeType: string;
    sizeBytes: number;
    filename?: string;
  };
}

export interface PreflightRejected {
  ok: false;
  rejectReason: SubmissionRejectReason;
  /** Adult-tier message; never shown to Reagan as-is. */
  adultMessage: string;
  /** Reagan-safe Kiwi message — gentle, never frames her as wrong. */
  kidMessage: string;
}

export type PreflightResult = PreflightAccepted | PreflightRejected;

const ACCEPTED_MIMES = new Set<string>([
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
]);

const MIN_BYTES = 8 * 1024; // 8 KB
const MAX_BYTES = 12 * 1024 * 1024; // 12 MB
const BLUR_FLOOR = 0.3;

function clean(s: unknown): string {
  return typeof s === "string" ? s.trim() : "";
}

export function preflightWorksheetPhoto(
  input: PreflightInput,
): PreflightResult {
  const blockId = clean(input?.blockId);
  const kidId = clean(input?.kidId);

  if (blockId.length === 0) {
    return {
      ok: false,
      rejectReason: "missing-block-id",
      adultMessage: "blockId required.",
      kidMessage: "Open this from a schedule block first.",
    };
  }
  if (kidId.length === 0) {
    return {
      ok: false,
      rejectReason: "missing-kid-id",
      adultMessage: "kidId required.",
      kidMessage: "Sign in first, then try again.",
    };
  }

  const photo = input?.photo;
  if (!photo || typeof photo !== "object") {
    return {
      ok: false,
      rejectReason: "missing-mime",
      adultMessage: "photo metadata missing.",
      kidMessage: "Pick a picture and try again.",
    };
  }

  const mime = clean(photo.mimeType).toLowerCase();
  if (mime.length === 0) {
    return {
      ok: false,
      rejectReason: "missing-mime",
      adultMessage: "photo.mimeType missing.",
      kidMessage: "That file didn't have a picture type.",
    };
  }
  if (!ACCEPTED_MIMES.has(mime)) {
    return {
      ok: false,
      rejectReason: "unsupported-mime",
      adultMessage: `mimeType ${mime} not supported.`,
      kidMessage: "Try a JPG, PNG, HEIC, or WebP picture.",
    };
  }

  if (!Number.isFinite(photo.sizeBytes)) {
    return {
      ok: false,
      rejectReason: "missing-size",
      adultMessage: "photo.sizeBytes missing or non-finite.",
      kidMessage: "We couldn't read that file size — try again.",
    };
  }
  const size = Math.floor(photo.sizeBytes);
  if (size < MIN_BYTES) {
    return {
      ok: false,
      rejectReason: "too-small",
      adultMessage: `photo too small (${size} < ${MIN_BYTES}).`,
      kidMessage: "That picture is super tiny — take another one closer up.",
    };
  }
  if (size > MAX_BYTES) {
    return {
      ok: false,
      rejectReason: "too-large",
      adultMessage: `photo too large (${size} > ${MAX_BYTES}).`,
      kidMessage: "That picture is too big — try a smaller one.",
    };
  }

  if (
    typeof photo.blurScore === "number" &&
    Number.isFinite(photo.blurScore) &&
    photo.blurScore < BLUR_FLOOR
  ) {
    return {
      ok: false,
      rejectReason: "blur-suspected",
      adultMessage: `blurScore ${photo.blurScore} below floor ${BLUR_FLOOR}.`,
      kidMessage: "That picture looks blurry — hold steady and try again.",
    };
  }

  return {
    ok: true,
    normalized: {
      blockId,
      kidId,
      mimeType: mime,
      sizeBytes: size,
      filename: clean(photo.filename) || undefined,
    },
  };
}

export const WORKSHEET_PHOTO_LIMITS = {
  MIN_BYTES,
  MAX_BYTES,
  BLUR_FLOOR,
  ACCEPTED_MIMES: Array.from(ACCEPTED_MIMES),
};
