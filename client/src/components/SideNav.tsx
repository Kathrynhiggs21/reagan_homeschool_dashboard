import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAdultLock } from "@/contexts/AdultLockContext";
import { useTutorMode } from "@/hooks/useTutorMode";
import {
  Sun,
  CalendarDays,
  Bird,
  BookOpen,
  Backpack,
  Lightbulb,
  BarChart3,
  Pencil,
  BookMarked,
  Settings as SettingsIcon,
  FolderOpen,
  Lock,
  Unlock,
  GraduationCap,
  Activity,
  PanelLeftClose,
  PanelLeftOpen,
  Trophy,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * SideNav — a collapsible left-hand glass sidebar (Katy design intent).
 *
 * Primary desktop navigation. Lists all kid pages always; adult tools appear
 * once the adult area is unlocked. Collapses to an icon rail and remembers its
 * state in localStorage. On mobile the sidebar is hidden and the OrbDock takes
 * over. Every route carries its own accent color so each page reads distinct.
 */

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  color: string; // r,g,b accent for this page
};

const KID_ITEMS: NavItem[] = [
  { to: "/today", label: "Today", icon: Sun, color: "56,189,248" },
  { to: "/schedule", label: "Schedule", icon: CalendarDays, color: "129,140,248" },
  { to: "/kiwi", label: "Kiwi", icon: Bird, color: "52,211,153" },
  { to: "/bookshelf", label: "Books", icon: BookOpen, color: "244,114,182" },
  { to: "/apps", label: "Apps", icon: Backpack, color: "251,191,36" },
  { to: "/practice", label: "Practice", icon: GraduationCap, color: "34,197,94" },
  { to: "/coins", label: "Rewards", icon: Trophy, color: "250,204,21" },
];

const ADULT_ITEMS: NavItem[] = [
  { to: "/ixl", label: "IXL Diagnostic", icon: Activity, color: "34,193,164" },
  { to: "/curriculum", label: "Curriculum", icon: BookMarked, color: "96,165,250" },
  { to: "/agenda-editor", label: "Agenda Editor", icon: Pencil, color: "167,139,250" },
  { to: "/adventures", label: "Idea Library", icon: Lightbulb, color: "251,146,60" },
  { to: "/analytics", label: "Analytics", icon: BarChart3, color: "45,212,191" },
  { to: "/settings", label: "Settings", icon: SettingsIcon, color: "148,163,184" },
];

const DRIVE_HUB_URL =
  "https://drive.google.com/drive/folders/1r3bJacPLJN7VHI8y72rcx1-GRxspqo1r";

const TUTOR_FOCUS_PATHS = new Set(["/curriculum", "/agenda-editor", "/notes"]);

function NavRow({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.to}
      className="sidenav-row"
      data-active={active ? "true" : "false"}
      title={item.label}
      style={{ ["--row-accent" as string]: item.color }}
    >
      <span className="sidenav-row-icon">
        <Icon className="w-[18px] h-[18px]" strokeWidth={2.2} />
      </span>
      {!collapsed && <span className="sidenav-row-label">{item.label}</span>}
    </Link>
  );
}

export default function SideNav() {
  const [loc] = useLocation();
  const { unlocked, lock } = useAdultLock();
  const { enabled: tutorModeOn, setEnabled: setTutorMode } = useTutorMode();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return window.localStorage?.getItem("sideNavCollapsed") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage?.setItem("sideNavCollapsed", collapsed ? "1" : "0");
    } catch {
      /* no-op */
    }
    // Expose the state on <html> so the content column can offset itself.
    document.documentElement.setAttribute(
      "data-sidenav",
      collapsed ? "collapsed" : "open",
    );
  }, [collapsed]);

  const isActive = (to: string) =>
    loc === to || (loc === "/" && to === "/today");

  const adultItems = tutorModeOn
    ? ADULT_ITEMS.filter((o) => TUTOR_FOCUS_PATHS.has(o.to))
    : ADULT_ITEMS;

  return (
    <aside
      className="sidenav no-print"
      data-collapsed={collapsed ? "true" : "false"}
      aria-label="Primary navigation"
    >
      <div className="sidenav-inner glass-dock">
        {/* Brand + collapse toggle */}
        <div className="sidenav-head">
          {!collapsed && (
            <span className="sidenav-brand">
              <Bird className="w-[18px] h-[18px]" strokeWidth={2.4} />
              Reagan School
            </span>
          )}
          <button
            className="sidenav-toggle glass-control"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>

        <nav className="sidenav-scroll">
          {KID_ITEMS.map((it) => (
            <NavRow
              key={it.to}
              item={it}
              active={isActive(it.to)}
              collapsed={collapsed}
            />
          ))}

          {/* Adult section */}
          <div className="sidenav-divider">
            {!collapsed && (
              <span className="sidenav-section-label">
                {unlocked ? (
                  <Unlock className="w-3 h-3" />
                ) : (
                  <Lock className="w-3 h-3" />
                )}
                For Adults
              </span>
            )}
          </div>

          {unlocked ? (
            <>
              {adultItems.map((it) => (
                <NavRow
                  key={it.to}
                  item={it}
                  active={isActive(it.to)}
                  collapsed={collapsed}
                />
              ))}
              {!tutorModeOn && (
                <a
                  href={DRIVE_HUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sidenav-row"
                  title="Open Reagan's Google Drive hub"
                  style={{ ["--row-accent" as string]: "132,204,22" }}
                >
                  <span className="sidenav-row-icon">
                    <FolderOpen className="w-[18px] h-[18px]" strokeWidth={2.2} />
                  </span>
                  {!collapsed && <span className="sidenav-row-label">Drive</span>}
                </a>
              )}
            </>
          ) : (
            <Link
              href="/settings"
              className="sidenav-row"
              title="Unlock adult area"
              style={{ ["--row-accent" as string]: "148,163,184" }}
            >
              <span className="sidenav-row-icon">
                <Lock className="w-[18px] h-[18px]" strokeWidth={2.2} />
              </span>
              {!collapsed && (
                <span className="sidenav-row-label">Unlock adults</span>
              )}
            </Link>
          )}
        </nav>

        {/* Footer: adult session controls */}
        {unlocked && (
          <div className="sidenav-foot">
            <button
              onClick={() => setTutorMode(!tutorModeOn)}
              className="glass-control sidenav-foot-btn"
              title={tutorModeOn ? "Turn tutor focus off" : "Tutor focus"}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              {!collapsed && (tutorModeOn ? "Tutor ON" : "Tutor")}
            </button>
            <button
              onClick={lock}
              className="glass-control sidenav-foot-btn"
              title="Lock adult area"
            >
              <Lock className="w-3.5 h-3.5" />
              {!collapsed && "Lock"}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
