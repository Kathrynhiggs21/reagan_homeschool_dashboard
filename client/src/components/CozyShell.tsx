import { ReactNode } from "react";
import { useLocation } from "wouter";
import { useAdultLock } from "@/contexts/AdultLockContext";
import WeatherWidget from "./WeatherWidget";
import NotificationBell from "./NotificationBell";
import OrbDock from "./OrbDock";
import RainOverlay from "./RainOverlay";
import BudgieOverlay from "./BudgieOverlay";

/**
 * CozyShell — the canonical liquid-glass app shell (2026-07-01, Katy).
 *
 * There is no sidebar anymore. Navigation is a floating glass ORB DOCK
 * (bottom-centered on mobile, a vertical rail on the right on desktop). The
 * only chrome floating over the nature photo is a small set of glass controls
 * top-right (weather + notification) — everything is a dimensional glass
 * object, never a flat box.
 *
 * A live-weather RainOverlay renders real falling rain when it's raining.
 *
 * The WELCOME landing (/welcome) is a pristine glass surface with its own
 * bokeh background, its own wave-arc orbs, and only Kiwi bottom-right — so the
 * shell chrome (orb dock, top-right controls, big budgie overlay) is
 * suppressed there to match the reference mockup.
 */
export const DRIVE_HUB_URL =
  "https://drive.google.com/drive/folders/1r3bJacPLJN7VHI8y72rcx1-GRxspqo1r";

export default function CozyShell({ children }: { children: ReactNode }) {
  const { unlocked } = useAdultLock();
  const [loc] = useLocation();
  const onWelcome = loc === "/welcome";

  return (
    <div className="min-h-screen relative">
      {/* Real rain when the weather says so. */}
      <RainOverlay />

      {/* Large transparent budgie, softly present behind all content —
          hidden on the welcome landing, which has its own flying pair. */}
      {!onWelcome && <BudgieOverlay />}

      {/* Floating glass controls, top-right. Hidden on the welcome landing. */}
      {!onWelcome && (
        <div className="fixed top-3 right-3 z-40 flex items-center gap-2 no-print">
          {unlocked && <NotificationBell />}
          <WeatherWidget />
        </div>
      )}

      <main className="relative">
        {onWelcome ? (
          <div className="welcome-shell-wrap">{children}</div>
        ) : (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 pb-6 orb-dock-safe-pad">
            {children}
          </div>
        )}
      </main>

      {/* Primary navigation — suppressed on the welcome landing (its wave-arc
          orbs are the nav there). */}
      {!onWelcome && <OrbDock />}
    </div>
  );
}
