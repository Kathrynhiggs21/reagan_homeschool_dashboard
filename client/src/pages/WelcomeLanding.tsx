import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAdultLock } from "@/contexts/AdultLockContext";
import {
  Sun,
  CalendarDays,
  Bird,
  Compass,
  Gift,
  Link2,
  Lock,
  Unlock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * WelcomeLanding — the glass welcome surface (2026-07-01, Katy).
 *
 * Rebuilt to match the reference mockup (1000410834.png):
 *   • soft watery bokeh background, full-bleed, with an adaptive scrim so text
 *     on glass always stays readable (background darkens gently behind text);
 *   • top-left welcome header + "ride the wave" subtitle;
 *   • top-right "Parent Access" glass pill (opens the passcode gate);
 *   • two flying budgies (blue-green + yellow) in the upper-right, transparent;
 *   • five glossy 3D glass orbs arranged in a gentle WAVE ARC
 *     (Today / Schedule / Kiwi Chat / Adventure / Rewards);
 *   • no hearts bar (removed per Katy);
 *   • Kiwi stays just the animated bird bottom-right (rendered globally),
 *     with no extra UI clutter on this page.
 *
 * The page is sized to its content with vertical scroll when the viewport is
 * short (min-h-screen + overflow scroll), never cropping the orbs.
 */

const BOKEH_BG = "/manus-storage/glass-landing-bokeh-desktop_b4e6b99e.png";
const BUDGIES = "/manus-storage/flying-two-budgies_a4e40a7a.png";

type Gem = {
  to: string;
  label: string;
  icon: LucideIcon;
  /** r,g,b core-glow color for the orb */
  color: string;
  /** vertical lift (px) to build the wave arc; +down, -up */
  dy: number;
};

const GEMS: Gem[] = [
  { to: "/today", label: "Today", icon: Sun, color: "56,189,248", dy: 22 },
  { to: "/schedule", label: "Schedule", icon: CalendarDays, color: "132,204,22", dy: -6 },
  { to: "/kiwi", label: "Kiwi Chat", icon: Bird, color: "167,139,250", dy: -30 },
  { to: "/adventures", label: "Adventure", icon: Compass, color: "251,146,60", dy: -6 },
  { to: "/coins", label: "Rewards", icon: Gift, color: "244,63,94", dy: 22 },
];

function WaveOrb({ gem, index }: { gem: Gem; index: number }) {
  const Icon = gem.icon;
  return (
    <Link
      href={gem.to}
      className="group flex flex-col items-center gap-2 shrink-0"
      title={gem.label}
      style={{ transform: `translateY(${gem.dy}px)` }}
    >
      <span
        className="glass-orb welcome-orb flex items-center justify-center"
        style={{
          ["--orb-color" as string]: gem.color,
          animationDelay: `${index * 120}ms`,
        }}
        data-anim="orb-pop"
      >
        <span className="welcome-orb-label">{gem.label}</span>
        <Icon
          className="welcome-orb-icon text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]"
          strokeWidth={2.2}
          aria-hidden="true"
        />
      </span>
    </Link>
  );
}

/** Small inline passcode gate shown when Parent Access is tapped. */
function ParentAccess() {
  const { unlocked, unlock, lock } = useAdultLock();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);

  if (unlocked) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate("/curriculum")}
          className="glass-control px-4 py-2 text-sm font-semibold"
          title="Open grown-up tools"
        >
          <Unlock className="w-4 h-4" /> Parent tools
        </button>
        <button
          onClick={lock}
          className="glass-control px-3 py-2 text-sm font-semibold"
          title="Lock adult area"
        >
          <Lock className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="glass-control px-4 py-2 text-sm font-semibold"
        aria-expanded={open}
        title="Grown-up access"
      >
        Parent Access
        <Link2 className="w-4 h-4" />
      </button>

      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (unlock(code)) {
              setError(false);
              setCode("");
              setOpen(false);
              navigate("/curriculum");
            } else {
              setError(true);
              setCode("");
            }
          }}
          className="glass-panel absolute right-0 mt-2 w-60 p-4 z-50"
        >
          <label className="block text-[11px] uppercase tracking-wider font-bold text-white/85 mb-2">
            Enter 4-digit passcode
          </label>
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            maxLength={8}
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError(false);
            }}
            className="w-full text-center text-xl tracking-[0.4em] rounded-full bg-white/15 border border-white/30 px-3 py-2 text-white placeholder-white/50 outline-none focus:border-white/60"
            placeholder="••••"
          />
          {error && (
            <p className="text-xs text-rose-200 mt-2 text-center">
              That's not the right code.
            </p>
          )}
          <button
            type="submit"
            className="glass-control glass-control--primary w-full mt-3 py-2 text-sm font-semibold"
          >
            Unlock
          </button>
        </form>
      )}
    </div>
  );
}

export default function WelcomeLanding() {
  const profile = trpc.profile.get.useQuery();
  const updateProfile = trpc.profile.update.useMutation();

  // Once a grown-up (or Reagan) has actually opened the space, mark onboarding
  // done so the guard stops forcing /welcome. We do it on first mount of the
  // landing so the mockup is the front door, but returning users land on Today.
  useEffect(() => {
    if (!profile.data) return;
    const done = (profile.data as any).onboardingCompleted;
    if (!done) {
      updateProfile.mutate({ onboardingCompleted: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.data]);

  const studentName = useMemo(() => {
    const n = (profile.data as any)?.studentName || "Reagan";
    return String(n).split(" ")[0];
  }, [profile.data]);

  return (
    <div className="welcome-landing">
      {/* Full-bleed watery bokeh photo with an adaptive readability scrim. */}
      <div
        className="welcome-bg"
        style={{ backgroundImage: `url("${BOKEH_BG}")` }}
        aria-hidden="true"
      />
      <div className="welcome-scrim" aria-hidden="true" />

      {/* Flying pair of budgies, upper-right. */}
      <img
        src={BUDGIES}
        alt="Two budgies flying"
        className="welcome-budgies"
        draggable={false}
      />

      <div className="welcome-inner">
        {/* Header row: welcome text (left) + Parent Access (right). */}
        <header className="welcome-header">
          <div className="welcome-heading" data-anim="pop">
            <p className="welcome-eyebrow">Welcome to</p>
            <h1 className="welcome-title">
              {studentName} School{" "}
              <span className="welcome-heart" aria-hidden="true">
                💙
              </span>
            </h1>
            <p className="welcome-subtitle">
              Ride the wave of learning to new adventures.
            </p>
          </div>

          <div className="welcome-parent" data-anim="pop">
            <ParentAccess />
          </div>
        </header>

        {/* Wave-arc of five glossy glass orbs. */}
        <nav className="welcome-orbs" aria-label="Go to a place">
          {GEMS.map((g, i) => (
            <WaveOrb key={g.to} gem={g} index={i} />
          ))}
        </nav>

        {/* No hearts bar here (removed per Katy). Kiwi is the animated bird
            bottom-right, rendered globally — nothing else down here. */}
      </div>
    </div>
  );
}
