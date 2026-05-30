import { describe, it, expect, vi } from "vitest";
import {
  prefetchWorksheet,
  isAlreadyStored,
  isAcceptedContentType,
  deriveFilename,
} from "./_lib/worksheetPrefetch";

function makeResponse(opts: {
  ok?: boolean;
  status?: number;
  contentType?: string | null;
  bytes?: Uint8Array | Buffer;
}) {
  const headers = new Headers();
  if (opts.contentType !== null && opts.contentType !== undefined) {
    headers.set("content-type", opts.contentType);
  }
  return {
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    headers,
    arrayBuffer: async () =>
      (opts.bytes instanceof Buffer
        ? opts.bytes.buffer.slice(
            opts.bytes.byteOffset,
            opts.bytes.byteOffset + opts.bytes.byteLength,
          )
        : opts.bytes ?? new Uint8Array([0x25, 0x50, 0x44, 0x46])) as ArrayBuffer,
  } as unknown as Response;
}

describe("worksheetPrefetch", () => {
  describe("isAlreadyStored", () => {
    it("recognizes /manus-storage/ paths", () => {
      expect(isAlreadyStored("/manus-storage/abc.pdf")).toBe(true);
      expect(isAlreadyStored("https://example.com/sheet.pdf")).toBe(false);
      expect(isAlreadyStored("file:///local/path.pdf")).toBe(false);
    });
  });

  describe("isAcceptedContentType", () => {
    it("accepts PDF + supported images", () => {
      expect(isAcceptedContentType("application/pdf")).toBe(true);
      expect(isAcceptedContentType("image/png")).toBe(true);
      expect(isAcceptedContentType("image/jpeg")).toBe(true);
      expect(isAcceptedContentType("image/webp")).toBe(true);
    });
    it("rejects HTML, video, missing", () => {
      expect(isAcceptedContentType("text/html")).toBe(false);
      expect(isAcceptedContentType("video/mp4")).toBe(false);
      expect(isAcceptedContentType(null)).toBe(false);
    });
  });

  describe("deriveFilename", () => {
    it("uses URL extension when present", () => {
      const r = deriveFilename(
        "https://x.com/path/Adding_Fractions.pdf",
        "application/pdf",
        "fallback",
      );
      expect(r.ext).toBe("pdf");
      expect(r.name).toMatch(/Adding_Fractions/);
    });
    it("falls back to content-type extension", () => {
      const r = deriveFilename(
        "https://x.com/print",
        "image/png",
        "fallback",
      );
      expect(r.ext).toBe("png");
    });
    it("normalizes jpeg to jpg", () => {
      const r = deriveFilename("https://x.com/a", "image/jpeg", "fallback");
      expect(r.ext).toBe("jpg");
    });
  });

  describe("prefetchWorksheet", () => {
    it("returns the input URL unchanged when already stored", async () => {
      const r = await prefetchWorksheet("/manus-storage/sheet_abc.pdf", "test");
      expect(r.stored).toBe(false);
      expect(r.url).toBe("/manus-storage/sheet_abc.pdf");
      expect(r.skipReason).toBe("already stored");
    });

    it("rejects non-http URLs without fetching", async () => {
      const fetcher = vi.fn();
      const r = await prefetchWorksheet("file:///local/x.pdf", "test", {
        fetcher: fetcher as any,
      });
      expect(fetcher).not.toHaveBeenCalled();
      expect(r.stored).toBe(false);
      expect(r.skipReason).toBe("non-http url");
    });

    it("fetches + stores a successful PDF", async () => {
      const pdfBytes = Buffer.from("%PDF-1.4\n%fake\n", "binary");
      const fetcher = vi.fn().mockResolvedValue(
        makeResponse({ contentType: "application/pdf", bytes: pdfBytes }),
      );
      const putter = vi.fn().mockResolvedValue({
        key: "worksheets/Adding_Fractions_xxxxxxxx.pdf",
        url: "/manus-storage/worksheets/Adding_Fractions_xxxxxxxx.pdf",
      });
      const r = await prefetchWorksheet(
        "https://upstream.example.com/Adding_Fractions.pdf",
        "Adding Fractions",
        { fetcher: fetcher as any, putter: putter as any },
      );
      expect(r.stored).toBe(true);
      expect(r.url).toBe(
        "/manus-storage/worksheets/Adding_Fractions_xxxxxxxx.pdf",
      );
      expect(putter).toHaveBeenCalledOnce();
      const [relKey, buf, ct] = putter.mock.calls[0];
      expect(relKey).toMatch(/^worksheets\/.+\.pdf$/);
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(ct).toBe("application/pdf");
    });

    it("falls back to original URL when upstream returns 404", async () => {
      const fetcher = vi.fn().mockResolvedValue(
        makeResponse({ ok: false, status: 404 }),
      );
      const putter = vi.fn();
      const r = await prefetchWorksheet(
        "https://upstream.example.com/missing.pdf",
        "Missing",
        { fetcher: fetcher as any, putter: putter as any },
      );
      expect(r.stored).toBe(false);
      expect(r.url).toBe("https://upstream.example.com/missing.pdf");
      expect(r.skipReason).toMatch(/HTTP 404/);
      expect(putter).not.toHaveBeenCalled();
    });

    it("rejects unsupported content-types (e.g. HTML)", async () => {
      const fetcher = vi.fn().mockResolvedValue(
        makeResponse({ contentType: "text/html", bytes: Buffer.from("<html/>") }),
      );
      const putter = vi.fn();
      const r = await prefetchWorksheet(
        "https://upstream.example.com/sheet",
        "title",
        { fetcher: fetcher as any, putter: putter as any },
      );
      expect(r.stored).toBe(false);
      expect(r.skipReason).toMatch(/unsupported content-type/);
      expect(putter).not.toHaveBeenCalled();
    });

    it("falls back when fetch throws (e.g. abort)", async () => {
      const fetcher = vi
        .fn()
        .mockRejectedValue(new Error("aborted"));
      const r = await prefetchWorksheet(
        "https://upstream.example.com/x.pdf",
        "title",
        { fetcher: fetcher as any },
      );
      expect(r.stored).toBe(false);
      expect(r.url).toBe("https://upstream.example.com/x.pdf");
      expect(r.skipReason).toMatch(/fetch error: aborted/);
    });

    it("rejects oversize bodies (>12 MB)", async () => {
      const big = Buffer.alloc(13 * 1024 * 1024, 0x41);
      const fetcher = vi.fn().mockResolvedValue(
        makeResponse({ contentType: "application/pdf", bytes: big }),
      );
      const putter = vi.fn();
      const r = await prefetchWorksheet(
        "https://upstream.example.com/huge.pdf",
        "huge",
        { fetcher: fetcher as any, putter: putter as any },
      );
      expect(r.stored).toBe(false);
      expect(r.skipReason).toMatch(/too large/);
      expect(putter).not.toHaveBeenCalled();
    });
  });
});
