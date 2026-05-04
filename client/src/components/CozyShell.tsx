import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useKiwi } from "@/contexts/KiwiContext";
import { useAdultLock } from "@/contexts/AdultLockContext";
import { Button } from "@/components/ui/button";
import { Lock, Unlock } from "lucide-react";
import { daysUntilSummerBreak } from "@/lib/summerCountdown";
import WeatherWidget from "./WeatherWidget";
import CompanionBelt from "./CompanionBelt";

/**
 * Sidebar navigation.
 * Kid-visible pages are always shown.
 * Adult-only pages (Curriculum, Tutor, Analytics, Knowledge, Settings) are
 * only listed in the sidebar after the 3918 passcode has unlocked this tab.
 * My Animals / Rescue Journal have been removed entirely.
 */

type NavItem = { to: string; emoji: string; label: string; dot?: string };

// Reagan's sidebar — final 6 entries (locked May 4 2026):
// Today, Schedule, Kiwi Coins (was Levels/Proud Wall/Rewards), Bookshelf, Notebook, Apps & Tools.
// Adventures is a popup launched from Today, Journal merged into Notebook,
// Whiteboard lives inside Notebook, About Me / Profile pulled (no kid-side
// profile view needed), Proud Wall + My Levels deleted entirely.
const KID_NAV: NavItem[] = [
  { to: "/today",     emoji: "📋", label: "Today",        dot: "#ff9b3d" },
  { to: "/schedule",  emoji: "🗓️", label: "Schedule",     dot: "#3b82f6" },
  { to: "/coins",     emoji: "🪙", label: "Kiwi Coins",   dot: "#eab308" },
  { to: "/practice",  emoji: "✨", label: "Practice",     dot: "#facc15" },
  { to: "/bookshelf", emoji: "📚", label: "Bookshelf",    dot: "#ef4444" },
  { to: "/notes",     emoji: "📝", label: "Notebook",     dot: "#a855f7" },
  { to: "/apps",      emoji: "🎒", label: "Apps & Tools", dot: "#22c55e" },
];

// MORE_NAV is now empty — Adventures is a Today popup, Journal is folded
// into Notebook. Kept the constant so existing render code stays stable.
const MORE_NAV: NavItem[] = [];

// Adult section — locked to 4 entries (May 4 2026):
// Curriculum Hub, Daily Schedule, Agenda Editor (with AI bar pinned on top),
// Settings (5-tab slim version: People, Prizes, Requests, Calendar,
// Notifications). Everything else (Tutor Handoff, Family, Upload-Sync,
// Daily Agendas, Daily Packet, Parent Notes, separate Analytics, separate
// AI Assistant, separate Rewards) is consolidated or deleted.
const ADULT_NAV: NavItem[] = [
  { to: "/curriculum", emoji: "📘", label: "Curriculum Hub" },
  { to: "/agendas",    emoji: "🗓️", label: "Daily Schedule" },
  { to: "/library",    emoji: "✨", label: "Agenda Editor" },
  { to: "/settings",   emoji: "⚙️", label: "Settings" },
];

/**
 * Public link to the Reagan School Hub root in Mom's Google Drive.
 * Everything the dashboard syncs (assignments, finished work, daily schedule,
 * worksheets, coins, analytics, journal, report cards, tutor handoffs, adult
 * notes) lives under this folder. Surfaced in the adult sidebar so it's one
 * tap away from anywhere in the app.
 */
export const DRIVE_HUB_URL =
  "https://drive.google.com/drive/folders/1r3bJacPLJN7VHI8y72rcx1-GRxspqo1r";

