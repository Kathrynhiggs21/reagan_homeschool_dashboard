/**
 * Slice 4 push 12 (2026-05-12)
 *   Universal helper to detect YouTube / Vimeo URLs in arbitrary block text and
 *   convert them to either an inline clickable link or a video-embed iframe.
 *
 * Used by `<DescriptionWithLinks>` (see same folder). Pure functions kept here
 * so they can be unit-tested without React/JSDOM.
 */

export type DetectedLink = {
  href: string;
  /** Original raw text exactly as it appeared (used for replace-anchoring) */
  raw: string;
  /** Inclusive start index in the source string */
  start: number;
  /** Exclusive end index in the source string */
  end: number;
  kind: "youtube" | "vimeo" | "url";
  /** YouTube/Vimeo only — extracted video id for embed URL building */
  videoId?: string;
};

const YT_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"]);
const YT_SHORT_HOSTS = new Set(["youtu.be"]);
const VIMEO_HOSTS = new Set(["vimeo.com", "www.vimeo.com", "player.vimeo.com"]);

const URL_RE = /https?:\/\/[^\s<>"']+/g;

function trimTrailingPunct(raw: string): string {
  // URLs typed inline often pick up commas, periods, parens. Strip safely.
  let out = raw;
  while (out.length > 0 && /[).,;:!?]/.test(out[out.length - 1])) {
    out = out.slice(0, -1);
  }
  return out;
}

export function classifyUrl(rawIn: string): { kind: DetectedLink["kind"]; videoId?: string; href: string } | null {
  const raw = trimTrailingPunct(rawIn);
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  if (YT_HOSTS.has(host)) {
    // /watch?v=ID  /embed/ID  /shorts/ID  /v/ID
    let id = u.searchParams.get("v");
    if (!id) {
      const m = u.pathname.match(/\/(?:embed|shorts|v)\/([A-Za-z0-9_-]{6,})/);
      if (m) id = m[1];
    }
    if (id && /^[A-Za-z0-9_-]{6,}$/.test(id)) {
      return { kind: "youtube", videoId: id, href: raw };
    }
    return { kind: "url", href: raw };
  }
  if (YT_SHORT_HOSTS.has(host)) {
    const id = u.pathname.replace(/^\//, "").split(/[?&#]/)[0];
    if (id && /^[A-Za-z0-9_-]{6,}$/.test(id)) {
      return { kind: "youtube", videoId: id, href: raw };
    }
    return { kind: "url", href: raw };
  }
  if (VIMEO_HOSTS.has(host)) {
    const m = u.pathname.match(/\/(\d{6,})/);
    if (m) {
      return { kind: "vimeo", videoId: m[1], href: raw };
    }
    return { kind: "url", href: raw };
  }
  return { kind: "url", href: raw };
}

export function detectLinks(text: string): DetectedLink[] {
  if (!text) return [];
  const out: DetectedLink[] = [];
  for (const m of Array.from(text.matchAll(URL_RE))) {
    const raw = m[0];
    const start = m.index ?? 0;
    const trimmed = trimTrailingPunct(raw);
    const cls = classifyUrl(trimmed);
    if (!cls) continue;
    out.push({
      href: cls.href,
      raw: trimmed,
      start,
      end: start + trimmed.length,
      kind: cls.kind,
      videoId: cls.videoId,
    });
  }
  return out;
}

export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`;
}

export function vimeoEmbedUrl(videoId: string): string {
  return `https://player.vimeo.com/video/${encodeURIComponent(videoId)}`;
}

/**
 * Splits a string into a sequence of plain-text fragments and detected links,
 * in order, suitable for React rendering.
 */
export function splitWithLinks(text: string): Array<
  | { type: "text"; value: string }
  | { type: "link"; link: DetectedLink }
> {
  const links = detectLinks(text);
  if (links.length === 0) return [{ type: "text", value: text }];
  const out: ReturnType<typeof splitWithLinks> = [];
  let cursor = 0;
  for (const lk of links) {
    if (lk.start > cursor) out.push({ type: "text", value: text.slice(cursor, lk.start) });
    out.push({ type: "link", link: lk });
    cursor = lk.end;
  }
  if (cursor < text.length) out.push({ type: "text", value: text.slice(cursor) });
  return out;
}
