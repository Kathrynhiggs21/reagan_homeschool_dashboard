/**
 * BudgieOverlay — a large, transparent, animated budgie that is softly present
 * across the scene (Katy design intent, 2026-07-01). It drifts/floats behind
 * all content (low z-index, pointer-events:none) and NEVER sits over text — it
 * is anchored to the lower-left margin gutter, well clear of the centered
 * content column. Respects prefers-reduced-motion (animation is disabled in
 * CSS for those users, leaving a still perched budgie).
 */
const BUDGIE_SRC = "/manus-storage/grad_cap_fly_320da118.png";

export default function BudgieOverlay() {
  return (
    <div className="budgie-overlay no-print" aria-hidden="true">
      <img src={BUDGIE_SRC} alt="" className="budgie-overlay-img" draggable={false} />
    </div>
  );
}
