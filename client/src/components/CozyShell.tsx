import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useWhisper } from "@/contexts/WhisperContext";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const NAV: Array<{ to: string; emoji: string; label: string; section: "kid" | "adult" }> = [
  { to: "/today", emoji: "☀️", label: "Today", section: "kid" },
  { to: "/week", emoji: "📆", label: "This Week", section: "kid" },
  { to: "/adventures", emoji: "🪶", label: "Adventures", section: "kid" },
  { to: "/rescue", emoji: "💛", label: "Rescue Journal", section: "kid" },
  { to: "/animals", emoji: "🦜", label: "My Animals", section: "kid" },
  { to: "/bookshelf", emoji: "📚", label: "Bookshelf", section: "kid" },
  { to: "/apps", emoji: "🎨", label: "Apps & Tools", section: "kid" },
  { to: "/timeline", emoji: "✨", label: "My Timeline", section: "kid" },
  { to: "/profile", emoji: "🪪", label: "About Me", section: "kid" },
  { to: "/curriculum", emoji: "📖", label: "Curriculum", section: "adult" },
  { to: "/tutor", emoji: "🤝", label: "Tutor Handoff", section: "adult" },
  { to: "/analytics", emoji: "📊", label: "Wellness & Analytics", section: "adult" },
  { to: "/knowledge", emoji: "🧠", label: "Knowledge Base", section: "adult" },
  { to: "/settings", emoji: "⚙️", label: "Settings", section: "adult" },
];

export default function CozyShell({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  const { adultPresent, setAdultPresent, companionAvatar, companionName } = useWhisper();

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col h-screen sticky top-0">
        <div className="px-5 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🪶</span>
            <div>
              <div className="font-display font-semibold text-base text-sidebar-foreground leading-tight">Reagan's<br/>Homeschool</div>
              <div className="text-xs text-muted-foreground mt-0.5 font-hand">The Animal Whisperer</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-2 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">For Reagan</div>
          {NAV.filter(n => n.section === "kid").map(n => (
            <Link key={n.to} href={n.to}>
              <a className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all ${
                loc === n.to || (loc === "/" && n.to === "/today")
                  ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-sm"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              }`}>
                <span className="text-lg">{n.emoji}</span>
                <span>{n.label}</span>
              </a>
            </Link>
          ))}
          <div className="px-2 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mt-5 mb-1.5">For Adults</div>
          {NAV.filter(n => n.section === "adult").map(n => (
            <Link key={n.to} href={n.to}>
              <a className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all ${
                loc === n.to ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-sm" : "text-sidebar-foreground hover:bg-sidebar-accent"
              }`}>
                <span className="text-lg">{n.emoji}</span>
                <span>{n.label}</span>
              </a>
            </Link>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-sidebar-border">
          <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-card">
            <div className="text-xs">
              <div className="font-semibold flex items-center gap-1">{companionAvatar} {companionName}</div>
              <div className="text-muted-foreground text-[10px]">{adultPresent ? "Resting (adult)" : "Available"}</div>
            </div>
            <div className="flex items-center gap-1">
              <Label htmlFor="adult" className="text-[10px] text-muted-foreground">Adult</Label>
              <Switch id="adult" checked={adultPresent} onCheckedChange={setAdultPresent} />
            </div>
          </div>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-6 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
