import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAdultLock } from "@/contexts/AdultLockContext";
import { useTutorMode } from "@/hooks/useTutorMode";
import SummerQuickToggle from "@/components/SummerQuickToggle";
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
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * OrbDock — the canonical navigation for the liquid-glass redesign.
 *
 * A floating dock of glossy glass "gem" orbs that cast soft shadows over the
 * nature photo. Bottom-centered on mobile; a vertical rail on the right on
 * desktop. The active orb lifts and glows in its own jewel color.
 *
 * Kid pages are always shown. Adult tools live behind a discreet "Parent"
 * orb that only reveals them once the adult area is unlocked. No flat boxes,
 * no sidebar — every element is a dimensional glass object.
 */

type Orb = {
  to: string;
  label: string;
  icon: LucideIcon;
  /** r,g,b core-glow color for the orb */
  color: string;
};

const KID_ORBS: Orb[] = [
  { to: "/today", label: "Today", icon: Sun, color: "56,189,248" },
  { to: "/schedule", label: "Schedule", icon: CalendarDays, color: "129,140,248" },
  { to: "/kiwi", label: "Kiwi", icon: Bird, color: "52,211,153" },
  { to: "/bookshelf", label: "Books", icon: BookOpen, color: "244,114,182" },
  { to: "/apps", label: "Apps", icon: Backpack, color: "251,191,36" },
];

const ADULT_ORBS: Orb[] = [
  { to: "/curriculum", label: "Curriculum", icon: BookMarked, color: "96,165,250" },
  { to: "/agenda-editor", label: "Agenda Editor", icon: Pencil, color: "167,139,250" },
  { to: "/adventures", label: "Idea Library", icon: Lightbulb, color: "251,146,60" },
  { to: "/analytics", label: "Analytics", icon: BarChart3, color: "45,212,191" },
  { to: "/settings", label: "Settings", icon: SettingsIcon, color: "148,163,184" },
];

export const DRIVE_HUB_URL =
  "https://drive.google.com/drive/folders/1r3bJacPLJN7VHI8y72rcx1-GRxspqo1r";

const TUTOR_FOCUS_PATHS = new Set(["/curriculum", "/agenda-editor", "/notes"]);

function OrbButton({
  orb,
  active,
  size = "md",
}: {
  orb: Orb;
  active: boolean;
  size?: "md" | "sm";
}) {
  const Icon = orb.icon;
  const dim = size === "md" ? "w-14 h-14" : "w-12 h-12";
  const iconDim = size === "md" ? "w-6 h-6" : "w-5 h-5";
  return (
    <Link href={orb.to} className="group flex flex-col items-center gap-1 shrink-0" title={orb.label}>
      <span
        className={`glass-orb ${dim} flex items-center justify-center`}
        data-active={active ? "true" : "false"}
        style={{ ["--orb-color" as string]: orb.color }}
      >
        <Icon className={`${iconDim} text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]`} strokeWidth={2.2} />
      </span>
      <span
        className={`text-[11px] font-semibold leading-none text-white/95 drop-shadow-[0_1px_4px_rgba(0,0,0,0.55)] ${
          active ? "opacity-100" : "opacity-90"
        }`}
      >
        {orb.label}
      </span>
    </Link>
  );
}

export default function OrbDock() {
  const [loc] = useLocation();
  const { unlocked, lock } = useAdultLock();
  const { enabled: tutorModeOn, setEnabled: setTutorMode } = useTutorMode();
  const [parentOpen, setParentOpen] = useState(false);

  // Close the parent tray whenever the route changes.
  useEffect(() => {
    setParentOpen(false);
  }, [loc]);

  const isActive = (to: string) => loc === to || (loc === "/" && to === "/today");

  const adultOrbs = tutorModeOn
    ? ADULT_ORBS.filter((o) => TUTOR_FOCUS_PATHS.has(o.to))
    : ADULT_ORBS;

  return (
    <nav className="orb-dock no-print" aria-label="Primary navigation">
      {/* Parent tray — floats above the dock when opened. */}
      {parentOpen && (
        <div className="orb-parent-tray glass-dock" role="menu">
          <div className="flex items-center justify-between px-1 pb-2">
            <span className="text-[11px] uppercase tracking-wider font-bold text-white/85 flex items-center gap-1">
              {unlocked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
              For Adults
            </span>
            <button
              onClick={() => setParentOpen(false)}
              className="glass-control w-6 h-6 flex items-center justify-center"
              aria-label="Close adult menu"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {unlocked ? (
            <>
              <div className="flex flex-wrap gap-3 justify-center max-w-[280px]">
                {adultOrbs.map((o) => (
                  <OrbButton key={o.to} orb={o} active={loc === o.to} size="sm" />
                ))}
                {!tutorModeOn && (
                  <a
                    href={DRIVE_HUB_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col items-center gap-1 shrink-0"
                    title="Open Reagan's Google Drive hub"
                  >
                    <span
                      className="glass-orb w-12 h-12 flex items-center justify-center"
                      style={{ ["--orb-color" as string]: "132,204,22" }}
                    >
                      <FolderOpen className="w-5 h-5 text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]" strokeWidth={2.2} />
                    </span>
                    <span className="text-[11px] font-semibold text-white/95 drop-shadow-[0_1px_4px_rgba(0,0,0,0.55)]">
                      Drive
                    </span>
                  </a>
                )}
              </div>
              {/* Summer mode operator — adult-only. */}
              <div className="mt-3">
                <SummerQuickToggle />
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setTutorMode(!tutorModeOn)}
                  className="glass-control flex-1 py-2 px-3 text-[12px] font-semibold flex items-center justify-center gap-1.5"
                  title={tutorModeOn ? "Turn tutor focus off" : "Hide Analytics/Settings during a tutor session"}
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  {tutorModeOn ? "Tutor ON" : "Tutor mode"}
                </button>
                <button
                  onClick={lock}
                  className="glass-control flex-1 py-2 px-3 text-[12px] font-semibold flex items-center justify-center gap-1.5"
                  title="Lock adult area"
                >
                  <Lock className="w-3.5 h-3.5" /> Lock
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 pb-1">
              <p className="text-[12px] text-white/85 text-center px-2">
                Grown-up tools are locked.
              </p>
              <Link href="/settings">
                <button className="glass-control py-2 px-4 text-[12px] font-semibold flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" /> Unlock adult area
                </button>
              </Link>
            </div>
          )}
        </div>
      )}

      {/* The dock rail. */}
      <div className="glass-dock orb-dock-rail">
        {KID_ORBS.map((o) => (
          <OrbButton key={o.to} orb={o} active={isActive(o.to)} />
        ))}

        {/* Divider gem — the Parent orb. */}
        <button
          onClick={() => setParentOpen((v) => !v)}
          className="group flex flex-col items-center gap-1 shrink-0"
          title="Grown-up tools"
          aria-expanded={parentOpen}
        >
          <span
            className="glass-orb w-14 h-14 flex items-center justify-center"
            data-active={parentOpen ? "true" : "false"}
            style={{ ["--orb-color" as string]: unlocked ? "132,204,22" : "148,163,184" }}
          >
            {unlocked ? (
              <Unlock className="w-6 h-6 text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]" strokeWidth={2.2} />
            ) : (
              <Lock className="w-6 h-6 text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]" strokeWidth={2.2} />
            )}
          </span>
          <span className="text-[11px] font-semibold text-white/95 drop-shadow-[0_1px_4px_rgba(0,0,0,0.55)]">
            Parent
          </span>
        </button>
      </div>
    </nav>
  );
}
