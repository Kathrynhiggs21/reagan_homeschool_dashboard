/**
 * TalkToKiwiButton.tsx — v2.87 (2026-05-21)
 *
 * Mom asked: "Make kiwi voice have a talk to button too." Reagan should be
 * able to TAP one button → speak → Kiwi hears her → Kiwi speaks back.
 *
 * Standing house rules (House Rules + Whisper preferences):
 *   - Click-only — never auto-listens, never auto-opens mic.
 *   - No surprise popup notifications. (Browser permission prompt fires once
 *     on first user-initiated tap; we never trigger it programmatically.)
 *   - Animations stay (Kiwi perch / chirp / fly-around handled by KiwiPerch
 *     and birdVoice.chirp() from the existing code).
 *   - Trauma-safe — no timers, no scolding language, no grey boxes.
 *
 * Implementation:
 *   - Uses Web Speech API `webkitSpeechRecognition` (Chrome/Edge/Safari iOS).
 *   - On unsupported browsers, falls back to a friendly toast — no error.
 *   - Click-to-toggle: first tap starts listening; second tap (or
 *     auto-stop after silence) ends, sends transcript through `kiwi.chat`,
 *     and pipes the reply into `speakLikeBird()` so Reagan hears Kiwi.
 *   - Visible "listening" state (pulsing outline + 🎙️ icon) so kid sees
 *     when the mic is hot.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { speakLikeBird, chirp } from "@/lib/birdVoice";
import { getKiwiPersonality } from "@/components/KiwiVoiceSliders";

interface Props {
  /** Optional — passed through to kiwi.chat so Kiwi can reference the block. */
  currentBlockTitle?: string;
  /** Adult-present mode: Kiwi should be briefer + let the adult lead. */
  adultPresent?: boolean;
  className?: string;
}

// `webkitSpeechRecognition` is non-standard but ubiquitous on Reagan's stack
// (Chrome desktop + iPad Safari 14.1+). We keep the type loose.
type SpeechRecognitionLike = any;

function getRecognitionCtor(): any | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export default function TalkToKiwiButton({
  currentBlockTitle,
  adultPresent = false,
  className,
}: Props) {
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const sentRef = useRef(false); // prevent double-send on duplicate end events

  const chat = trpc.kiwi.chat.useMutation();

  const handleTranscript = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        toast.message("I didn't catch that. Try again?");
        return;
      }
      setThinking(true);
      try {
        const p = getKiwiPersonality();
        const res = await chat.mutateAsync({
          userMessage: trimmed,
          adultPresent,
          currentBlockTitle,
          personalityWarmth: p.warmth,
          personalityPlayfulness: p.playfulness,
          personalityBrevity: p.brevity,
        });
        const reply = (res as any)?.reply;
        if (reply) speakLikeBird(reply);
      } catch (err: any) {
        toast.error(err?.message || "Kiwi couldn't answer just now.");
      } finally {
        setThinking(false);
      }
    },
    [chat, adultPresent, currentBlockTitle],
  );

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      toast.message(
        "This browser doesn't have voice input. Try Chrome or Safari.",
      );
      return;
    }
    if (recRef.current) {
      try { recRef.current.stop(); } catch { /* noop */ }
    }
    sentRef.current = false;
    const rec: SpeechRecognitionLike = new Ctor();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      setListening(true);
      chirp(); // little parakeet "I'm listening" cue
    };
    rec.onresult = (event: any) => {
      const transcript = event?.results?.[0]?.[0]?.transcript ?? "";
      if (sentRef.current) return;
      sentRef.current = true;
      handleTranscript(transcript);
    };
    rec.onerror = (e: any) => {
      // 'no-speech' / 'aborted' aren't errors worth alarming Reagan about.
      const code = e?.error || "unknown";
      if (code !== "no-speech" && code !== "aborted") {
        toast.message("Mic isn't ready. Tap again to try.");
      }
    };
    rec.onend = () => {
      setListening(false);
    };

    try {
      rec.start();
      recRef.current = rec;
    } catch {
      toast.message("Mic isn't ready. Tap again to try.");
    }
  }, [handleTranscript]);

  const stop = useCallback(() => {
    if (!recRef.current) return;
    try {
      recRef.current.stop();
    } catch { /* noop */ }
  }, []);

  const onClick = useCallback(() => {
    if (thinking) return; // Kiwi is composing a reply; ignore taps
    if (listening) {
      stop();
    } else {
      start();
    }
  }, [listening, thinking, start, stop]);

  // Cleanup if the component unmounts mid-listen.
  useEffect(() => {
    return () => {
      try { recRef.current?.stop(); } catch { /* noop */ }
    };
  }, []);

  const label = thinking
    ? "💭 Kiwi is thinking…"
    : listening
      ? "🎙️ Listening… tap to send"
      : "🎤 Talk to Kiwi";

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      onClick={onClick}
      disabled={thinking}
      data-testid="talk-to-kiwi-btn"
      aria-pressed={listening}
      title="Tap once to talk to Kiwi. Tap again when you're done."
      className={
        (className ?? "bg-amber-400 text-amber-950 hover:bg-amber-500 border-0 shadow-[0_4px_0_rgba(0,0,0,0.3)]") +
        (listening ? " ring-2 ring-white animate-pulse" : "")
      }
    >
      {label}
    </Button>
  );
}
