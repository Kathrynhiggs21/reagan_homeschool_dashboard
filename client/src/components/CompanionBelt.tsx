/**
 * CompanionBelt — small horizontal strip of Reagan's flock companions.
 *
 * Tap a member to make them the active companion. This persists to
 * localStorage ("activeCompanion") and dispatches the
 * "kiwi:active-companion-changed" event so KiwiCompanion + Today greeting
 * pick up the new sprite + voice without a page reload.
 *
 * Used inside the kid sidebar (CozyShell) under "For Reagan".
 */
import { useEffect, useState } from "react";
import FlockSprite, { FLOCK_MEMBERS, getFlockMeta, type FlockMember } from "./FlockSprite";
import {
  COMPANION_VOICES,
  getActiveCompanionId,
  setActiveCompanionId,
  speakAs,
  type CompanionId,
} from "@/lib/companionVoices";

export default function CompanionBelt({
  size = 40,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const [active, setActive] = useState<CompanionId>(() => getActiveCompanionId());

  useEffect(() => {
    function onChange(e: Event) {
      const id = (e as CustomEvent).detail?.id as CompanionId | undefined;
      if (id) setActive(id);
    }
    window.addEventListener("kiwi:active-companion-changed", onChange as EventListener);
    return () => window.removeEventListener("kiwi:active-companion-changed", onChange as EventListener);
  }, []);

  function pick(id: FlockMember) {
    setActiveCompanionId(id as CompanionId);
    setActive(id as CompanionId);
    // Friendly bark from the new companion (silenced by default unless adult un-muted Kiwi).
    const meta = getFlockMeta(id);
    speakAs(id as CompanionId, `Hi! I'm ${meta.name}.`);
  }

  // DON'T-SHOW-IF-NO-INFO (2026-05-12 push 14): if the flock list ever empties, render nothing
  if (!FLOCK_MEMBERS || FLOCK_MEMBERS.length === 0) return null;

  return (
    <div
      className={`flex items-center gap-2 px-2 py-1.5 rounded-xl bg-black/20 border border-white/10 ${className ?? ""}`}
      role="radiogroup"
      aria-label="Pick a flock companion"
    >
      {FLOCK_MEMBERS.map((m) => {
        const meta = getFlockMeta(m);
        const cfg = COMPANION_VOICES[m as CompanionId] ?? COMPANION_VOICES.kiwi;
        const isActive = active === m;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={isActive}
            title={`${meta.name} • ${cfg.blurb}`}
            onClick={() => pick(m)}
            className={`relative shrink-0 rounded-full p-0.5 transition outline-none ${
              isActive
                ? "ring-2 ring-amber-300 bg-amber-300/15"
                : "ring-1 ring-white/10 hover:ring-white/30"
            }`}
            style={{ width: size + 8, height: size + 8 }}
          >
            <FlockSprite member={m} size={size} />
            {isActive && (
              <span
                aria-hidden
                className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[9px] font-semibold text-amber-200"
              >
                {meta.name}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
