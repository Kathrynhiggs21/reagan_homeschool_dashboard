import { describe, it, expect } from "vitest";
import { transcriptHasWakeWord, extractQuestionAfterWake, wakeTriggers } from "@shared/wakeWord";

describe("transcriptHasWakeWord", () => {
  it("detects the default name", () => {
    expect(transcriptHasWakeWord("kiwi what's first", "Kiwi")).toBe(true);
    expect(transcriptHasWakeWord("hey kiwi", "Kiwi")).toBe(true);
    expect(transcriptHasWakeWord("HI KIWI!", "Kiwi")).toBe(true);
  });
  it("detects a custom companion name", () => {
    expect(transcriptHasWakeWord("sunny can you help", "Sunny")).toBe(true);
    expect(transcriptHasWakeWord("kiwi hello", "Sunny")).toBe(true);
  });
  it("does not trigger on partial words", () => {
    expect(transcriptHasWakeWord("i ate a kiwifruit", "Kiwi")).toBe(false);
    expect(transcriptHasWakeWord("the weather is sunnyside", "Sunny")).toBe(false);
  });
  it("returns false for empty", () => {
    expect(transcriptHasWakeWord("", "Kiwi")).toBe(false);
  });
});

describe("extractQuestionAfterWake", () => {
  it("pulls the question after the name", () => {
    expect(extractQuestionAfterWake("Kiwi, what's first today?", "Kiwi")).toBe("what's first today?");
  });
  it("strips greeting filler", () => {
    expect(extractQuestionAfterWake("hey kiwi what is 7 times 8", "Kiwi")).toBe("what is 7 times 8");
  });
  it("returns empty when only the name is said", () => {
    expect(extractQuestionAfterWake("Kiwi", "Kiwi")).toBe("");
    expect(extractQuestionAfterWake("hey kiwi", "Kiwi")).toBe("");
  });
  it("uses last occurrence of the name", () => {
    expect(extractQuestionAfterWake("kiwi kiwi tell me a joke", "Kiwi")).toBe("tell me a joke");
  });
  it("works with custom name", () => {
    expect(extractQuestionAfterWake("Sunny how do I spell because", "Sunny")).toBe("how do I spell because");
  });
  it("treats no-wake-word transcript as the whole question", () => {
    expect(extractQuestionAfterWake("what time is lunch", "Kiwi")).toBe("what time is lunch");
  });
});

describe("wakeTriggers", () => {
  it("includes name and greeting forms", () => {
    const t = wakeTriggers("Sunny");
    expect(t).toContain("sunny");
    expect(t).toContain("hey sunny");
    expect(t).toContain("kiwi");
  });
});
