/**
 * Worksheet pre-fetch
 * 2026-05-30 — When a worksheet is attached to a block by URL, fetch the
 * bytes once and store them in S3 so the print-daily PDF builder always
 * has them available, even if the upstream URL goes down or rate-limits.
 *
 * Behavior:
 *   - URLs that already point at our storage (`/manus-storage/...`) are
 *     returned unchanged.
 *   - HTTP/HTTPS URLs are fetched. On success, bytes are uploaded to S3
 *     and the storage URL is returned.
 *   - On any failure (timeout, non-200, non-PDF/non-image content type,
 *     bytes too big), the original URL is returned unchanged so the
 *     caller's row still works for the click-to-view path; the print
 *     pipeline will re-fetch at PDF-build time and gracefully fall back
 *     to "📄 PRINT SEPARATELY".
 *   - Network is bounded by AbortController (8s default) so attaches
 *     never hang the UI.
 */

import { storagePut } from "../storage.js";

/** Public surface for unit tests — pure URL classification. */
export function isAlreadyStored(url: string): boolean {
  return /^\/manus-storage\//.test(url);
}

/** Picks a sensible filename + extension from a URL + content-type. */
export function deriveFilename(
  url: string,
  contentType: string | null,
  fallbackTitle: string,
): { name: string; ext: string } {
  const m = /\/([^/?#]+)(?:[?#]|$)/.exec(url);
  const fromUrl = m ? m[1] : "";
  const cleanTitle =
    fallbackTitle.replace(/[^a-zA-Z0-9_\-. ]+/g, "").trim().slice(0, 64) ||
    "worksheet";

  // Pick extension from URL first, then from content-type.
  const urlExt = /\.(pdf|png|jpe?g|webp)$/i.exec(fromUrl)?.[1]?.toLowerCase();
  let ext = urlExt ?? "";
  if (!ext && contentType) {
    if (contentType.includes("pdf")) ext = "pdf";
    else if (contentType.includes("png")) ext = "png";
    else if (contentType.includes("jpeg") || contentType.includes("jpg"))
      ext = "jpg";
    else if (contentType.includes("webp")) ext = "webp";
  }
  if (ext === "jpeg") ext = "jpg";

  const baseName =
    fromUrl
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[^a-zA-Z0-9_\-]+/g, "_")
      .slice(0, 64) || cleanTitle.replace(/\s+/g, "_");

  return { name: baseName, ext: ext || "bin" };
}

/** Returns true if `contentType` is a worksheet format we can safely store. */
export function isAcceptedContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  return (
    contentType.startsWith("application/pdf") ||
    contentType.startsWith("image/png") ||
    contentType.startsWith("image/jpeg") ||
    contentType.startsWith("image/jpg") ||
    contentType.startsWith("image/webp")
  );
}

const MAX_PREFETCH_BYTES = 12 * 1024 * 1024; // 12 MB
const FETCH_TIMEOUT_MS = 8_000;

export interface PrefetchResult {
  /** Stable URL the caller should persist. May equal `originalUrl` on failure. */
  url: string;
  /** True if the bytes were stored in S3 during this call. */
  stored: boolean;
  /** Reason we did NOT store (only set when stored=false). */
  skipReason?: string;
}

/**
 * Best-effort: fetch + store. On failure, returns the original URL so the
 * row insert can still proceed.
 */
export async function prefetchWorksheet(
  originalUrl: string | null | undefined,
  fallbackTitle: string,
  opts: {
    /** Override storagePut for tests. */
    putter?: typeof storagePut;
    /** Override fetch for tests. */
    fetcher?: typeof fetch;
    /** Override timeout (ms) for tests. */
    timeoutMs?: number;
  } = {},
): Promise<PrefetchResult> {
  if (!originalUrl) return { url: "", stored: false, skipReason: "empty url" };
  if (isAlreadyStored(originalUrl)) {
    return { url: originalUrl, stored: false, skipReason: "already stored" };
  }
  if (!/^https?:\/\//i.test(originalUrl)) {
    return { url: originalUrl, stored: false, skipReason: "non-http url" };
  }

  const fetcher = opts.fetcher ?? fetch;
  const putter = opts.putter ?? storagePut;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), opts.timeoutMs ?? FETCH_TIMEOUT_MS);

  try {
    const r = await fetcher(originalUrl, { signal: ac.signal });
    if (!r.ok) {
      return {
        url: originalUrl,
        stored: false,
        skipReason: `upstream HTTP ${r.status}`,
      };
    }
    const contentType = r.headers.get("content-type") ?? null;
    if (!isAcceptedContentType(contentType)) {
      return {
        url: originalUrl,
        stored: false,
        skipReason: `unsupported content-type ${contentType ?? "(none)"}`,
      };
    }
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length === 0) {
      return { url: originalUrl, stored: false, skipReason: "empty body" };
    }
    if (buf.length > MAX_PREFETCH_BYTES) {
      return {
        url: originalUrl,
        stored: false,
        skipReason: `too large (${buf.length} bytes > ${MAX_PREFETCH_BYTES})`,
      };
    }

    const { name, ext } = deriveFilename(originalUrl, contentType, fallbackTitle);
    const relKey = `worksheets/${name}.${ext}`;
    const { url } = await putter(relKey, buf, contentType ?? "application/octet-stream");
    return { url, stored: true };
  } catch (err: any) {
    return {
      url: originalUrl,
      stored: false,
      skipReason: `fetch error: ${err?.message ?? String(err)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}
