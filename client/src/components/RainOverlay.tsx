import { useEffect, useMemo, useState } from "react";

/**
 * RainOverlay — draws real animated rain over the whole app when the live
 * weather is rainy, and retints the glass "scene accent" to match the current
 * weather/scene mood.
 *
 * The WeatherWidget already fetches Open-Meteo client-side and broadcasts a
 * `kiwi:weather` CustomEvent with a `summary` slug
 * ("sunny" | "cloudy" | "rain" | "snow" | "storm" | "fog" | "night").
 * We listen to that so there's a single source of truth and no duplicate
 * fetch. A `?rain=1` / `?rain=0` URL param overrides for testing.
 *
 * Non-interactive, respects prefers-reduced-motion, renders nothing when dry.
 */

type Summary = "sunny" | "cloudy" | "rain" | "snow" | "storm" | "fog" | "night" | "dusk";

// Scene accent (r,g,b) per weather mood — drives --scene-accent so the whole
// glass UI subtly shifts tone with the sky.
const ACCENT_BY_SUMMARY: Record<Summary, { accent: string; accent2: string }> = {
  sunny: { accent: "56,189,248", accent2: "129,140,248" },   // sky blue + periwinkle
  cloudy: { accent: "148,163,184", accent2: "125,140,170" }, // cool slate
  rain: { accent: "96,165,250", accent2: "56,120,200" },     // deeper blue
  storm: { accent: "129,140,248", accent2: "88,80,190" },    // indigo
  snow: { accent: "186,230,253", accent2: "148,180,220" },   // pale ice
  fog: { accent: "148,163,184", accent2: "130,150,175" },    // grey-blue
  night: { accent: "129,140,248", accent2: "88,100,210" },   // periwinkle dusk
  dusk: { accent: "251,191,120", accent2: "236,140,120" },   // warm amber + rose
};

// Which full-bleed scene photo backs each weather mood. "forest" = the
// default sunny daytime scene (no data-rscene attribute needed).
type Scene = "forest" | "overcast" | "rain" | "dusk" | "night";
const SCENE_BY_SUMMARY: Record<Summary, Scene> = {
  sunny: "forest",
  cloudy: "overcast",
  fog: "overcast",
  rain: "rain",
  storm: "rain",
  snow: "overcast",
  night: "night",
  dusk: "dusk",
};

export default function RainOverlay() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [reduced, setReduced] = useState(false);

  const override = useMemo<boolean | null>(() => {
    if (typeof window === "undefined") return null;
    const p = new URLSearchParams(window.location.search).get("rain");
    if (p === "1") return true;
    if (p === "0") return false;
    return null;
  }, []);

  // Listen to the shared weather broadcast.
  useEffect(() => {
    function onWeather(e: Event) {
      const detail = (e as CustomEvent).detail as { summary?: Summary } | undefined;
      if (detail?.summary) setSummary(detail.summary);
    }
    window.addEventListener("kiwi:weather", onWeather as EventListener);
    return () => window.removeEventListener("kiwi:weather", onWeather as EventListener);
  }, []);

  // Retint the glass scene accent AND swap the full-bleed background photo
  // whenever the weather mood (or day/night) changes. `data-rscene` on <html>
  // selects the matching scene image in index.css.
  useEffect(() => {
    if (!summary) return;
    const map = ACCENT_BY_SUMMARY[summary];
    if (!map) return;
    const root = document.documentElement;
    root.style.setProperty("--scene-accent", map.accent);
    root.style.setProperty("--scene-accent-2", map.accent2);
    // Collapse the 7 weather summaries into the 5 scene photos we ship
    // (forest sunny default, overcast, rain, dusk, night).
    const scene = SCENE_BY_SUMMARY[summary];
    if (scene === "forest") root.removeAttribute("data-rscene");
    else root.setAttribute("data-rscene", scene);
  }, [summary]);

  // Reduced-motion guard.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const rainingFromFeed = summary === "rain" || summary === "storm";
  const raining = override ?? rainingFromFeed;

  const drops = useMemo(() => {
    const N = 90;
    return Array.from({ length: N }, (_, i) => ({
      i,
      left: Math.random() * 100,
      delay: Math.random() * 2.2,
      duration: 0.55 + Math.random() * 0.7,
      height: 50 + Math.random() * 60,
      opacity: 0.35 + Math.random() * 0.5,
    }));
  }, []);

  if (!raining || reduced) return null;

  return (
    <div className="rain-layer" aria-hidden>
      {drops.map((d) => (
        <span
          key={d.i}
          className="rain-drop"
          style={{
            left: `${d.left}%`,
            height: `${d.height}px`,
            opacity: d.opacity,
            animationDelay: `${d.delay}s`,
            animationDuration: `${d.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
