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
  it("can call Gemini and get back content", async () => {
    const key = process.env.GEMINI_API_KEY;
    expect(key, "GEMINI_API_KEY env var must be set").toBeTruthy();

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "Reply with the single word: ok" }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 8 },
      }),
    });
    expect(res.status, `Gemini returned ${res.status}`).toBe(200);
    const json: any = await res.json();
    expect(Array.isArray(json?.candidates)).toBe(true);
    expect(json.candidates.length).toBeGreaterThan(0);
  }, 20_000);
});
