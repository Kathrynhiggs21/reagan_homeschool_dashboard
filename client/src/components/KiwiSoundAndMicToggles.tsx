import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";

/**
 * Two hard-gate toggles for Kiwi audio + microphone.
 *
 * These are stored in localStorage and read directly by
 * client/src/lib/birdVoice.ts (silence gate) and
 * client/src/components/KiwiCompanion.tsx (mic consent) so they take effect
 * everywhere instantly, without needing a React context.
 *
 *  - `kiwiSilent`:     "1" = no chirp + no TTS.    Defaults to "0" (audible).
 *  - `kiwiMicConsent`: "1" = allow mic wake-word.  Defaults to "0" (off).
 *
 * Sound defaults ON (May 4 fix — silent-default was hiding Kiwi's voice).
 * Microphone consent stays OFF so Chrome never requests mic on page load.
 */
export default function KiwiSoundAndMicToggles() {
  const [silent, setSilent] = useState<boolean>(false);
  const [micConsent, setMicConsent] = useState<boolean>(false);

  useEffect(() => {
    try {
      const s = localStorage.getItem("kiwiSilent");
      // Default to AUDIBLE when the key is missing.
      setSilent(s === "1");
      setMicConsent(localStorage.getItem("kiwiMicConsent") === "1");
    } catch {
      /* ignore */
    }
  }, []);

  function toggleSilent(v: boolean) {
    setSilent(v);
    try {
      localStorage.setItem("kiwiSilent", v ? "1" : "0");
    } catch { /* ignore */ }
  }

  function toggleMic(v: boolean) {
    setMicConsent(v);
    try {
      localStorage.setItem("kiwiMicConsent", v ? "1" : "0");
    } catch { /* ignore */ }
  }

  return (
    <div className="space-y-3 pt-2 border-t">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Silent mode (no chirp, no speech)</div>
          <div className="text-xs text-muted-foreground">
            When on, Kiwi never plays a chirp and never speaks out loud. Default off — Kiwi speaks unless you mute her.
          </div>
        </div>
        <Switch checked={silent} onCheckedChange={toggleSilent} />
      </div>

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Microphone access (for wake word)</div>
          <div className="text-xs text-muted-foreground">
            When off, the site will <strong>not</strong> start the mic on page load —
            no Chrome "site is using microphone" indicator and no system
            notification sound. Turn this on only if you want wake-word to work.
          </div>
        </div>
        <Switch checked={micConsent} onCheckedChange={toggleMic} />
      </div>
    </div>
  );
}
