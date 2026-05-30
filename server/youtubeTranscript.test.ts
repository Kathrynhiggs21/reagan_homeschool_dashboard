/**
 * Tests for the YouTube transcript fetcher used by video block hydration.
 *
 * The fetcher is dependency-injectable so we can test the candidate-URL
 * fallback chain, XML parsing, entity decoding, and graceful failure
 * without hitting YouTube during tests.
 */
import { describe, it, expect } from "vitest";
import {
  extractYoutubeVideoId,
  decodeCaptionEntities,
  parseTimedTextXml,
  fetchYoutubeTranscript,
} from "./_lib/youtubeTranscript";

describe("extractYoutubeVideoId", () => {
  it("extracts ID from watch?v= URL", () => {
    expect(extractYoutubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("extracts ID from youtu.be short URL", () => {
    expect(extractYoutubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("extracts ID from /embed/ URL", () => {
    expect(extractYoutubeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("extracts ID from /shorts/ URL", () => {
    expect(extractYoutubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("handles m.youtube.com", () => {
    expect(extractYoutubeVideoId("https://m.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("handles youtube-nocookie.com", () => {
    expect(extractYoutubeVideoId("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("returns null for non-YouTube URLs", () => {
    expect(extractYoutubeVideoId("https://vimeo.com/12345")).toBeNull();
    expect(extractYoutubeVideoId("https://example.com")).toBeNull();
  });
  it("returns null for malformed URLs", () => {
    expect(extractYoutubeVideoId("not a url")).toBeNull();
    expect(extractYoutubeVideoId("")).toBeNull();
    expect(extractYoutubeVideoId(null)).toBeNull();
    expect(extractYoutubeVideoId(undefined)).toBeNull();
  });
  it("rejects youtu.be paths with non-11-char IDs", () => {
    expect(extractYoutubeVideoId("https://youtu.be/short")).toBeNull();
  });
});

describe("decodeCaptionEntities", () => {
  it("decodes the common HTML entities YouTube emits", () => {
    expect(decodeCaptionEntities("don&#39;t")).toBe("don't");
    expect(decodeCaptionEntities("&quot;hi&quot;")).toBe('"hi"');
    expect(decodeCaptionEntities("a &amp; b")).toBe("a & b");
    expect(decodeCaptionEntities("&lt;tag&gt;")).toBe("<tag>");
  });
  it("decodes numeric entities", () => {
    expect(decodeCaptionEntities("&#65;&#66;")).toBe("AB");
  });
  it("handles &amp; last so it doesn't double-decode", () => {
    // &amp;quot; should become &quot; not "
    expect(decodeCaptionEntities("&amp;quot;")).toBe("&quot;");
  });
});

describe("parseTimedTextXml", () => {
  it("returns empty string for empty input", () => {
    expect(parseTimedTextXml("")).toBe("");
  });
  it("parses a single <text> element", () => {
    const xml = '<?xml version="1.0"?><transcript><text start="0" dur="2">Hello world</text></transcript>';
    expect(parseTimedTextXml(xml)).toBe("Hello world");
  });
  it("concatenates multiple <text> elements with single spaces", () => {
    const xml =
      '<transcript>' +
      '<text start="0" dur="1">First line.</text>' +
      '<text start="1" dur="1">Second line.</text>' +
      '<text start="2" dur="1">Third line.</text>' +
      '</transcript>';
    expect(parseTimedTextXml(xml)).toBe("First line. Second line. Third line.");
  });
  it("strips inline formatting tags", () => {
    const xml = '<text start="0">hello <b>world</b> <i>!</i></text>';
    expect(parseTimedTextXml(xml)).toBe("hello world !");
  });
  it("decodes entities", () => {
    const xml = '<text start="0">don&#39;t &amp; can&#39;t</text>';
    expect(parseTimedTextXml(xml)).toBe("don't & can't");
  });
  it("handles malformed XML gracefully (returns whatever it can parse)", () => {
    const xml = '<text>good</text> <broken<text>also good</text>';
    const result = parseTimedTextXml(xml);
    expect(result).toContain("good");
  });
});

describe("fetchYoutubeTranscript", () => {
  it("returns null for non-YouTube URLs", async () => {
    const result = await fetchYoutubeTranscript("https://vimeo.com/12345", {
      fetcher: async () => "<text>should not be called</text>",
    });
    expect(result).toBeNull();
  });

  it("returns transcript text from the first successful candidate URL", async () => {
    let calls = 0;
    const result = await fetchYoutubeTranscript("https://youtu.be/dQw4w9WgXcQ", {
      fetcher: async () => {
        calls += 1;
        return '<transcript><text start="0">Never gonna give you up</text></transcript>';
      },
    });
    expect(result).toBe("Never gonna give you up");
    expect(calls).toBe(1); // first candidate succeeded
  });

  it("falls back through candidate URLs when earlier ones return null", async () => {
    const calls: string[] = [];
    const result = await fetchYoutubeTranscript("https://youtu.be/dQw4w9WgXcQ", {
      fetcher: async (url) => {
        calls.push(url);
        // First two return null (unavailable), third returns content.
        if (calls.length < 3) return null;
        return '<transcript><text start="0">ASR transcript</text></transcript>';
      },
    });
    expect(result).toBe("ASR transcript");
    expect(calls.length).toBe(3);
    expect(calls[2]).toContain("kind=asr");
  });

  it("returns null when ALL candidates fail", async () => {
    const result = await fetchYoutubeTranscript("https://youtu.be/dQw4w9WgXcQ", {
      fetcher: async () => null,
    });
    expect(result).toBeNull();
  });

  it("returns null when candidates return empty XML (no <text> tags)", async () => {
    const result = await fetchYoutubeTranscript("https://youtu.be/dQw4w9WgXcQ", {
      fetcher: async () => "<transcript></transcript>",
    });
    expect(result).toBeNull();
  });

  it("truncates transcripts longer than maxChars and appends ellipsis", async () => {
    const long = "word ".repeat(500); // ~2500 chars
    const xml = `<transcript><text start="0">${long.trim()}</text></transcript>`;
    const result = await fetchYoutubeTranscript("https://youtu.be/dQw4w9WgXcQ", {
      fetcher: async () => xml,
      maxChars: 100,
    });
    expect(result).not.toBeNull();
    expect(result!.length).toBeLessThanOrEqual(101); // 100 + 1 for the ellipsis
    expect(result!.endsWith("…")).toBe(true);
  });

  it("never throws even when the fetcher rejects", async () => {
    const result = await fetchYoutubeTranscript("https://youtu.be/dQw4w9WgXcQ", {
      fetcher: async () => {
        throw new Error("network down");
      },
    }).catch(() => "REJECTED");
    // Should not be the rejection sentinel; should be null instead.
    expect(result).toBeNull();
  });
});
