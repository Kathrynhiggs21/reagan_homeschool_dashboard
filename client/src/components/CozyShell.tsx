import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useKiwi } from "@/contexts/KiwiContext";
import { useAdultLock } from "@/contexts/AdultLockContext";
import SummerQuickToggle from "@/components/SummerQuickToggle";
import { Button } from "@/components/ui/button";
import { Lock, Unlock, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { daysUntilSummerBreak } from "@/lib/summerCountdown";
import WeatherWidget from "./WeatherWidget";
import NotificationBell from "./NotificationBell";
import { useTutorMode } from "@/hooks/useTutorMode";
import { GraduationCap } from "lucide-react";
import SidebarThemePicker from "./SidebarThemePicker";

/**
 * Sidebar navigation.
 * Kid-visible pages are always shown.
 * Adult-only pages (Curriculum, Agenda Editor, Analytics, Settings) are only
 * listed in the sidebar after the 3918 passcode has unlocked this tab.
 *
 * 2026-06-17 (Katy): the sidebar is now COLLAPSIBLE. A toggle at the top
 * shrinks it to a slim icon rail (icons only, labels become hover tooltips)
 * and expands it back to full labels. The choice is remembered per device in
 * localStorage. A compact theme picker is pinned at the bottom-left so Reagan
 * can change how her classroom looks from anywhere.
 */

type NavItem = { to: string; emoji: string; label: string; dot?: string };

// Reagan's sidebar — 5 leaves (Notebook moved to the floating dock 2026-06-17):
// Today, Schedule, Kiwi, Bookshelf, Apps & Tools.
const KID_NAV: NavItem[] = [
  { to: "/today",     emoji: "📋", label: "Today",        dot: "#ff9b3d" },
  { to: "/schedule",  emoji: "🗓️", label: "Schedule",     dot: "#3b82f6" },
  { to: "/kiwi",      emoji: "🐣", label: "Kiwi",         dot: "#eab308" },
  { to: "/bookshelf", emoji: "📚", label: "Bookshelf",    dot: "#ef4444" },
  { to: "/apps",      emoji: "🎒", label: "Apps & Tools", dot: "#22c55e" },
];

// Adult section — Curriculum Hub, Agenda Editor, Analytics, Settings.
const ADULT_NAV: NavItem[] = [
  { to: "/curriculum",    emoji: "📘", label: "Curriculum Hub" },
  { to: "/agenda-editor", emoji: "✏️", label: "Agenda Editor" },
  { to: "/analytics",     emoji: "📊", label: "Analytics" },
  { to: "/settings",      emoji: "⚙️", label: "Settings" },
];

/**
 * Public link to the Reagan School Hub root in Mom's Google Drive.
 */
export const DRIVE_HUB_URL =
  "https://drive.google.com/drive/folders/1r3bJacPLJN7VHI8y72rcx1-GRxspqo1r";

const COLLAPSE_KEY = "reagan_sidebar_collapsed_v1";

export default function CozyShell({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  useKiwi();
  const { companionName, photoUrl } = useKiwi() as unknown as {
    companionName: string;
    photoUrl?: string | null;
  };
  const { unlocked, lock } = useAdultLock();
  const { enabled: tutorModeOn, setEnabled: setTutorMode } = useTutorMode();

  // Collapsed state — remembered per device.
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  });
  useEffect(() => {
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0"); } catch { /* ok */ }
  }, [collapsed]);

  const TUTOR_FOCUS_PATHS = new Set(["/curriculum", "/agenda-editor", "/notes"]);
  const adultNavFiltered = tutorModeOn
    ? ADULT_NAV.filter((n) => TUTOR_FOCUS_PATHS.has(n.to))
    : ADULT_NAV;

  const isActive = (to: string) => loc === to || (loc === "/" && to === "/today");

  const navLink = (n: NavItem, adult = false) => (
    <Link
      key={n.to}
      href={n.to}
      title={collapsed ? n.label : undefined}
      className={`flex items-center gap-3 ${collapsed ? "justify-center px-0" : "px-3"} py-1.5 rounded-md text-[13px] transition-all ${
        (adult ? loc === n.to : isActive(n.to))
          ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
          : "text-sidebar-foreground hover:bg-sidebar-accent"
      }`}
    >
      <span className="text-2xl w-7 text-center shrink-0">{n.emoji}</span>
      {!collapsed && <span className="flex-1">{n.label}</span>}
      {!collapsed && n.dot && <span className="w-2 h-2 rounded-full" style={{ background: n.dot }} aria-hidden />}
    </Link>
  );

  return (
    <div className="min-h-screen flex">
      <aside
        className={`${collapsed ? "w-16" : "w-60"} shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col h-screen sticky top-0 no-print transition-[width] duration-200`}
      >
        {/* Collapse toggle */}
        <div className={`flex items-center ${collapsed ? "justify-center" : "justify-end"} px-2 pt-2`}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-sidebar-foreground"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? "Expand menu" : "Collapse menu"}
            aria-label={collapsed ? "Expand menu" : "Collapse menu"}
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </Button>
        </div>

        {/* Nameplate — photo + title (title hidden when collapsed) */}
        <div className={`${collapsed ? "px-2" : "px-3"} pb-2 border-b border-sidebar-border`}>
          <div className={`chalkboard ${collapsed ? "!p-1.5" : "!p-3"} !rounded-lg`}>
            <div className="flex flex-col items-center gap-2">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt="Reagan"
                  className={`${collapsed ? "w-10 h-10" : "w-20 h-20"} rounded-full object-cover border-[3px] shadow-md transition-all`}
                  style={{ borderColor: "#f7f1e3" }}
                />
              ) : (
                <div
                  className={`${collapsed ? "w-10 h-10 text-lg" : "w-20 h-20 text-3xl"} rounded-full flex items-center justify-center font-display shadow-md`}
                  style={{ background: "#faf6ec", color: "#1a1a1a", border: "3px solid #f7f1e3" }}
                >
                  R
                </div>
              )}
              {!collapsed && (
                <div className="text-center min-w-0 w-full">
                  <div className="font-display text-sm leading-tight chalk-white opacity-80 tracking-wide">Reagan's</div>
                  <div className="font-chalk-hand text-[1.6rem] leading-tight mt-0.5 chalk-yellow">Classroom</div>
                </div>
              )}
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {!collapsed && (
            <div className="px-2 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">
              For Reagan
            </div>
          )}
          {KID_NAV.map((n) => navLink(n))}

          {/* Adult section: only visible when unlocked */}
          {unlocked && (
            <>
              {!collapsed && (
                <div className="px-2 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mt-5 mb-1.5 flex items-center gap-1">
                  <Unlock className="w-3 h-3" />
                  <span>For Adults</span>
                </div>
              )}
              {collapsed && <div className="my-2 border-t border-sidebar-border" />}
              {adultNavFiltered.map((n) => navLink(n, true))}
              {!collapsed && (
                <div className="px-1 pt-2">
                  <SummerQuickToggle />
                </div>
              )}
              {!tutorModeOn && (
                <a
                  href={DRIVE_HUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={collapsed ? "Drive Hub" : "Opens Reagan's Drive folder in a new tab"}
                  className={`flex items-center gap-3 ${collapsed ? "justify-center px-0" : "px-3"} py-1.5 rounded-md text-[13px] transition-all text-sidebar-foreground hover:bg-sidebar-accent`}
                >
                  <span className="text-2xl w-7 text-center shrink-0">📁</span>
                  {!collapsed && <span className="flex-1">Drive Hub</span>}
                  {!collapsed && <span className="text-xs opacity-60">↗</span>}
                </a>
              )}
            </>
          )}
        </nav>

        {/* Theme picker — pinned bottom-left so Reagan can change her look. */}
        <div className="px-2 pb-1 border-t border-sidebar-border pt-2">
          <SidebarThemePicker collapsed={collapsed} />
        </div>

        {/* Footer: helper identity + adult lock/unlock */}
        <div className={`${collapsed ? "px-1.5" : "px-3"} py-2 border-t border-sidebar-border space-y-2`}>
          {!collapsed && (
            <div className="text-xs p-2 rounded-md bg-sidebar-accent">
              <div className="font-semibold truncate">{companionName || "Helper"}</div>
              <div className="text-muted-foreground text-[10px]">Tap on any page to ask something.</div>
              <SummerCountdown />
            </div>
          )}
          {unlocked ? (
            <>
              <Button
                size="sm"
                variant={tutorModeOn ? "default" : "outline"}
                className={`w-full ${collapsed ? "px-0" : ""} ${tutorModeOn ? "bg-amber-500 text-black hover:bg-amber-400" : "bg-white/5"}`}
                onClick={() => setTutorMode(!tutorModeOn)}
                title={tutorModeOn ? "Turn tutor focus off" : "Hide Analytics/Settings during a tutor session"}
              >
                <GraduationCap className="w-3.5 h-3.5 mr-1.5" />
                {!collapsed && (tutorModeOn ? "Tutor mode ON" : "Tutor mode")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className={`w-full ${collapsed ? "px-0" : ""} bg-white/5`}
                onClick={lock}
                title="Lock adult area"
              >
                <Lock className="w-3.5 h-3.5 mr-1.5" /> {!collapsed && "Lock adult area"}
              </Button>
            </>
          ) : (
            <Link href="/settings">
              <Button size="sm" variant="outline" className={`w-full ${collapsed ? "px-0" : ""} bg-white/5`} title="Unlock adult area">
                <Lock className="w-3.5 h-3.5 mr-1.5" /> {!collapsed && "Unlock adult area"}
              </Button>
            </Link>
          )}
        </div>
      </aside>

      <main className="flex-1 min-w-0 relative">
        <div className="max-w-6xl mx-auto px-6 pt-4 pb-1 flex justify-end items-center gap-3 no-print">
          {unlocked && <NotificationBell />}
          <WeatherWidget />
        </div>
        <div className="max-w-6xl mx-auto px-6 pb-6">{children}</div>
      </main>
    </div>
  );
}

/**
 * SummerCountdown — tiny pill that shows days until summer break.
 */
function SummerCountdown() {
  const days = daysUntilSummerBreak(new Date());

  if (days < -7) return null;
  if (days <= 0) {
    return (
      <div className="mt-2 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
        🌞 Summer is here!
      </div>
    );
  }
  return (
    <div className="mt-2 text-[10px] text-muted-foreground">
      <span className="font-semibold">🌞 {days}</span> day{days === 1 ? "" : "s"} til summer break
    </div>
  );
}
