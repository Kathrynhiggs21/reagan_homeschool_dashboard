/**
 * Integration test for the video-kind block end-to-end PDF path.
 *
 * Verifies:
 *   1. `qrcode` library is callable from the server runtime.
 *   2. `buildAgendaPdf` accepts an `AgendaPdfBlock` whose `generated.kind`
 *      is "video" without throwing, and emits a non-empty PDF byte stream.
 *   3. The hydrated `__qrPngBuffer` is a valid PNG (8-byte signature).
 *
 * Testing the *visual* QR placement on the page is out of scope (would
 * require a PDF rasterizer); we instead lock the contract that the PDF
 * builder doesn't crash when given video-kind generated payloads, and
 * that the QR data we hand it is a well-formed PNG.
 */
import { describe, it, expect } from "vitest";
import { buildAgendaPdf } from "./_lib/agendaPdf";
import type { AgendaPdfInput } from "./_lib/agendaPdf";
import { buildVideoBlock } from "./_lib/blockGenerators";

describe("agenda PDF — video block path", () => {
  it("produces a PNG QR buffer for a video block URL", async () => {
    const QRCode = await import("qrcode");
    const buf = await QRCode.toBuffer("https://www.youtube.com/watch?v=test123", {
      type: "png",
      errorCorrectionLevel: "M",
      margin: 1,
      width: 220,
    });
    expect(Buffer.isBuffer(buf)).toBe(true);
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50);
    expect(buf[2]).toBe(0x4e);
    expect(buf[3]).toBe(0x47);
    expect(buf.length).toBeGreaterThan(100);
  });

  it("buildAgendaPdf does not crash with a video-kind generated block", async () => {
    const video = buildVideoBlock({
      url: "https://www.youtube.com/watch?v=test456",
      title: "Bird Beak Adaptations",
      description: "How beak shape relates to what each bird eats.",
      minutes: 6,
      subjectTag: "Science",
    });
    const QRCode = await import("qrcode");
    const qrPng = await QRCode.toBuffer(video.qrTarget, {
      type: "png",
      errorCorrectionLevel: "M",
      margin: 1,
      width: 220,
    });

    const input: AgendaPdfInput = {
      forDate: "2026-05-30",
      dayLabel: "Saturday, May 30",
      studentName: "Reagan",
      blocks: [
        {
          sortOrder: 1,
          startTime: "09:00",
          durationMin: 25,
          subjectName: "Science",
          subjectEmoji: "🔬",
          title: "Watch: Bird Beak Adaptations",
          description: null,
          curriculumTopicCode: null,
          curriculumTopicTitle: null,
          bookPageRefs: [],
          printablesAttached: 0,
          lesson: {
            instructions: null,
            objectives: ["Understand beak-diet correlation."],
            materials: [],
            videos: [],
            worksheets: [],
            answerKey: null,
          },
          generated: {
            ...video,
            // The PDF builder reads __qrPngBuffer off `generated`.
            // (cast through any so we don't have to widen the public type)
            ...({ __qrPngBuffer: qrPng } as any),
          } as any,
        },
      ],
    };

    const result = await buildAgendaPdf(input);
    expect(Buffer.isBuffer(result.pdfBuffer)).toBe(true);
    expect(result.pdfBuffer.byteLength).toBeGreaterThan(1000); // a real PDF
    // PDF signature: %PDF-
    const head = result.pdfBuffer.slice(0, 5).toString("ascii");
    expect(head).toBe("%PDF-");
    expect(typeof result.agendaHash).toBe("string");
    expect(result.agendaHash.length).toBeGreaterThan(0);
  });

  it("falls back gracefully when QR buffer is missing", async () => {
    const video = buildVideoBlock({
      url: "https://example.com/v",
      title: "Fallback test",
      description: "No QR provided.",
    });

    const input: AgendaPdfInput = {
      forDate: "2026-05-30",
      dayLabel: "Saturday, May 30",
      studentName: "Reagan",
      blocks: [
        {
          sortOrder: 1,
          startTime: "09:00",
          durationMin: 15,
          subjectName: "ELA",
          title: "Video",
          description: null,
          bookPageRefs: [],
          printablesAttached: 0,
          lesson: {
            instructions: null,
            objectives: [],
            materials: [],
            videos: [],
            worksheets: [],
            answerKey: null,
          },
          generated: video as any, // no __qrPngBuffer attached
        },
      ],
    };

    const result = await buildAgendaPdf(input);
    expect(Buffer.isBuffer(result.pdfBuffer)).toBe(true);
    const head = result.pdfBuffer.slice(0, 5).toString("ascii");
    expect(head).toBe("%PDF-");
  });
});