export default function CozyShell({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  const { companionName, photoUrl } = useKiwi() as unknown as {
    companionName: string;
    photoUrl?: string | null;
  };
  const { unlocked, lock } = useAdultLock();

  const isActive = (to: string) => loc === to || (loc === "/" && to === "/today");

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col h-screen sticky top-0 no-print">
        {/* Sidebar countdown is mounted just above the Kiwi card via the SummerCountdown component below */}
        {/* Compact chalkboard nameplate with Reagan's photo */}
        <div className="px-3 pt-3 pb-2 border-b border-sidebar-border">
          <div className="chalkboard !p-3 !rounded-lg">
            <div className="flex items-center gap-3">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt="Reagan"
                  className="w-12 h-12 rounded-full object-cover border-2"
                  style={{ borderColor: "#f7f1e3" }}
                />
              ) : (
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-display"
                  style={{ background: "#faf6ec", color: "#1a1a1a", border: "2px solid #f7f1e3" }}
                >
                  R
                </div>
              )}
              <div className="min-w-0">
                <div className="font-display text-base leading-tight chalk-white">Reagan's</div>
                <div className="font-chalk-hand text-2xl leading-none mt-0.5 chalk-yellow">
                  Classroom
                </div>
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          <div className="px-2 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">
            For Reagan
          </div>
          {KID_NAV.map((n) => (
            <Link
              key={n.to}
              href={n.to}
              className={`flex items-center gap-3 px-3 py-1.5 rounded-md text-[13px] transition-all ${
                isActive(n.to)
                  ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              }`}
            >
              <span className="text-2xl w-7 text-center">{n.emoji}</span>
              <span className="flex-1">{n.label}</span>
              {n.dot && <span className="w-2 h-2 rounded-full" style={{ background: n.dot }} aria-hidden />}
            </Link>
          ))}

          {/* Companion belt: tap to switch active flock companion. */}
          <div className="px-2 mt-3">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">
              My Flock
            </div>
            <CompanionBelt size={36} />
          </div>

          <div className="px-2 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mt-5 mb-1.5">
            More
          </div>
          {MORE_NAV.map((n) => (
            <Link
              key={n.to}
              href={n.to}
              className={`flex items-center gap-3 px-3 py-1.5 rounded-md text-[12px] transition-all opacity-80 ${
                loc === n.to
                  ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold opacity-100"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              }`}
            >
              <span className="text-2xl w-7 text-center">{n.emoji}</span>
              <span>{n.label}</span>
            </Link>
          ))}

          {/* Adult section: only visible when unlocked */}
          {unlocked && (
            <>
              <div className="px-2 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mt-5 mb-1.5 flex items-center gap-1">
                <Unlock className="w-3 h-3" />
                <span>For Adults</span>
              </div>
              {ADULT_NAV.map((n) => (
                <Link
                  key={n.to}
                  href={n.to}
                  className={`flex items-center gap-3 px-3 py-1.5 rounded-md text-[13px] transition-all ${
                    loc === n.to
                      ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
                      : "text-sidebar-foreground hover:bg-sidebar-accent"
                  }`}
                >
                  <span className="text-2xl w-7 text-center">{n.emoji}</span>
                  <span>{n.label}</span>
                </Link>
              ))}
              {/* External: open the Drive Hub in a new tab */}
              <a
                href={DRIVE_HUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-1.5 rounded-md text-[13px] transition-all text-sidebar-foreground hover:bg-sidebar-accent"
                title="Opens Reagan's Drive folder in a new tab"
              >
                <span className="text-2xl w-7 text-center">📁</span>
                <span className="flex-1">Drive Hub</span>
                <span className="text-xs opacity-60">↗</span>
              </a>
            </>
          )}
        </nav>

        {/* Footer: helper identity + adult lock/unlock */}
        <div className="px-3 py-2 border-t border-sidebar-border space-y-2">
          <div className="text-xs p-2 rounded-md bg-sidebar-accent">
            <div className="font-semibold truncate">{companionName || "Helper"}</div>
            <div className="text-muted-foreground text-[10px]">Tap the button on any page to talk.</div>
            <SummerCountdown />
          </div>
          {unlocked ? (
            <Button
              size="sm"
              variant="outline"
              className="w-full bg-white/5"
              onClick={lock}
              title="Lock adult area"
            >
              <Lock className="w-3.5 h-3.5 mr-1.5" /> Lock adult area
            </Button>
          ) : (
            <Link href="/settings">
              <Button size="sm" variant="outline" className="w-full bg-white/5" title="Unlock adult area">
                <Lock className="w-3.5 h-3.5 mr-1.5" /> Unlock adult area
              </Button>
            </Link>
          )}
        </div>
      </aside>

      <main className="flex-1 min-w-0 relative">
        {/* Glassy weather pill — inline top-right of the scroll area so it
            never overlaps the theme picker or page headings. */}
        <div className="max-w-6xl mx-auto px-6 pt-4 pb-1 flex justify-end no-print">
          <WeatherWidget />
        </div>
        <div className="max-w-6xl mx-auto px-6 pb-6">{children}</div>
      </main>
    </div>
  );
}


/**
 * SummerCountdown — tiny pill that shows days until summer break.
 * Default summer-break date: June 5 of the current school year (last day
 * of school for Indian Hill ES is typically the first week of June).
 * If the date has passed, the countdown shows "Summer is here!"
 * for one week, then auto-flips to next June.
 */
function SummerCountdown() {
  const days = daysUntilSummerBreak(new Date());

  if (days < -7) return null; // hide after a week into break
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
