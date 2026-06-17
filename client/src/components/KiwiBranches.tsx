import { useEffect, useState } from "react";
import { computeBranches, type Branch } from "@/lib/kiwiWorld";
import { useKiwi } from "@/contexts/KiwiContext";

/**
 * KiwiBranches — decorative tree branches poking in from the page edges that
 * Kiwi can land/swing/hammock on. Purely visual + non-interactive (very low
 * z-index, pointer-events: none) so they never block the dashboard UI. The
 * perch reads branch positions via the same computeBranches() helper.
 *
 * Respects Mom's visibility toggle: hidden when the floating Kiwi is hidden or
 * an adult is present (so it stays calm during teaching).
 */
export default function KiwiBranches() {
  const { enabled, adultPresent, showKiwiPerch } = useKiwi();
  const [branches, setBranches] = useState<Branch[]>(() => computeBranches());

  useEffect(() => {
    const onResize = () => setBranches(computeBranches());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (!enabled || adultPresent || !showKiwiPerch) return null;

  return (
    <div className="fixed inset-0 z-0 pointer-events-none no-print" aria-hidden>
      {branches.map((b) => (
        <BranchGfx key={b.id} branch={b} />
      ))}
      <style>{`
        @keyframes kiwiSwingSway { 0%,100% { transform: rotate(-7deg); } 50% { transform: rotate(7deg); } }
        @keyframes kiwiLeafWiggle { 0%,100% { transform: rotate(-2deg); } 50% { transform: rotate(3deg); } }
      `}</style>
    </div>
  );
}

function BranchGfx({ branch }: { branch: Branch }) {
  const { side, x, y, length, fixture } = branch;

  // Orientation per side: top branches hang down, side branches reach inward.
  const isTop = side === "top";
  const isLeft = side === "left";

  const branchStyle: React.CSSProperties = {
    position: "absolute",
    left: x,
    top: y,
    transformOrigin: isTop ? "top center" : isLeft ? "left center" : "right center",
  };

  // The branch itself: a tapered brown bar with a couple of leaf clusters.
  const barLen = length;
  const barThick = 10;

  return (
    <div style={branchStyle}>
      {/* Wood */}
      <div
        style={{
          position: "absolute",
          width: isTop ? barThick : barLen,
          height: isTop ? barLen : barThick,
          left: isTop ? -barThick / 2 : isLeft ? 0 : -barLen,
          top: isTop ? 0 : -barThick / 2,
          background: "linear-gradient(90deg,#7c4a21,#9c5a2a)",
          borderRadius: 6,
          boxShadow: "0 2px 4px rgba(0,0,0,0.18)",
          animation: "kiwiLeafWiggle 6s ease-in-out infinite",
        }}
      />
      {/* Leaf cluster near the tip */}
      <div
        style={{
          position: "absolute",
          fontSize: 26,
          left: isTop ? -10 : isLeft ? barLen - 14 : -barLen - 6,
          top: isTop ? barLen - 16 : -16,
          animation: "kiwiLeafWiggle 5s ease-in-out infinite",
        }}
      >
        {"\u{1F343}"}
      </div>
      {/* Swing */}
      {fixture === "swing" && (
        <div
          style={{
            position: "absolute",
            left: isTop ? -2 : barLen * 0.6,
            top: isTop ? barLen : barThick,
            width: 2,
            height: 38,
            transformOrigin: "top center",
            animation: "kiwiSwingSway 4s ease-in-out infinite",
          }}
        >
          <div style={{ width: 2, height: 30, background: "#6b7280", margin: "0 auto" }} />
          <div style={{ width: 34, height: 8, background: "#92633a", borderRadius: 3, marginLeft: -16 }} />
        </div>
      )}
      {/* Hammock */}
      {fixture === "hammock" && (
        <div
          style={{
            position: "absolute",
            left: isLeft ? barLen - 8 : -barLen + 8,
            top: barThick + 6,
            width: 64,
            height: 22,
            borderBottom: "4px solid #c084fc",
            borderRadius: "0 0 40px 40px",
            background: "repeating-linear-gradient(90deg,#e9d5ff 0 4px,transparent 4px 8px)",
            animation: "kiwiSwingSway 6s ease-in-out infinite",
            transformOrigin: "top center",
          }}
        />
      )}
    </div>
  );
}
