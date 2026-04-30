/**
 * Sticker burst — emoji confetti. Visual-only, zero audio.
 *
 * Spawns N emoji stickers from (x, y) that float upward, rotate, and fade
 * over ~1.2s. Designed to fire from KiwiPerch when Reagan completes a block.
 *
 *   popStickersAt(clientX, clientY)
 *   popStickersFromElement(el)
 *
 * Safe in SSR (no-op if `window` is undefined). Honors prefers-reduced-motion
 * by dropping animation duration to zero so it becomes a single flash, not a
 * drift — some autistic users find drifting motion dysregulating.
 */

const STICKERS = [
  "⭐", "🌟", "✨", "💛", "🦜", "🌸", "🌻", "🌿", "🐾", "🪶", "🦋", "🌈", "🪄",
];

interface StickerOptions {
  count?: number;
  stickers?: string[];
}

export function popStickersAt(x: number, y: number, opts: StickerOptions = {}): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const count = opts.count ?? 14;
  const pool = opts.stickers ?? STICKERS;

  // Respect reduced-motion: render a single calm flash instead of drifting particles.
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const durationMs = reduced ? 250 : 1200;

  const root = document.createElement("div");
  Object.assign(root.style, {
    position: "fixed",
    left: "0",
    top: "0",
    pointerEvents: "none",
    zIndex: "9999",
    width: "0",
    height: "0",
  } as CSSStyleDeclaration);
  document.body.appendChild(root);

  for (let i = 0; i < count; i++) {
    const span = document.createElement("span");
    const emoji = pool[Math.floor(Math.random() * pool.length)];
    span.textContent = emoji;

    const size = 20 + Math.random() * 18; // 20–38 px
    // Spread bias upward (like a bubbling fountain) so stickers seem to "rain up".
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI; // mostly up
    const distance = reduced ? 4 : 70 + Math.random() * 130;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;
    const rot = (Math.random() - 0.5) * 180;

    Object.assign(span.style, {
      position: "absolute",
      left: `${x}px`,
      top: `${y}px`,
      fontSize: `${size}px`,
      lineHeight: "1",
      opacity: "0",
      transform: `translate(-50%, -50%) scale(0.4) rotate(0deg)`,
      transition: `transform ${durationMs}ms cubic-bezier(.2,.7,.3,1), opacity ${durationMs}ms ease-out`,
      willChange: "transform, opacity",
      userSelect: "none",
    } as CSSStyleDeclaration);
    root.appendChild(span);

    // Kick off animation next frame.
    requestAnimationFrame(() => {
      span.style.opacity = "1";
      span.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1) rotate(${rot}deg)`;
      // Fade out partway through.
      setTimeout(() => {
        span.style.opacity = "0";
      }, durationMs * 0.6);
    });
  }

  setTimeout(() => root.remove(), durationMs + 200);
}

export function popStickersFromElement(el: Element | null, opts: StickerOptions = {}): void {
  if (!el) return;
  const r = (el as HTMLElement).getBoundingClientRect();
  popStickersAt(r.left + r.width / 2, r.top + r.height / 2, opts);
}

/**
 * Convenience for the "Done!" block-completion celebration: fire from the
 * KiwiPerch bubble if it's mounted, else from screen center. Silent (no audio).
 */
export function celebrateBlockDone(): void {
  if (typeof document === "undefined") return;
  const perch = document.querySelector("[data-kiwi-perch]");
  if (perch) {
    popStickersFromElement(perch, { count: 16 });
  } else {
    popStickersAt(window.innerWidth / 2, window.innerHeight * 0.45, { count: 16 });
  }
}
