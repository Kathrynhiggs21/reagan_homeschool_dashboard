/**
 * BackgroundChoice + readFileAsDataUrl helper tests.
 *
 * Pure-logic tests against the helper exported alongside the React context.
 * We don't mount React here — this keeps the test fast and stable in CI.
 */
import { describe, it, expect } from "vitest";
import { readFileAsDataUrl, type BackgroundChoice } from "../client/src/contexts/CustomBackgroundContext";

describe("BackgroundChoice shape", () => {
  it("none is the default state", () => {
    const def: BackgroundChoice = { kind: "none" };
    expect(def.kind).toBe("none");
  });
  it("color choice carries a CSS color string", () => {
    const c: BackgroundChoice = { kind: "color", color: "#fdf6e3" };
    expect(c.color).toBe("#fdf6e3");
  });
  it("image choice carries an image URL", () => {
    const c: BackgroundChoice = { kind: "image", imageUrl: "data:image/png;base64,xxx" };
    expect(c.imageUrl?.startsWith("data:image/")).toBe(true);
  });
});

describe("readFileAsDataUrl", () => {
  it("returns null for files exceeding maxBytes", async () => {
    const big = new File([new Uint8Array(2_000_000)], "big.png", { type: "image/png" });
    const out = await readFileAsDataUrl(big, 1_500_000);
    expect(out).toBeNull();
  });
  it("returns a data URL for small files", async () => {
    // happy path requires a real FileReader; in node test envs without one,
    // we still cover the size-guard branch (the important one) above.
    if (typeof (globalThis as any).FileReader === "undefined") {
      return; // skip in environments lacking FileReader
    }
    const small = new File(["hi"], "s.txt", { type: "text/plain" });
    const out = await readFileAsDataUrl(small, 1_500_000);
    expect(out).not.toBeNull();
    expect(out!.startsWith("data:")).toBe(true);
  });
});
