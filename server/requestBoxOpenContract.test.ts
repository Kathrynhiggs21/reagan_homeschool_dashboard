/**
 * Push 125 (2026-05-13) — Reagan request box no-mic open contract.
 *
 * Pins Mom's "request box opens without mic" rule across every entry
 * point: tap-target, kid FAB, Slay Charge ⚡ ask, Kiwi nudge, deeplink,
 * settings preview. Mic is *opt-in only*; never armed by the open call.
 */
import { describe, it, expect } from "vitest";
import {
  decideRequestBoxOpen,
  type RequestBoxTrigger,
} from "./_lib/requestBoxOpenContract";

const NO_MIC_TRIGGERS: RequestBoxTrigger[] = [
  "kid-fab-button",
  "today-tap-target",
  "slay-charge-ask",
  "kiwi-nudge",
  "settings-preview",
  "deeplink",
];

describe("Push 125 — decideRequestBoxOpen", () => {
  for (const trigger of NO_MIC_TRIGGERS) {
    it(`opens with mic OFF for trigger=${trigger}`, () => {
      const out = decideRequestBoxOpen({ trigger });
      expect(out.open).toBe(true);
      if (out.open) {
        expect(out.micArmed).toBe(false);
        expect(out.surface.showPresets).toBe(true);
      }
    });
  }

  it("rejects unknown trigger as mic-required (defense-in-depth)", () => {
    const out = decideRequestBoxOpen({ trigger: "unknown" });
    expect(out.open).toBe(false);
    if (!out.open) expect(out.reason).toBe("mic-required-trigger-not-allowed");
  });

  it("rejects blank trigger explicitly", () => {
    const out = decideRequestBoxOpen({ trigger: "" as RequestBoxTrigger });
    expect(out.open).toBe(false);
    if (!out.open) expect(out.reason).toBe("blank-trigger");
  });

  it("rejects when caller already armed mic — never normalize a mic-first path", () => {
    const out = decideRequestBoxOpen({
      trigger: "kid-fab-button",
      micWasAlreadyArmed: true,
    });
    expect(out.open).toBe(false);
    if (!out.open) expect(out.reason).toBe("mic-required-trigger-not-allowed");
  });

  it("kid tap-input disabled hides free text but keeps presets visible", () => {
    const out = decideRequestBoxOpen({
      trigger: "kid-fab-button",
      kidTapInputDisabled: true,
    });
    expect(out.open).toBe(true);
    if (out.open) {
      expect(out.surface.showFreeText).toBe(false);
      expect(out.surface.showPresets).toBe(true);
      expect(out.surface.presets.length).toBeGreaterThan(0);
    }
  });

  it("kid tap-input disabled also hides the opt-in voice button (no path → no button)", () => {
    const out = decideRequestBoxOpen({
      trigger: "kid-fab-button",
      kidTapInputDisabled: true,
    });
    if (out.open) expect(out.surface.showOptInVoiceButton).toBe(false);
  });

  it("Kiwi nudge never shows the opt-in voice button", () => {
    const out = decideRequestBoxOpen({ trigger: "kiwi-nudge" });
    if (out.open) expect(out.surface.showOptInVoiceButton).toBe(false);
  });

  it("non-Kiwi trigger with tap enabled shows the opt-in voice button", () => {
    const out = decideRequestBoxOpen({ trigger: "today-tap-target" });
    if (out.open) expect(out.surface.showOptInVoiceButton).toBe(true);
  });

  it("preselectKind=schedule preselects the schedule preset", () => {
    const out = decideRequestBoxOpen({
      trigger: "today-tap-target",
      preselectKind: "schedule",
    });
    expect(out.open).toBe(true);
    if (out.open) {
      expect(out.surface.preselected?.kind).toBe("schedule");
      expect(out.surface.preselected?.label).toContain("change my schedule");
    }
  });

  it("preselectKind absent leaves preselected null", () => {
    const out = decideRequestBoxOpen({ trigger: "today-tap-target" });
    if (out.open) expect(out.surface.preselected).toBeNull();
  });

  it("presets list always exposes assignment, adventure, schedule (full source of truth)", () => {
    const out = decideRequestBoxOpen({ trigger: "deeplink" });
    if (out.open) {
      const kinds = out.surface.presets.map((p) => p.kind).sort();
      expect(kinds).toEqual(["adventure", "assignment", "schedule"]);
    }
  });

  it("Slay Charge ⚡ ask trigger preselect=assignment seeds the kid path correctly", () => {
    const out = decideRequestBoxOpen({
      trigger: "slay-charge-ask",
      preselectKind: "assignment",
    });
    expect(out.open).toBe(true);
    if (out.open) {
      expect(out.surface.preselected?.kind).toBe("assignment");
      expect(out.micArmed).toBe(false);
    }
  });
});
