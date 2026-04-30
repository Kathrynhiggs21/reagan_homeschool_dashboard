/**
 * Lightweight confetti burst — no deps. Spawns N colored squares/stars that
 * drift + fade out over ~900ms. Call popConfettiAt(clientX, clientY).
 * Safe in SSR (no-op if `window` is undefined).
 */

const COLORS = ["#ff9fb2", "#ffd97a", "#7fe3c4", "#b7a8ff", "#9ad3ff", "#ffb085"];

export function popConfettiAt(x: number, y: number, count = 22): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const root = document.createElement("div");
  root.style.position = "fixed";
  root.style.left = "0";
  root.style.top = "0";
  root.style.pointerEvents = "none";
  root.style.zIndex = "9999";
  root.style.width = "0";
  root.style.height = "0";
  document.body.appendChild(root);

  for (let i = 0; i < count; i++) {
    const p = document.createElement("span");
    const size = 6 + Math.random() * 6;
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const angle = Math.random() * Math.PI * 2;
    const distance = 40 + Math.random() * 90;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance - 20; // bias upward

    Object.assign(p.style, {
      position: "absolute",
      left: `${x}px`,
      top: `${y}px`,
      width: `${size}px`,
      height: `${size}px`,
      background: color,
      borderRadius: Math.random() > 0.5 ? "50%" : "2px",
      transform: `translate(-50%,-50%) rotate(${Math.random() * 360}deg)`,
      opacity: "1",
      transition: `transform 900ms cubic-bezier(.2,.7,.3,1), opacity 900ms linear`,
    } as CSSStyleDeclaration);
    root.appendChild(p);
    requestAnimationFrame(() => {
      p.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${
        Math.random() * 540
      }deg)`;
      p.style.opacity = "0";
    });
  }

  setTimeout(() => root.remove(), 1100);
}

/** Convenience: burst from the middle of an element */
export function popConfettiFromElement(el: Element | null, count = 22): void {
  if (!el) return;
  const r = (el as HTMLElement).getBoundingClientRect();
  popConfettiAt(r.left + r.width / 2, r.top + r.height / 2, count);
}
