import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  transcriptHasWakeWord,
  extractQuestionAfterWake,
  transcriptHasStopPhrase,
} from "../shared/wakeWord";

/**
 * Tests for the always-listening Kiwi wake-word conversation state machine
 * (added 2026-06-18 per Katy's request):
 *   - wake word activates Kiwi
 *   - stop phrases ("bye Kiwi" / "stop") end the conversation
 *   - the component keeps listening hands-free (no mic teardown per turn)
 *   - voice/mic are enabled when the feature is turned on
 *   - Kiwi starts bigger and lower-right on the home screen
 */

describe("wake word detection", () => {
  it("detects the default name and greeting forms", () => {
    expect(transcriptHasWakeWord("hey kiwi what's first", "Kiwi")).toBe(true);
    expect(transcriptHasWakeWord("kiwi", "Kiwi")).toBe(true);
    expect(transcriptHasWakeWord("ok kiwi help", "Kiwi")).toBe(true);
  });
  it("honors a renamed companion but still allows literal 'kiwi'", () => {
    expect(transcriptHasWakeWord("hey sunny", "Sunny")).toBe(true);
    expect(transcriptHasWakeWord("kiwi help", "Sunny")).toBe(true);
  });
  it("does not fire on unrelated speech", () => {
    expect(transcriptHasWakeWord("i ate a kiwifruit", "Kiwi")).toBe(false);
    expect(transcriptHasWakeWord("let's do math now", "Kiwi")).toBe(false);
  });
  it("extracts the question after the wake word", () => {
    expect(extractQuestionAfterWake("hey kiwi what is 7 times 8", "Kiwi")).toBe(
      "what is 7 times 8",
    );
  });
});

describe("stop phrase detection", () => {
  it("detects goodbye and stop forms", () => {
    expect(transcriptHasStopPhrase("bye kiwi", "Kiwi")).toBe(true);
    expect(transcriptHasStopPhrase("goodbye kiwi", "Kiwi")).toBe(true);
    expect(transcriptHasStopPhrase("stop", "Kiwi")).toBe(true);
    expect(transcriptHasStopPhrase("kiwi stop", "Kiwi")).toBe(true);
    expect(transcriptHasStopPhrase("that's all for now", "Kiwi")).toBe(true);
    expect(transcriptHasStopPhrase("be quiet", "Kiwi")).toBe(true);
  });
  it("does not fire on normal questions", () => {
    expect(transcriptHasStopPhrase("what is the capital of ohio", "Kiwi")).toBe(false);
    expect(transcriptHasStopPhrase("can you help me with spelling", "Kiwi")).toBe(false);
  });
});

describe("KiwiCompanion conversation wiring (source contract)", () => {
  const src = readFileSync(
    join(__dirname, "../client/src/components/KiwiCompanion.tsx"),
    "utf8",
  );
  it("keeps a conversing flag for hands-free turns", () => {
    expect(src).toContain("conversingRef");
  });
  it("arms a 15s silence timeout that returns to passive waiting", () => {
    expect(src).toContain("SILENCE_MS = 15_000");
    expect(src).toContain("armSilence");
    expect(src).toContain("endConversation");
  });
  it("listens in both wake and always modes", () => {
    expect(src).toContain('mode !== "wake" && mode !== "always"');
  });
  it("does NOT tear down the mic when the panel opens (open not in deps)", () => {
    expect(src).toContain("}, [enabled, mode, adultPresent, setOpen]);");
  });
  it("requests mic permission and enables voice when turned on", () => {
    expect(src).toContain("getUserMedia");
    expect(src).toContain('setVoiceMode("voice")');
  });
  it("uses the stop-phrase helper", () => {
    expect(src).toContain("transcriptHasStopPhrase");
  });
});

describe("KiwiPerch home placement + size (source contract)", () => {
  const src = readFileSync(
    join(__dirname, "../client/src/components/KiwiPerch.tsx"),
    "utf8",
  );
  it("is bigger than the old 80px desktop size", () => {
    expect(src).toContain("window.innerWidth < 640 ? 96 : 120");
  });
  it("starts lower-right on the home screen", () => {
    expect(src).toContain("isHomeRoute");
    expect(src).toContain("lowerRight");
  });
});
