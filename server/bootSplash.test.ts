import { describe, it, expect } from "vitest";
import {
  BOOT_POSE,
  BOOT_CAP_IMG,
  BOOT_T,
  BOOT_PHASES,
  possessive,
  bootTitleName,
  poseForPhase,
  capFlyingForPhase,
  homeschoolStateForPhase,
} from "@shared/bootSplash";

describe("bootSplash assets", () => {
  it("references the five cleaned cap-budgie pose renders + the flying cap", () => {
    expect(BOOT_POSE.wave).toContain("kiwi_grad_wave_clean");
    expect(BOOT_POSE.windup).toContain("kiwi_grad_windup_clean");
    expect(BOOT_POSE.lookup).toContain("kiwi_grad_lookup_clean");
    expect(BOOT_POSE.lookdown).toContain("kiwi_grad_lookdown_clean");
    expect(BOOT_POSE.wink).toContain("kiwi_grad_wink_clean");
    expect(BOOT_CAP_IMG).toContain("grad_cap_fly");
  });

  it("uses /manus-storage paths (not local sandbox paths) so deploys don't break", () => {
    for (const url of [...Object.values(BOOT_POSE), BOOT_CAP_IMG]) {
      expect(url.startsWith("/manus-storage/")).toBe(true);
      expect(url).not.toContain("/home/ubuntu");
    }
  });
});

describe("bootSplash timeline", () => {
  it("is strictly increasing and keeps the splash on screen >5s before fade", () => {
    const seq = [
      BOOT_T.wave,
      BOOT_T.write,
      BOOT_T.windup,
      BOOT_T.fling,
      BOOT_T.lookdown,
      BOOT_T.wink,
      BOOT_T.hold,
    ];
    for (let i = 1; i < seq.length; i++) {
      expect(seq[i]).toBeGreaterThan(seq[i - 1]);
    }
    expect(BOOT_T.hold).toBeGreaterThanOrEqual(5000);
    expect(BOOT_T.fade).toBeGreaterThan(0);
  });

  it("plays exactly five phases in storyboard order", () => {
    expect(BOOT_PHASES).toEqual([
      "wave",
      "windup",
      "fling",
      "lookdown",
      "wink",
    ]);
  });
});

describe("possessive title", () => {
  it("adds 's for normal names and a bare apostrophe for s-ending names", () => {
    expect(possessive("Reagan")).toBe("Reagan\u2019s");
    expect(possessive("Chris")).toBe("Chris\u2019");
    expect(possessive("")).toBe("");
  });

  it("derives the first-name possessive, defaulting to Reagan", () => {
    expect(bootTitleName("Reagan Higgs")).toBe("Reagan\u2019s");
    expect(bootTitleName(undefined)).toBe("Reagan\u2019s");
    expect(bootTitleName(null)).toBe("Reagan\u2019s");
    expect(bootTitleName("   ")).toBe("Reagan\u2019s");
  });
});

describe("phase -> visual mapping", () => {
  it("maps each phase to the correct pose render", () => {
    expect(poseForPhase("wave")).toBe("wave");
    expect(poseForPhase("windup")).toBe("windup");
    expect(poseForPhase("fling")).toBe("lookup"); // tracks the cap upward
    expect(poseForPhase("lookdown")).toBe("lookdown");
    expect(poseForPhase("wink")).toBe("wink");
  });

  it("only flies the cap while it is airborne (fling + falling), not when worn", () => {
    expect(capFlyingForPhase("wave")).toBe(false);
    expect(capFlyingForPhase("windup")).toBe(false);
    expect(capFlyingForPhase("fling")).toBe(true);
    expect(capFlyingForPhase("lookdown")).toBe(true);
    expect(capFlyingForPhase("wink")).toBe(false); // cap is back on her head
  });

  it("brings HOMESCHOOL from hidden -> dim -> lit across the sequence", () => {
    expect(homeschoolStateForPhase("wave")).toBe("hidden");
    expect(homeschoolStateForPhase("windup")).toBe("hidden");
    expect(homeschoolStateForPhase("fling")).toBe("hidden");
    expect(homeschoolStateForPhase("lookdown")).toBe("dim");
    expect(homeschoolStateForPhase("wink")).toBe("lit");
  });
});
