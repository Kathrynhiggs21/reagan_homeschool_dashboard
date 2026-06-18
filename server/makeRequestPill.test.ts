/**
 * Push 54 — Reagan-side global request box pill (no microphone, no voice).
 *
 * Contract:
 *   1. MakeRequestPill component exists, is the default export, and renders
 *      MakeRequestButton inside a fixed-position bottom-left container with
 *      `no-print` so it never lands in printed packets.
 *   2. The pill is hidden whenever the adult lock is unlocked (adults have
 *      their own surfaces — Notebook, Settings, etc).
 *   3. It never references SpeechRecognition / webkitSpeechRecognition /
 *      mediaDevices / microphone — the box must open without mic activation.
 *   4. App.tsx mounts it globally so Reagan can send a request from ANY
 *      page (not just Today).
 *   5. The underlying MakeRequestButton continues to be text-input only.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const pillSrc = fs.readFileSync(
  path.join(__dirname, "..", "client", "src", "components", "MakeRequestPill.tsx"),
  "utf-8",
);
const appSrc = fs.readFileSync(
  path.join(__dirname, "..", "client", "src", "App.tsx"),
  "utf-8",
);
const buttonSrc = fs.readFileSync(
  path.join(__dirname, "..", "client", "src", "components", "MakeRequestButton.tsx"),
  "utf-8",
);

describe("Push 54 — global Reagan request pill", () => {
  it("MakeRequestPill is the default export and renders MakeRequestButton", () => {
    expect(pillSrc).toContain("export default function MakeRequestPill");
    expect(pillSrc).toContain('import { MakeRequestButton } from "@/components/MakeRequestButton"');
    expect(pillSrc).toContain("<MakeRequestButton />");
  });

  it("pill is fixed bottom-RIGHT + carries no-print so it stays off printouts", () => {
    // Moved to the right edge (2026-06-18) so it no longer overlaps the
    // sidebar's bottom-left "Unlock adult area" button. bottom-24 on mobile
    // clears the center ResourceDock; sm restores bottom-6.
    expect(pillSrc).toContain("fixed right-3 bottom-24 z-30");
    expect(pillSrc).toContain("sm:right-4 sm:bottom-6");
    expect(pillSrc).toContain("no-print");
    expect(pillSrc).toContain("print:hidden");
  });

  it("returns null when adult lock is unlocked", () => {
    expect(pillSrc).toContain('useAdultLock');
    expect(pillSrc).toMatch(/if \(unlocked\) return null;/);
  });

  it("does NOT reference microphone / SpeechRecognition / mediaDevices", () => {
    expect(pillSrc).not.toMatch(/SpeechRecognition/);
    expect(pillSrc).not.toMatch(/webkitSpeechRecognition/);
    expect(pillSrc).not.toMatch(/mediaDevices/);
    expect(pillSrc).not.toMatch(/microphone/i);
    // Same hard rule for the underlying button (regression guard)
    expect(buttonSrc).not.toMatch(/SpeechRecognition/);
    expect(buttonSrc).not.toMatch(/webkitSpeechRecognition/);
    expect(buttonSrc).not.toMatch(/mediaDevices/);
    expect(buttonSrc).not.toMatch(/microphone/i);
  });

  it("App.tsx mounts MakeRequestPill globally inside CozyShell", () => {
    expect(appSrc).toContain('import MakeRequestPill from "./components/MakeRequestPill"');
    expect(appSrc).toContain("<MakeRequestPill />");
  });

  it("MakeRequestButton still uses kidRequests.create (audit trail intact)", () => {
    expect(buttonSrc).toContain("trpc.kidRequests.create.useMutation");
    expect(buttonSrc).toContain('<Textarea');
  });
});
