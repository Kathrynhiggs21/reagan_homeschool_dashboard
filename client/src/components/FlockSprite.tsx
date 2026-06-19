/**
 * FlockSprite — renders one of Reagan's flock companions.
 * Kiwi is Reagan's main bird (see KiwiSprite). The flock includes:
 *   - Lychee: Kiwi's MALE budgie best friend (coral/cream, rhymes with Kiwi)
 *   - Blue: a blue budgie
 *   - Daffy: a duckling
 *   - Honk: a gosling
 *   - Ducks: the 3-duck trio that waddles through occasionally
 * Art is served from Manus CDN storage.
 */

export type FlockMember = "kiwi" | "lychee" | "blue" | "daffy" | "honk" | "ducks";

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
  lychee: {
    src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663309818529/mm3swGictQLHDWKPJCGiHp/lychee_budgie_idle-oE93msvsSM2Jm98EAn5VNF.webp",
    name: "Lychee",
    species: "Parakeet",
    accent: "#f4736b",
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
  ducks: {
    // Reagan's flock: a tall cream-and-blue leader duck with two yellow twin
    // ducklings. Chibi/kawaii style to match Kiwi's big-eyed, glossy look.
    src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663309818529/mm3swGictQLHDWKPJCGiHp/duck_style_A_chibi-DKDzjP2m6njXVB5nTjot3U.webp",
    name: "the duck squad",
    species: "Ducks",
    accent: "#7fb8d6",
  },
};

export function getFlockMeta(member: FlockMember) {
  return FLOCK[member];
}

export const FLOCK_MEMBERS: FlockMember[] = ["kiwi", "lychee", "blue", "daffy", "honk", "ducks"];

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
