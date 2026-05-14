/**
 * Push 128 (2026-05-13) — kidRequests.create + request-box-open wiring contract.
 *
 * Source-grep contract that pins three invariants for the kid request flow,
 * because regressions on any of them silently break Mom's product rules:
 *
 *   1. The procedure `kidRequests.create` exists in server/routers.ts and
 *      is a `publicProcedure` (Reagan is unauthenticated on the kid surface).
 *   2. The Zod input schema accepts a non-empty body and at least the four
 *      kinds we ship: general / schedule / stuck / feeling. Schedule kind
 *      is the one that routes through the Mom+Grandma SMS approval pair.
 *   3. The kid-side request-box opener (Push 125) NEVER auto-arms the
 *      microphone — `decideRequestBoxOpen` keeps `armMic:false` for every
 *      allowed trigger.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { decideRequestBoxOpen } from "./_lib/requestBoxOpenContract";

const ROUTERS_PATH = path.join(__dirname, "routers.ts");
const ROUTERS_SRC = fs.readFileSync(ROUTERS_PATH, "utf8");

describe("Push 128 — kidRequests.create wiring", () => {
  it("kidRequests router block exists in routers.ts", () => {
    expect(ROUTERS_SRC).toMatch(/kidRequests:\s*router\(\{/);
  });

  it("kidRequests.create is a publicProcedure (kid is unauthenticated)", () => {
    // crude window-around-create check
    const idx = ROUTERS_SRC.indexOf("kidRequests: router({");
    expect(idx).toBeGreaterThan(0);
    const window = ROUTERS_SRC.slice(idx, idx + 1500);
    expect(window).toMatch(/create:\s*publicProcedure/);
  });

  it("create input enforces non-empty body (z.string().min(1))", () => {
    const idx = ROUTERS_SRC.indexOf("kidRequests: router({");
    const window = ROUTERS_SRC.slice(idx, idx + 1500);
    expect(window).toMatch(/body:\s*z\.string\(\)\.min\(1\)/);
  });

  it("create input accepts the four canonical kinds", () => {
    const idx = ROUTERS_SRC.indexOf("kidRequests: router({");
    const window = ROUTERS_SRC.slice(idx, idx + 1500);
    expect(window).toMatch(/general/);
    expect(window).toMatch(/schedule/);
    expect(window).toMatch(/stuck/);
    expect(window).toMatch(/feeling/);
  });

  it("create best-effort fires owner notification (notifyOwner call present)", () => {
    const idx = ROUTERS_SRC.indexOf("kidRequests: router({");
    const window = ROUTERS_SRC.slice(idx, idx + 2000);
    expect(window).toMatch(/notifyOwner\(/);
  });

  it("Push 125 invariant: every allowed open-trigger keeps micArmed=false", () => {
    const triggers = [
      "kid-fab-button",
      "today-tap-target",
      "slay-charge-ask",
      "kiwi-nudge",
      "settings-preview",
      "deeplink",
    ] as const;
    for (const t of triggers) {
      const out = decideRequestBoxOpen({ trigger: t });
      expect(out.open).toBe(true);
      if (out.open) {
        expect(out.micArmed).toBe(false);
      }
    }
  });

  it("Push 125 invariant: never auto-opens when caller already armed the mic", () => {
    const out = decideRequestBoxOpen({
      trigger: "kid-fab-button",
      micWasAlreadyArmed: true,
    });
    expect(out.open).toBe(false);
    if (!out.open) {
      expect(out.reason).toBe("mic-required-trigger-not-allowed");
    }
  });
});
