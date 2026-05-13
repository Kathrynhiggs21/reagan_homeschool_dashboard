import { describe, it, expect } from "vitest";
import {
  classifyUrl,
  detectLinks,
  splitWithLinks,
  youtubeEmbedUrl,
  vimeoEmbedUrl,
} from "../client/src/lib/videoLinks";

/**
 * Slice 4 push 12 (2026-05-12) — pure tests for the YouTube/Vimeo URL
 * detection helpers used by <DescriptionWithLinks>. Run from the server
 * vitest workspace because that's where pnpm test executes; the helper has
 * zero React imports so this is a true unit test.
 */

describe("videoLinks.classifyUrl", () => {
  it("classifies youtube.com /watch?v=ID", () => {
    const c = classifyUrl("https://www.youtube.com/watch?v=fajsyiKRfxI");
    expect(c?.kind).toBe("youtube");
    expect(c?.videoId).toBe("fajsyiKRfxI");
  });

  it("classifies youtu.be/ID short form", () => {
    const c = classifyUrl("https://youtu.be/fajsyiKRfxI");
    expect(c?.kind).toBe("youtube");
    expect(c?.videoId).toBe("fajsyiKRfxI");
  });

  it("classifies youtube embed/ID", () => {
    const c = classifyUrl("https://www.youtube.com/embed/abc123_DEF");
    expect(c?.kind).toBe("youtube");
    expect(c?.videoId).toBe("abc123_DEF");
  });

  it("classifies youtube /shorts/ID", () => {
    const c = classifyUrl("https://www.youtube.com/shorts/xYz_456a");
    expect(c?.kind).toBe("youtube");
    expect(c?.videoId).toBe("xYz_456a");
  });

  it("classifies vimeo.com/NNNNNN", () => {
    const c = classifyUrl("https://vimeo.com/76979871");
    expect(c?.kind).toBe("vimeo");
    expect(c?.videoId).toBe("76979871");
  });

  it("falls back to plain url for unrecognized hosts", () => {
    const c = classifyUrl("https://example.com/foo/bar");
    expect(c?.kind).toBe("url");
  });

  it("returns null for unparseable strings", () => {
    expect(classifyUrl("hello world")).toBeNull();
  });

  it("non-http(s) URLs reach classifyUrl as 'url' but are filtered upstream by detectLinks (https?: only)", () => {
    // direct call is permissive
    expect(classifyUrl("ftp://example.com/file")?.kind).toBe("url");
    // detectLinks strips the ftp URL because the URL_RE only matches https?
    expect(detectLinks("download from ftp://example.com/file please")).toEqual([]);
  });

  it("strips trailing punctuation from raw inputs", () => {
    const c = classifyUrl("https://youtu.be/fajsyiKRfxI.");
    expect(c?.kind).toBe("youtube");
    expect(c?.href.endsWith(".")).toBe(false);
    expect(c?.videoId).toBe("fajsyiKRfxI");
  });
});

describe("videoLinks.detectLinks", () => {
  it("detects multiple URLs in one string", () => {
    const text = "Watch https://youtu.be/abc12345 and read https://example.com/notes";
    const links = detectLinks(text);
    expect(links.length).toBe(2);
    expect(links[0].kind).toBe("youtube");
    expect(links[0].videoId).toBe("abc12345");
    expect(links[1].kind).toBe("url");
  });

  it("returns [] for empty text", () => {
    expect(detectLinks("")).toEqual([]);
  });

  it("returns [] when no URLs", () => {
    expect(detectLinks("just plain text, no links here.")).toEqual([]);
  });
});

describe("videoLinks.splitWithLinks", () => {
  it("splits text + link + text fragments in order", () => {
    const out = splitWithLinks("Before https://youtu.be/zzzzzzzz after.");
    expect(out.length).toBe(3);
    expect(out[0]).toEqual({ type: "text", value: "Before " });
    expect(out[1].type).toBe("link");
    if (out[1].type === "link") {
      expect(out[1].link.kind).toBe("youtube");
      expect(out[1].link.videoId).toBe("zzzzzzzz");
    }
    expect(out[2]).toEqual({ type: "text", value: " after." });
  });

  it("returns single text fragment when no links present", () => {
    const out = splitWithLinks("hello");
    expect(out).toEqual([{ type: "text", value: "hello" }]);
  });
});

describe("videoLinks.embed url builders", () => {
  it("youtubeEmbedUrl builds the right /embed/ URL", () => {
    expect(youtubeEmbedUrl("fajsyiKRfxI")).toBe(
      "https://www.youtube.com/embed/fajsyiKRfxI",
    );
  });
  it("vimeoEmbedUrl builds the right player.vimeo.com URL", () => {
    expect(vimeoEmbedUrl("76979871")).toBe(
      "https://player.vimeo.com/video/76979871",
    );
  });
});
