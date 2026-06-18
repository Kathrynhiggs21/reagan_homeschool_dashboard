/**
 * geminiKey.test.ts — sanity check that GEMINI_API_KEY is provisioned and
 * actually accepted by Google. This calls the same lightweight Gemini text
 * model the project already uses for non-voice tasks (cheaper than TTS) and
 * just verifies an HTTP 200 + a non-empty candidates[] array.
 *
 * If this test fails, Kiwi voice (and the Settings AI helper) will also fail
 * the same way — so we want to find out at CI time, not in the browser.
 */
import { describe, it, expect } from "vitest";

describe("GEMINI_API_KEY is valid", () => {
  it("can call Gemini and get back content", async (ctx) => {
    const key = process.env.GEMINI_API_KEY;
    expect(key, "GEMINI_API_KEY env var must be set").toBeTruthy();

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
    const callOnce = () =>
      fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "Reply with the single word: ok" }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 8 },
        }),
      });

    // Up to 3 attempts with backoff to ride out brief rate limiting.
    let res = await callOnce();
    for (let attempt = 0; attempt < 2 && (res.status === 429 || res.status >= 500); attempt++) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      res = await callOnce();
    }

    // Hard-fail on auth/config errors — those mean the key is actually bad
    // and Kiwi voice + the Settings AI helper would break for real.
    expect(
      res.status !== 401 && res.status !== 403,
      `Gemini auth failed with ${res.status} — GEMINI_API_KEY is invalid or unauthorized`,
    ).toBe(true);

    // Transient quota/availability (429 / 5xx) is Google throttling, not a
    // code or key defect — skip rather than redding CI.
    if (res.status === 429 || res.status >= 500) {
      ctx.skip();
      return;
    }

    expect(res.status, `Gemini returned ${res.status}`).toBe(200);
    const json: any = await res.json();
    expect(Array.isArray(json?.candidates)).toBe(true);
    expect(json.candidates.length).toBeGreaterThan(0);
  }, 30_000);
});
