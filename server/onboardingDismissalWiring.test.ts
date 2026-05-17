/**
 * Source-pattern wiring vitest for v2.13:
 *  - IntroTour.tsx must call trpc.profile.update with onboardingCompleted=true
 *    on Skip / Done / Esc / backdrop (via the dismissForever helper).
 *  - Today.tsx must short-circuit auto-mounting the tour when the server
 *    profile reports onboardingCompleted=true, mirroring it back to localStorage.
 * These pattern checks are the smallest reliable signal that the cross-device
 * dismissal contract from v2.13 is still in place; the real-DB profile
 * update path is already covered by server/profile.onboarding.test.ts.
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const introTour = fs.readFileSync(
  path.join(ROOT, "client/src/components/IntroTour.tsx"),
  "utf8",
);
const today = fs.readFileSync(
  path.join(ROOT, "client/src/pages/Today.tsx"),
  "utf8",
);

describe("v2.13 onboarding dismissal cross-device wiring", () => {
  it("IntroTour imports trpc and uses profile.update mutation", () => {
    expect(introTour).toContain('from "@/lib/trpc"');
    expect(introTour).toMatch(/trpc\.profile\.update\.useMutation/);
  });

  it("IntroTour has a single dismissForever helper that flips onboardingCompleted=true", () => {
    expect(introTour).toMatch(/const\s+dismissForever\s*=/);
    expect(introTour).toMatch(/onboardingCompleted:\s*true/);
  });

  it("Skip button calls dismissForever (not a raw markTourSeen+onClose)", () => {
    // The Skip button onClick should route through dismissForever.
    const skipMatch = introTour.match(
      /aria-label="Skip tour"[\s\S]{0,400}onClick=\{\(\)\s*=>\s*\{[\s\S]{0,80}dismissForever\(\)/,
    );
    expect(skipMatch).not.toBeNull();
  });

  it("Done button (last step) calls dismissForever", () => {
    // The Done button is rendered inside the {isLast ? <Button ...>Done</Button> : ...}
    const doneMatch = introTour.match(
      /isLast\s*\?\s*\([\s\S]{0,400}dismissForever\(\)[\s\S]{0,200}Done/,
    );
    expect(doneMatch).not.toBeNull();
  });

  it("Backdrop click calls dismissForever (not raw markTourSeen)", () => {
    // The outermost dialog div has the backdrop onClick.
    const backdropMatch = introTour.match(
      /aria-label="Kiwi's intro tour"[\s\S]{0,300}onClick=\{\(\)\s*=>\s*\{[\s\S]{0,80}dismissForever\(\)/,
    );
    expect(backdropMatch).not.toBeNull();
  });

  it("Escape keydown calls dismissForever", () => {
    // Inside the keydown handler the Escape branch must call dismissForever.
    const escMatch = introTour.match(
      /e\.key\s*===\s*"Escape"\s*\)\s*\{\s*dismissForever\(\)/,
    );
    expect(escMatch).not.toBeNull();
  });

  it("Today.tsx adds a useEffect that respects server profile onboardingCompleted", () => {
    // The new effect should set localStorage + close the tour when the server says done.
    expect(today).toContain("onboardingCompleted");
    expect(today).toMatch(/setTourOpen\(false\)/);
    expect(today).toMatch(/setItem\(\"kiwiTourSeen\",\s*\"1\"\)/);
  });

  it("Today.tsx still imports useEffect alongside useState", () => {
    expect(today).toMatch(/import\s+\{\s*useState,\s*useEffect\s*\}\s+from\s+"react"/);
  });
});
