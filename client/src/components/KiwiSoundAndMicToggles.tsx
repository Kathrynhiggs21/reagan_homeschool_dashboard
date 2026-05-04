import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";

/**
 * Three hard-gate toggles for Kiwi audio + microphone wake word + voice mode.
 *
 * Stored in localStorage and read directly by:
 *   - client/src/lib/birdVoice.ts          (silence + cartoon-voice gates)
 *   - client/src/lib/companionVoices.ts    (silence + cartoon-voice gates)
 *   - client/src/components/KiwiCompanion.tsx (mic consent / wake word)
 *
 * Keys (all default to the most natural, parent-friendly setting):
 *  - `kiwiSilent`        : "1" = mute everything.       Default "0" (audible).
 *  - `kiwiCartoonVoice`  : "1" = neural Gemini voice.   Default ON when missing.
 *  - `kiwiMicConsent`    : "1" = allow mic wake word.   Default "0" (off).
 *
 * Wake-word stays opt-in so Chrome never asks for mic on page load unless
 * the adult flips it on.
 */
export default function KiwiSoundAndMicToggles() {
  const [silent, setSilent] = useState<boolean>(false);
  const [cartoonVoice, setCartoonVoice] = useState<boolean>(true);
  const [micConsent, setMicConsent] = useState<boolean>(false);

  useEffect(() => {
    try {
      setSilent(localStorage.getItem("kiwiSilent") === "1");
      const raw = localStorage.getItem("kiwiCartoonVoice");
      setCartoonVoice(raw === null ? true : raw === "1");
      setMicConsent(localStorage.getItem("kiwiMicConsent") === "1");
    } catch {
      /* ignore */
    }
  }, []);

  function toggleSilent(v: boolean) {
    setSilent(v);
    try { localStorage.setItem("kiwiSilent", v ? "1" : "0"); } catch { /* ignore */ }
  }

  function toggleCartoon(v: boolean) {
    setCartoonVoice(v);
    try { localStorage.setItem("kiwiCartoonVoice", v ? "1" : "0"); } catch { /* ignore */ }
  }

  function toggleMic(v: boolean) {
    setMicConsent(v);
    try { localStorage.setItem("kiwiMicConsent", v ? "1" : "0"); } catch { /* ignore */ }
    // Notify any open KiwiCompanion instance to re-evaluate immediately.
    try { window.dispatchEvent(new CustomEvent("kiwi:wake-word-changed", { detail: { on: v } })); } catch { /* ignore */ }
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
          <div className="text-sm font-medium">Natural cartoon voice (Gemini neural TTS)</div>
          <div className="text-xs text-muted-foreground">
            On by default — Kiwi speaks with a warm, real-kid neural voice. Turn off to use the
            built-in browser voice instead (faster, but more robotic).
          </div>
        </div>
        <Switch checked={cartoonVoice} onCheckedChange={toggleCartoon} />
      </div>

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Wake word — &ldquo;Hi Kiwi&rdquo;</div>
          <div className="text-xs text-muted-foreground">
            When off, the site will <strong>not</strong> start the mic on page load —
            no Chrome &ldquo;site is using microphone&rdquo; indicator and no system
            notification sound. Turn this on only if you want Reagan to be able to say
            &ldquo;Hi Kiwi&rdquo; to open the chat hands-free.
          </div>
        </div>
        <Switch checked={micConsent} onCheckedChange={toggleMic} />
      </div>
    </div>
  );
}
