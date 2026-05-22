/**
 * KiwiVoiceSliders.tsx — v2.87 (2026-05-21)
 *
 * Mom asked: "add more adjustment sliders for kiwis voice and personality."
 *
 * This panel lives on the Kiwi page. It exposes 6 sliders that all persist
 * to localStorage so Kiwi feels the same on every reload + every device:
 *
 *   Voice:        Speed (rate)         0.7 – 1.6
 *                 Pitch                0.6 – 2.2
 *                 Volume               0.0 – 1.0
 *   Personality:  Warmth               0.0 – 1.0
 *                 Playfulness          0.0 – 1.0
 *                 Brevity              0.0 – 1.0
 *
 * The voice sliders feed `getBirdVoiceConfig()` in `lib/birdVoice.ts`. The
 * personality sliders are read by TalkToKiwiButton and KiwiCompanion before
 * each kiwi.chat call, then mapped server-side to a short tone-hint suffix.
 *
 * UI:
 *  - Two grouped sections (🎤 Voice, 🌱 Personality)
 *  - Each row: label · live value · slider · "midpoint" tick mark
 *  - "🔊 Test" button speaks a sample line through the current settings
 *  - "Reset to Mom's defaults" button clears all six keys
 *
 * Trauma-safe: no scolding language, no timers, no "right" answer — every
 * slider is a preference, not a grade.
 */

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  BIRD_VOICE_DEFAULTS,
  getBirdVoiceConfig,
  setBirdVoiceConfig,
  speakLikeBird,
} from "@/lib/birdVoice";

const PERSONALITY_DEFAULTS = {
  warmth: 0.5,
  playfulness: 0.5,
  brevity: 0.5,
} as const;

const LS_KEYS = {
  warmth: "kiwiPersonalityWarmth",
  playfulness: "kiwiPersonalityPlayfulness",
  brevity: "kiwiPersonalityBrevity",
} as const;

function readPersonality() {
  if (typeof window === "undefined") return { ...PERSONALITY_DEFAULTS };
  const get = (k: string, fb: number) => {
    try {
      const raw = window.localStorage?.getItem(k);
      if (raw == null) return fb;
      const n = Number(raw);
      if (!Number.isFinite(n)) return fb;
      return Math.max(0, Math.min(1, n));
    } catch {
      return fb;
    }
  };
  return {
    warmth: get(LS_KEYS.warmth, PERSONALITY_DEFAULTS.warmth),
    playfulness: get(LS_KEYS.playfulness, PERSONALITY_DEFAULTS.playfulness),
    brevity: get(LS_KEYS.brevity, PERSONALITY_DEFAULTS.brevity),
  };
}

/** Public helper — used by TalkToKiwiButton + KiwiCompanion when they call kiwi.chat. */
export function getKiwiPersonality() {
  return readPersonality();
}

interface SliderRowProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}

function SliderRow({ id, label, value, min, max, step, format, onChange }: SliderRowProps) {
  const display = format ? format(value) : value.toFixed(2);
  return (
    <div className="flex flex-col gap-1.5 py-1.5">
      <div className="flex items-center justify-between text-sm">
        <label htmlFor={id} className="font-medium">{label}</label>
        <span className="font-mono text-xs text-muted-foreground" data-testid={`kiwi-slider-${id}-value`}>
          {display}
        </span>
      </div>
      <Slider
        id={id}
        data-testid={`kiwi-slider-${id}`}
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(v) => onChange(v[0])}
      />
    </div>
  );
}

export default function KiwiVoiceSliders() {
  const [voice, setVoice] = useState(() => getBirdVoiceConfig());
  const [personality, setPersonality] = useState(() => readPersonality());

  // Re-read on mount in case another tab changed values.
  useEffect(() => {
    setVoice(getBirdVoiceConfig());
    setPersonality(readPersonality());
  }, []);

  const updateVoice = useCallback((patch: Partial<typeof voice>) => {
    setVoice((prev) => {
      const next = { ...prev, ...patch };
      setBirdVoiceConfig(patch);
      return next;
    });
  }, []);

  const updatePersonality = useCallback((key: keyof typeof PERSONALITY_DEFAULTS, val: number) => {
    setPersonality((prev) => ({ ...prev, [key]: val }));
    try {
      window.localStorage?.setItem(LS_KEYS[key], String(val));
    } catch { /* noop */ }
  }, []);

  const handleTest = useCallback(() => {
    speakLikeBird("Hi Reagan — this is how I sound right now. Let's try one slider at a time.");
  }, []);

  const handleReset = useCallback(() => {
    // Voice → defaults
    setBirdVoiceConfig({ ...BIRD_VOICE_DEFAULTS });
    setVoice({ ...BIRD_VOICE_DEFAULTS });
    // Personality → defaults
    try {
      window.localStorage?.removeItem(LS_KEYS.warmth);
      window.localStorage?.removeItem(LS_KEYS.playfulness);
      window.localStorage?.removeItem(LS_KEYS.brevity);
    } catch { /* noop */ }
    setPersonality({ ...PERSONALITY_DEFAULTS });
  }, []);

  return (
    <Card className="p-4 md:p-5" data-testid="kiwi-voice-sliders">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div>
          <h3 className="text-base font-semibold">🎤 Kiwi voice & personality</h3>
          <p className="text-xs text-muted-foreground">
            Tune how Kiwi sounds and feels. Saves automatically.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTest}
            data-testid="kiwi-sliders-test-btn"
          >
            🔊 Test
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            data-testid="kiwi-sliders-reset-btn"
          >
            Reset
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
        <section>
          <h4 className="text-sm font-medium mb-1 text-amber-700 dark:text-amber-400">Voice</h4>
          <SliderRow
            id="speed" label="Speed"
            value={voice.rate} min={0.7} max={1.6} step={0.02}
            format={(v) => `${v.toFixed(2)}×`}
            onChange={(v) => updateVoice({ rate: v })}
          />
          <SliderRow
            id="pitch" label="Pitch"
            value={voice.pitch} min={0.6} max={2.2} step={0.05}
            onChange={(v) => updateVoice({ pitch: v })}
          />
          <SliderRow
            id="volume" label="Volume"
            value={voice.volume} min={0} max={1} step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => updateVoice({ volume: v })}
          />
        </section>
        <section>
          <h4 className="text-sm font-medium mb-1 text-emerald-700 dark:text-emerald-400">Personality</h4>
          <SliderRow
            id="warmth" label="Warmth"
            value={personality.warmth} min={0} max={1} step={0.05}
            format={(v) => v < 0.34 ? "cool" : v > 0.66 ? "warm" : "balanced"}
            onChange={(v) => updatePersonality("warmth", v)}
          />
          <SliderRow
            id="playfulness" label="Playfulness"
            value={personality.playfulness} min={0} max={1} step={0.05}
            format={(v) => v < 0.34 ? "serious" : v > 0.66 ? "playful" : "balanced"}
            onChange={(v) => updatePersonality("playfulness", v)}
          />
          <SliderRow
            id="brevity" label="Brevity"
            value={personality.brevity} min={0} max={1} step={0.05}
            format={(v) => v < 0.34 ? "fuller" : v > 0.66 ? "very brief" : "balanced"}
            onChange={(v) => updatePersonality("brevity", v)}
          />
        </section>
      </div>
    </Card>
  );
}
