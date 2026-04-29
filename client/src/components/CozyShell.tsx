import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useKiwi } from "@/contexts/KiwiContext";
import { useAdultLock } from "@/contexts/AdultLockContext";
import { Button } from "@/components/ui/button";
import { Lock, Unlock } from "lucide-react";

/**
 * Sidebar navigation.
 * Kid-visible pages are always shown.
 * Adult-only pages (Curriculum, Tutor, Analytics, Knowledge, Settings) are
 * only listed in the sidebar after the 3918 passcode has unlocked this tab.
 * My Animals / Rescue Journal have been removed entirely.
 */

type NavItem = { to: string; emoji: string; label: string; dot?: string };

const KID_NAV: NavItem[] = [
  { to: "/today",     emoji: "📋", label: "Today",        dot: "#ff9b3d" },
  { to: "/week",      emoji: "🗓️", label: "This Week",   dot: "#3b82f6" },
  { to: "/levels",    emoji: "📈", label: "My Levels",    dot: "#22c55e" },
  { to: "/proud",     emoji: "🌟", label: "Proud Wall",   dot: "#ec4899" },
  { to: "/rewards",   emoji: "⭐", label: "Rewards",       dot: "#f59e0b" },
  { to: "/bookshelf", emoji: "📚", label: "Bookshelf",    dot: "#ef4444" },
  { to: "/notes",     emoji: "📝", label: "Notebook",     dot: "#a855f7" },
  { to: "/apps",      emoji: "🎒", label: "Apps & Tools", dot: "#eab308" },
  { to: "/profile",   emoji: "🪪", label: "About Me",     dot: "#ec4899" },
];

const MORE_NAV: NavItem[] = [
  { to: "/journal",    emoji: "📓", label: "Journal" },
  { to: "/adventures", emoji: "🧭", label: "Adventures" },
];

// Adult section simplified: only the 5 things the parent actually uses.
// Full admin pages still reachable via direct URL but hidden from sidebar.
const ADULT_NAV: NavItem[] = [
  { to: "/upload",     emoji: "⬆️", label: "Upload or Sync" },
  { to: "/agendas",    emoji: "🗓️", label: "Daily Agendas" },
  { to: "/tutor",      emoji: "🤝", label: "Tutor Handoff" },
  { to: "/analytics",  emoji: "📊", label: "Analytics" },
  { to: "/whiteboard", emoji: "📌", label: "Parent Notes" },
  { to: "/knowledge",  emoji: "🧠", label: "AI Assistant" },
  { to: "/settings",   emoji: "⚙️", label: "Settings" },
];

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
            </>
          )}
        </nav>

        {/* Footer: helper identity + adult lock/unlock */}
        <div className="px-3 py-2 border-t border-sidebar-border space-y-2">
          <div className="text-xs p-2 rounded-md bg-sidebar-accent">
            <div className="font-semibold truncate">{companionName || "Helper"}</div>
            <div className="text-muted-foreground text-[10px]">Tap the button on any page to talk.</div>
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

      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-6 py-6">{children}</div>
      </main>
    </div>
  );
}
