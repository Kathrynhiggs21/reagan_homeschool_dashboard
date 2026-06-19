import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Verifies the YouTube client is honest when no account is connected:
 * with no OAuth token / API key, it reports "not configured", "cannot
 * read private", and every fetch returns an EMPTY array (never invents
 * interests, never calls the network).
 */
describe("youtube client — dormant without credentials", () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    // Ensure no creds for this isolated module instance.
    delete (process.env as any).YOUTUBE_OAUTH_TOKEN;
    delete (process.env as any).YOUTUBE_API_KEY;
    (globalThis as any).fetch = fetchSpy;
    fetchSpy.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("reports not configured and cannot read private", async () => {
    const yt = await import("./_lib/youtube");
    expect(yt.isYouTubeConfigured()).toBe(false);
    expect(yt.canReadPrivate()).toBe(false);
  });

  it("returns empty signals and never hits the network", async () => {
    const yt = await import("./_lib/youtube");
    const all = await yt.fetchAllLiveSignals();
    const liked = await yt.fetchLikedVideos();
    const subs = await yt.fetchSubscriptions();
    const playlists = await yt.fetchPlaylists();
    expect(all).toEqual([]);
    expect(liked).toEqual([]);
    expect(subs).toEqual([]);
    expect(playlists).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
