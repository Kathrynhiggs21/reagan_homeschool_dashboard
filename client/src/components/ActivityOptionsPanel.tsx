import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { rainbowCardStyle, rainbowInkStyle, rainbowPillStyle } from "@/lib/subjectColors";

/**
 * ActivityOptionsPanel — at most 10 weighted ideas surfaced under This Week.
 * Pulls Reagan's profile interests + current weather (Open-Meteo, no key)
 * and asks the server's pure picker for ranked suggestions.
 *
 * Hidden until at least one suggestion has a positive score, so it never
 * shows a sad "nothing to do" state.
 */
type WeatherProbe = { tempF: number | null; weather: string | null };

const DEFAULT_LAT = 39.18;
const DEFAULT_LON = -84.30;

async function fetchWeather(): Promise<WeatherProbe> {
  try {
    let lat = DEFAULT_LAT;
    let lon = DEFAULT_LON;
    const override =
      typeof window !== "undefined" && localStorage.getItem("weatherLatLon");
    if (override && /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(override)) {
      const [a, b] = override.split(",").map(Number);
      lat = a;
      lon = b;
    }
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return { tempF: null, weather: null };
    const j = await res.json();
    const code: number = j?.current?.weather_code ?? -1;
    const tempF: number | null =
      typeof j?.current?.temperature_2m === "number"
        ? j.current.temperature_2m
        : null;
    let weather: string | null = "clear";
    if ([1, 2, 3].includes(code)) weather = "clouds";
    else if ([45, 48].includes(code)) weather = "fog";
    else if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code))
      weather = "rain";
    else if ([71, 73, 75, 77, 85, 86].includes(code)) weather = "snow";
    else if ([95, 96, 99].includes(code)) weather = "storm";
    return { tempF, weather };
  } catch {
    return { tempF: null, weather: null };
  }
}

export default function ActivityOptionsPanel() {
  const [probe, setProbe] = useState<WeatherProbe>({ tempF: null, weather: null });
  useEffect(() => {
    let alive = true;
    fetchWeather().then((p) => {
      if (alive) setProbe(p);
    });
    return () => {
      alive = false;
    };
  }, []);

  const q = trpc.activityOptions.suggest.useQuery(
    { tempF: probe.tempF, weather: probe.weather },
    { staleTime: 60_000 },
  );

  if (q.isLoading) return null;
  const ideas = (q.data || []) as Array<any>;
  const visible = ideas.filter((i) => i.score > 0).slice(0, 10);
  if (visible.length === 0) return null;

  return (
    <Card className="classroom-card p-4 space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Activity Options
          </div>
          <h2 className="font-display text-xl leading-tight">
            Pick something fresh for this week
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ranked by what you like, the weather, and the time of day. Up to 10.
          </p>
        </div>
        {probe.tempF !== null && (
          <div className="text-[11px] text-muted-foreground">
            now: {Math.round(probe.tempF)}°{probe.weather ? ` · ${probe.weather}` : ""}
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {visible.map((idea, i) => (
          <div key={idea.id} className="rounded-2xl p-3 flex gap-3" style={rainbowCardStyle(i)}>
            <span className="text-3xl shrink-0" aria-hidden>
              {idea.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-display text-base" style={rainbowInkStyle(i)}>
                  {idea.title}
                </span>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={rainbowPillStyle(i)}
                >
                  {idea.minutes} min
                </span>
              </div>
              <div className="text-xs text-neutral-300 mt-0.5">{idea.why}</div>
              {idea.reasons?.length > 0 && (
                <div className="text-[10px] text-neutral-400 mt-1 italic truncate">
                  {idea.reasons.slice(0, 3).join(" · ")}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
