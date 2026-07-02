import { ReactNode } from "react";
import { useLocation } from "wouter";
import { useAdultLock } from "@/contexts/AdultLockContext";
import WeatherWidget from "./WeatherWidget";
import NotificationBell from "./NotificationBell";
import OrbDock from "./OrbDock";
import SideNav from "./SideNav";
import PageTheme from "./PageTheme";
import RainOverlay from "./RainOverlay";
// BudgieOverlay (the big grad-cap budgie in the margin) removed per Katy —
// "just Kiwi." The only bird in the app is now the Kiwi perch, bottom-right.

/**
 * CozyShell — the liquid-glass app shell (2026-07-02, Katy redesign).
 *
 * Navigation is a COLLAPSIBLE LEFT SIDEBAR on desktop (SideNav) plus the
 * floating ORB DOCK on mobile. A PageTheme sets a per-route accent + data-page
 * so every page reads as its own distinct space. The scene is a richly layered
 * nature photo; text sits on LIGHT frosted-white glass so it stays readable.
 *
 * The WELCOME landing (/welcome) is a pristine glass surface with its own
 * bokeh background and wave-arc orbs, so all shell chrome is suppressed there.
 */
export const DRIVE_HUB_URL =
  "https://drive.google.com/drive/folders/1r3bJacPLJN7VHI8y72rcx1-GRxspqo1r";

export default function CozyShell({ children }: { children: ReactNode }) {
  const { unlocked } = useAdultLock();
  const [loc] = useLocation();
  const onWelcome = loc === "/welcome";

  return (
    <div className="min-h-screen relative app-shell" data-welcome={onWelcome ? "true" : "false"}>
      {/* Per-route accent + data-page key. */}
      <PageTheme />

      {/* Real rain when the weather says so. */}
      <RainOverlay />

      {/* Collapsible left sidebar (desktop) — hidden on the welcome landing. */}
      {!onWelcome && <SideNav />}

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
          <div className="shell-content max-w-6xl mx-auto px-4 sm:px-6 pt-4 pb-6 orb-dock-safe-pad">
            {children}
          </div>
        )}
      </main>

      {/* Mobile navigation — the orb dock. Suppressed on the welcome landing
          (its wave-arc orbs are the nav there) and hidden on desktop via CSS
          where the sidebar takes over. */}
      {!onWelcome && <OrbDock />}
    </div>
  );
}
