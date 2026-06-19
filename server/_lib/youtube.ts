/* ============================================================
 * YouTube Data API client (Katy 2026-06-19)
 * ----------------------------------------------------------------
 * Reads the REAL signals the YouTube Data API v3 actually exposes for
 * a signed-in account:
 *   - Liked videos        (playlistItems on the "LL" playlist, OAuth)
 *   - Subscriptions       (subscriptions?mine=true, OAuth)
 *   - Playlists + items   (playlists?mine=true, OAuth)
 *
 * IMPORTANT HONESTY NOTE: watch history & search history are NOT
 * available through any API — Google removed those endpoints. The only
 * way to get true watch history is a Google Takeout export, which the
 * interest engine parses separately (parseTakeoutWatchHistory).
 *
 * Auth: a user OAuth access token (ENV.youtubeOAuthToken) is REQUIRED
 * for `mine=true` reads. An API key alone cannot read a user's private
 * likes/subscriptions. If no token is present every function returns an
 * empty list and `isYouTubeConfigured()` is false — the engine stays
 * dormant rather than inventing data.
 * ============================================================ */

import { ENV } from "../_core/env";
import type { RawSignal } from "../../shared/interestEngine";

const API = "https://www.googleapis.com/youtube/v3";

export function isYouTubeConfigured(): boolean {
  return Boolean(ENV.youtubeOAuthToken || ENV.youtubeApiKey);
}

/** True only when we can read a user's PRIVATE likes/subs (needs OAuth). */
export function canReadPrivate(): boolean {
  return Boolean(ENV.youtubeOAuthToken);
}

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/json" };
  if (ENV.youtubeOAuthToken) h.Authorization = `Bearer ${ENV.youtubeOAuthToken}`;
  return h;
}

function withKey(url: string): string {
  if (ENV.youtubeApiKey && !ENV.youtubeOAuthToken) {
    return url + (url.includes("?") ? "&" : "?") + "key=" + encodeURIComponent(ENV.youtubeApiKey);
  }
  return url;
}

interface PageOpts { maxPages?: number; }

async function getJson(url: string): Promise<any> {
  const res = await fetch(withKey(url), { headers: authHeaders() });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`YouTube API ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

/** Generic paginated fetch over a list endpoint, collecting `items`. */
async function paginate(buildUrl: (pageToken?: string) => string, opts: PageOpts = {}): Promise<any[]> {
  const maxPages = opts.maxPages ?? 5; // 5 * 50 = up to 250 items per source
  const items: any[] = [];
  let pageToken: string | undefined;
  for (let i = 0; i < maxPages; i++) {
    const data = await getJson(buildUrl(pageToken));
    if (Array.isArray(data.items)) items.push(...data.items);
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return items;
}

/** Liked videos → signals. Requires OAuth (reads the private "LL" list). */
export async function fetchLikedVideos(opts?: PageOpts): Promise<RawSignal[]> {
  if (!canReadPrivate()) return [];
  // The special playlist id "LL" is the signed-in user's Liked videos.
  const items = await paginate(
    (pt) => `${API}/playlistItems?part=snippet&playlistId=LL&maxResults=50${pt ? `&pageToken=${pt}` : ""}`,
    opts,
  ).catch(() => []);
  return items
    .map((it) => {
      const sn = it?.snippet || {};
      const title = sn.title as string | undefined;
      const channel = (sn.videoOwnerChannelTitle || sn.channelTitle) as string | undefined;
      if (!title || title === "Deleted video" || title === "Private video") return null;
      return { text: title, channel, source: "liked" as const };
    })
    .filter(Boolean) as RawSignal[];
}

/** Subscriptions → signals (channel names). Requires OAuth. */
export async function fetchSubscriptions(opts?: PageOpts): Promise<RawSignal[]> {
  if (!canReadPrivate()) return [];
  const items = await paginate(
    (pt) => `${API}/subscriptions?part=snippet&mine=true&maxResults=50&order=relevance${pt ? `&pageToken=${pt}` : ""}`,
    opts,
  ).catch(() => []);
  return items
    .map((it) => {
      const sn = it?.snippet || {};
      const channel = sn.title as string | undefined;
      const desc = (sn.description as string | undefined) || "";
      if (!channel) return null;
      // Use channel name + a slice of its description as the matchable text.
      return { text: `${channel} ${desc}`.slice(0, 200), channel, source: "subscription" as const };
    })
    .filter(Boolean) as RawSignal[];
}

/** Playlists (titles) → signals. Requires OAuth. */
export async function fetchPlaylists(opts?: PageOpts): Promise<RawSignal[]> {
  if (!canReadPrivate()) return [];
  const items = await paginate(
    (pt) => `${API}/playlists?part=snippet&mine=true&maxResults=50${pt ? `&pageToken=${pt}` : ""}`,
    { maxPages: 2, ...opts },
  ).catch(() => []);
  return items
    .map((it) => {
      const title = it?.snippet?.title as string | undefined;
      if (!title) return null;
      return { text: title, source: "playlist" as const };
    })
    .filter(Boolean) as RawSignal[];
}

/** Pull every live source we can and return the combined signal list. */
export async function fetchAllLiveSignals(opts?: PageOpts): Promise<RawSignal[]> {
  if (!canReadPrivate()) return [];
  const [liked, subs, playlists] = await Promise.all([
    fetchLikedVideos(opts),
    fetchSubscriptions(opts),
    fetchPlaylists(opts),
  ]);
  return [...liked, ...subs, ...playlists];
}
