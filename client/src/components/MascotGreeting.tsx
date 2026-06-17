import { useMemo } from "react";
import { useKiwi } from "@/contexts/KiwiContext";
import { trpc } from "@/lib/trpc";
import KiwiSprite from "./KiwiSprite";
import { resolveKiwiDayCharacter } from "@shared/kiwiCharacter";

/**
 * MascotGreeting
 * --------------
 * The mascot illustration next to the "Good Morning, Reagan!" greeting.
 *
 * 2026-06-17 (Katy): this is now KIWI herself, dressed for the day. The
 * deterministic day-engine (resolveKiwiDayCharacter) picks her costume from
 * today's calendar events + holidays + vacation, and a matching funny line in
 * her sarcastic tween voice shows on hover/title. If Reagan has uploaded a
 * profile photo, we still show that instead (her choice wins).
 */
export default function MascotGreeting() {
  const kiwi = useKiwi() as unknown as { photoUrl?: string | null };
  const hasPhoto = !!kiwi?.photoUrl;

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const todayChar = trpc.kiwi.today.useQuery(undefined, { staleTime: 10 * 60_000 });
  const dayChar = useMemo(
    () => todayChar.data ?? resolveKiwiDayCharacter(todayISO, {}),
    [todayChar.data, todayISO],
  );

  return (
    <div
      className="relative hidden sm:flex flex-col items-center justify-center select-none shrink-0"
      aria-label={hasPhoto ? "Reagan" : `Kiwi today: ${dayChar.costumeLabel}`}
      title={hasPhoto ? "Reagan" : `${dayChar.costumeLabel} — "${dayChar.funnyLine}"`}
      style={{ width: 92, height: 92 }}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: "radial-gradient(circle at 50% 40%, #7fe3c433, transparent 70%)",
          filter: "blur(2px)",
        }}
      />
      {hasPhoto ? (
        <img
          src={kiwi!.photoUrl!}
          alt="Reagan"
          className="relative rounded-full object-cover"
          style={{
            width: 78,
            height: 78,
            border: "4px solid #ffffff",
            boxShadow: "0 6px 14px rgba(0,0,0,0.25), 0 0 0 2px rgba(255,217,122,0.45)",
            animation: "mascot-float 3.6s ease-in-out infinite",
          }}
        />
      ) : (
        <div className="relative" style={{ animation: "mascot-float 3.6s ease-in-out infinite" }}>
          <KiwiSprite pose="idle" size={84} animate costume={dayChar.costume} ariaLabel={`Kiwi — ${dayChar.costumeLabel}`} />
        </div>
      )}
      <style>{`
        @keyframes mascot-float {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50%      { transform: translateY(-6px) rotate(2deg); }
        }
      `}</style>
    </div>
  );
}
