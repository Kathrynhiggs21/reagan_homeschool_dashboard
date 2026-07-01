import { useEffect, useState } from "react";

/**
 * Glassy weather widget designed to live in the upper-left of the main scroll
 * area. Uses Open-Meteo (no key required) for current conditions, defaulting
 * to Indian Hill, OH (lat 39.18 / lon -84.30). The user can override the
 * latitude/longitude via localStorage `weatherLatLon = "lat,lon"`.
 *
 * Renders nothing while loading the first time (so it doesn't pop in & jiggle
 * the layout). Errors fall back silently to a tiny "weather offline" pill.
 *
 * Exposes its current condition slug via the global event bus
 * `window.dispatchEvent(new CustomEvent("kiwi:weather", { detail }))` so the
 * decorative duck-flock layer can react to it (rain → droplets, etc.).
 */

type WeatherState = {
  temp: number;
  apparent: number;
  code: number;
  isDay: boolean;
  windKph: number;
  label: string;
  emoji: string;
  summary: "sunny" | "cloudy" | "rain" | "snow" | "storm" | "fog" | "night" | "dusk";
};

const DEFAULT_LAT = 39.18;
const DEFAULT_LON = -84.30;

function describe(code: number, isDay: boolean): { label: string; emoji: string; summary: WeatherState["summary"] } {
  // Open-Meteo WMO weather codes — collapsed into 7 buckets.
  if ([0].includes(code))                   return { label: isDay ? "Sunny" : "Clear",       emoji: isDay ? "☀️" : "🌙", summary: isDay ? "sunny" : "night" };
  if ([1, 2].includes(code))                return { label: "Mostly sunny",                  emoji: "🌤️",              summary: "sunny" };
  if ([3].includes(code))                   return { label: "Cloudy",                        emoji: "☁️",              summary: "cloudy" };
  if ([45, 48].includes(code))              return { label: "Foggy",                         emoji: "🌫️",              summary: "fog" };
  if ([51, 53, 55, 56, 57].includes(code))  return { label: "Drizzle",                       emoji: "🌦️",              summary: "rain" };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { label: "Rain",               emoji: "🌧️",              summary: "rain" };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: "Snow",                       emoji: "🌨️",              summary: "snow" };
  if ([95, 96, 99].includes(code))          return { label: "Thunder",                       emoji: "⛈️",              summary: "storm" };
  return { label: "Outside",                                                                  emoji: "🌥️",              summary: "cloudy" };
}

export default function WeatherWidget() {
  const [w, setW] = useState<WeatherState | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        let lat = DEFAULT_LAT;
        let lon = DEFAULT_LON;
        const override = (typeof window !== "undefined") && localStorage.getItem("weatherLatLon");
        if (override && /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(override)) {
          const [a, b] = override.split(",").map(Number);
          lat = a; lon = b;
        }
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,is_day,wind_speed_10m,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("weather fetch failed");
        const json = await res.json();
        if (cancelled) return;
        const c = json.current || {};
        const code = Number(c.weather_code ?? 3);
        const isDay = c.is_day === 1 || c.is_day === true;
        const d = describe(code, isDay);
        // Golden-hour override: on an otherwise clear/sunny evening (5-8pm local)
        // shift the scene to the warm dusk photo for a cozy end-of-day feel.
        const hr = new Date().getHours();
        if (isDay && (d.summary === "sunny") && hr >= 17 && hr < 20) {
          d.summary = "dusk";
          d.label = "Golden hour";
          d.emoji = "🌇";
        }
        const next: WeatherState = {
          temp: Math.round(c.temperature_2m ?? 0),
          apparent: Math.round(c.apparent_temperature ?? 0),
          code,
          isDay,
          windKph: Math.round(c.wind_speed_10m ?? 0),
          label: d.label,
          emoji: d.emoji,
          summary: d.summary,
        };
        setW(next);
        // Broadcast for decorative layers to react to.
        try { window.dispatchEvent(new CustomEvent("kiwi:weather", { detail: next })); } catch { /* noop */ }
      } catch {
        if (!cancelled) setError(true);
      }
    }
    load();
    const id = setInterval(load, 15 * 60 * 1000); // refresh every 15 minutes
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (error && !w) {
    return (
      <div className="weather-widget no-print" aria-label="Weather currently unavailable">
        <span className="text-xs opacity-70">weather offline</span>
      </div>
    );
  }
  if (!w) return null;

  return (
    <div className="weather-widget no-print" title={`${w.label} — feels like ${w.apparent}°F, wind ${w.windKph} mph`}>
      <div className="weather-emoji" aria-hidden>{w.emoji}</div>
      <div className="weather-text">
        <div className="weather-temp">{w.temp}°</div>
        <div className="weather-label">{w.label}</div>
      </div>
    </div>
  );
}
