/**
 * Fetch a plain-text transcript for a YouTube video.
 *
 * No API key required — uses YouTube's public `timedtext` endpoint, which
 * is the same source the in-page transcript panel reads from. We parse the
 * XML caption track and return concatenated plain text.
 *
 * Strategy:
 *   1. Extract the 11-character video ID from common URL shapes
 *      (https://youtube.com/watch?v=ID, https://youtu.be/ID,
 *      https://youtube.com/embed/ID, /shorts/ID).
 *   2. Try the timedtext endpoint with English (auto-generated) first,
 *      then fall back to manual English captions, then to any available
 *      track via the list endpoint.
 *   3. Strip XML tags, decode entities, and trim.
 *
 * This file is pure server-side and only depends on global `fetch`. It is
 * tested in `server/youtubeTranscript.test.ts`.
 */

/** Returns the 11-character YouTube video ID, or null if the URL does not look like YouTube. */
export function extractYoutubeVideoId(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = String(url).trim();
  if (!trimmed) return null;
  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return null;
  }
  const host = u.host.toLowerCase().replace(/^www\./, "");
  // youtu.be/ID
  if (host === "youtu.be") {
    const id = u.pathname.replace(/^\/+/, "").split("/")[0] ?? "";
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  }
  // youtube.com / youtube-nocookie.com
  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com" || host === "youtube-nocookie.com") {
    // /watch?v=ID
    const v = u.searchParams.get("v");
    if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
    // /embed/ID, /shorts/ID, /live/ID, /v/ID
    const m = u.pathname.match(/^\/(embed|shorts|live|v)\/([A-Za-z0-9_-]{11})/);
    if (m) return m[2]!;
  }
  return null;
}

/**
 * Decode the small set of HTML entities YouTube emits in caption XML.
 * We avoid pulling in `he` to keep the dependency footprint minimal.
 */
export function decodeCaptionEntities(s: string): string {
  return s
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&"); // must be last
}

/**
 * Parse a YouTube `timedtext` v=1 XML payload into plain text.
 * Returns the empty string for empty/unsupported inputs.
 */
export function parseTimedTextXml(xml: string): string {
  if (!xml) return "";
  const out: string[] = [];
  // Both <text ...>BODY</text> (default) and self-closing variants.
  const re = /<text\b[^>]*>([\s\S]*?)<\/text>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const body = m[1] ?? "";
    // Strip nested formatting tags (<b>, <i>, <c>, etc.) and newlines.
    const stripped = body.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (stripped) out.push(decodeCaptionEntities(stripped));
  }
  return out.join(" ").replace(/\s{2,}/g, " ").trim();
}

/**
 * Fetcher abstraction so tests can inject a stub. Returns the response
 * body as a string, or null on non-2xx / network error. Always resolves.
 */
export type TranscriptFetcher = (url: string) => Promise<string | null>;

const defaultFetch: TranscriptFetcher = async (url) => {
  try {
    const res = await fetch(url, {
      // YouTube's timedtext endpoint is open and CORS-friendly for GET.
      headers: { "User-Agent": "ReaganHomeschoolDashboard/1.0 (transcript-fetch)" },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
};

/**
 * Fetch a transcript for the given YouTube URL. Returns plain text, or
 * `null` if no caption track is reachable. Never throws.
 *
 * Tries (in order):
 *   1. timedtext?lang=en&v=ID
 *   2. timedtext?lang=en-US&v=ID
 *   3. timedtext?lang=en&v=ID&kind=asr  (auto-generated)
 *   4. timedtext?lang=es&v=ID  (other common langs as last resort)
 */
export async function fetchYoutubeTranscript(
  videoUrl: string,
  opts: { fetcher?: TranscriptFetcher; maxChars?: number } = {},
): Promise<string | null> {
  const id = extractYoutubeVideoId(videoUrl);
  if (!id) return null;
  const f = opts.fetcher ?? defaultFetch;
  const maxChars = opts.maxChars ?? 20_000;
  const candidates = [
    `https://www.youtube.com/api/timedtext?lang=en&v=${id}`,
    `https://www.youtube.com/api/timedtext?lang=en-US&v=${id}`,
    `https://www.youtube.com/api/timedtext?lang=en&v=${id}&kind=asr`,
    `https://www.youtube.com/api/timedtext?lang=es&v=${id}`,
  ];
  for (const url of candidates) {
    let xml: string | null = null;
    try {
      xml = await f(url);
    } catch {
      xml = null;
    }
    if (!xml) continue;
    const text = parseTimedTextXml(xml);
    if (text && text.length > 0) {
      return text.length > maxChars ? text.slice(0, maxChars).trimEnd() + "…" : text;
    }
  }
  return null;
}
