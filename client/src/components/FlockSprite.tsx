/**
 * FlockSprite — renders one of Reagan's flock companions.
 * Kiwi is Reagan's main bird (see KiwiSprite). The flock includes
 * Blue (a blue budgie), Daffy (a duckling), and Honk (a gosling).
 * These are stub poses for now (idle only) — we can expand to animated
 * sprites later. Art is served from Manus CDN storage.
 */

export type FlockMember = "kiwi" | "blue" | "daffy" | "honk";

const FLOCK: Record<
  FlockMember,
  { src: string; name: string; species: string; accent: string }
> = {
  kiwi: {
    src: "/manus-storage/kiwi_sm_idle_fdf35d4d.webp",
    name: "Kiwi",
    species: "Parakeet",
    accent: "#f59e0b",
  },
  blue: {
    src: "/manus-storage/blue_budgie_idle_63a1d557.webp",
    name: "Blue",
    species: "Parakeet",
    accent: "#3b82f6",
  },
  daffy: {
    src: "/manus-storage/duckling_idle_cea6167e.webp",
    name: "Daffy",
    species: "Duckling",
    accent: "#eab308",
  },
  honk: {
    src: "/manus-storage/gosling_idle_2a9d1351.webp",
    name: "Honk",
    species: "Gosling",
    accent: "#84a050",
  },
};

export function getFlockMeta(member: FlockMember) {
  return FLOCK[member];
}

export const FLOCK_MEMBERS: FlockMember[] = ["kiwi", "blue", "daffy", "honk"];

export default function FlockSprite({
  member,
  size = 96,
  className,
  alt,
}: {
  member: FlockMember;
  size?: number;
  className?: string;
  alt?: string;
}) {
  const m = FLOCK[member];
  if (!m) return null;
  return (
    <img
      src={m.src}
      alt={alt ?? `${m.name} the ${m.species}`}
      width={size}
      height={size}
      className={className}
      style={{ imageRendering: "auto", userSelect: "none", pointerEvents: "none" }}
      draggable={false}
    />
  );
}
