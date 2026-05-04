import { useEffect, useRef, useState } from "react";
import { useKiwi } from "@/contexts/KiwiContext";
import { trpc } from "@/lib/trpc";

/**
 * KiwiQuietListener — invisible kid-side mic capture for the Phase 13
 * quiet-listening pipeline.
 *
 * Behavior (per Mom):
 *   * Only runs when:
 *       - Kiwi is enabled
 *       - kiwiListenConsent === "1" in localStorage (Mom turns this on once
 *         in Settings; never auto-prompted)
 *       - browser-level mic permission is "granted" (we never call .start()
 *         on "denied"; this prevents the phantom Chrome notification sound)
 *       - adultPresent === false (the global "adult here" toggle pauses it)
 *       - the wall clock is inside the kid's school-day window
 *         (Mon–Fri, 8:30 AM – 3:00 PM local)
 *   * Records ~10-minute MediaRecorder chunks (configurable via
 *     `kiwiListenChunkSec`), uploads each chunk to S3 via /api/uploads/listen,
 *     then calls trpc.listening.addChunk so the server can transcribe →
 *     summarize → store ONLY the structured JSON (never the raw transcript).
 *   * No UI — the only feedback is a 1-pixel pulsing dot in the bottom-left
 *     of the screen. Reagan's dashboard never reveals what was captured.
 *
 * This component is intentionally defensive: any failure stops the loop
 * silently for the rest of the session and never auto-restarts after a
 * permission error.
 */
const SCHOOL_START_HOUR = 8;     // 8:30 AM
const SCHOOL_START_MIN = 30;
const SCHOOL_END_HOUR = 15;      // 3:00 PM
const DEFAULT_CHUNK_SEC = 600;   // 10 min

function isSchoolDayWindow(now = new Date()) {
  const dow = now.getDay();
  if (dow === 0 || dow === 6) return false;
  const hr = now.getHours();
  const mn = now.getMinutes();
  if (hr < SCHOOL_START_HOUR || (hr === SCHOOL_START_HOUR && mn < SCHOOL_START_MIN)) return false;
  if (hr >= SCHOOL_END_HOUR) return false;
  return true;
}

export default function KiwiQuietListener() {
  const { enabled, adultPresent } = useKiwi();
  const [active, setActive] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunkStartRef = useRef<number>(0);
  const buffersRef = useRef<Blob[]>([]);
  const stoppedForSessionRef = useRef(false);
  const addChunk = trpc.listening.addChunk.useMutation();

  useEffect(() => {
    if (!enabled || adultPresent) { stop(); return; }
    if (stoppedForSessionRef.current) return;
    if (typeof window === "undefined") return;
    let consent = false;
    try { consent = window.localStorage?.getItem("kiwiListenConsent") === "1"; } catch { /* no storage */ }
    if (!consent) return;
    if (!isSchoolDayWindow()) {
      // Re-check every 5 min so we kick in when the window opens.
      const id = window.setInterval(() => { if (isSchoolDayWindow()) start(); }, 5 * 60 * 1000);
      return () => window.clearInterval(id);
    }
    start();
    const tick = window.setInterval(() => {
      if (!isSchoolDayWindow() || adultPresent) stop();
    }, 60 * 1000);
    return () => { window.clearInterval(tick); stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, adultPresent]);

  async function start() {
    if (recRef.current || stoppedForSessionRef.current) return;
    try {
      const nav: any = navigator;
      if (nav?.permissions?.query) {
        try {
          const status = await nav.permissions.query({ name: "microphone" as PermissionName });
          if (status.state === "denied") { stoppedForSessionRef.current = true; return; }
        } catch { /* ignore */ }
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      recRef.current = rec;
      buffersRef.current = [];
      chunkStartRef.current = Date.now();
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) buffersRef.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(buffersRef.current, { type: mime });
        const periodEnd = Date.now();
        const periodStart = chunkStartRef.current;
        buffersRef.current = [];
        if (blob.size > 4096 && isSchoolDayWindow() && !adultPresent) {
          uploadAndPost(blob, periodStart, periodEnd).catch(() => { /* swallow */ });
        }
        // restart for next chunk if still allowed
        if (!stoppedForSessionRef.current && isSchoolDayWindow() && !adultPresent) {
          chunkStartRef.current = Date.now();
          try { rec.start(); setActive(true); } catch { stop(); }
        } else {
          setActive(false);
        }
      };
      rec.start();
      setActive(true);
      // Stop+restart at the chunk boundary
      const chunkSec = parseInt(window.localStorage?.getItem("kiwiListenChunkSec") || "", 10) || DEFAULT_CHUNK_SEC;
      window.setTimeout(() => { try { rec.stop(); } catch {} }, chunkSec * 1000);
    } catch {
      stoppedForSessionRef.current = true;
      setActive(false);
    }
  }

  function stop() {
    try { recRef.current?.stop(); } catch {}
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    recRef.current = null;
    streamRef.current = null;
    setActive(false);
  }

  async function uploadAndPost(blob: Blob, periodStart: number, periodEnd: number) {
    // Convert to base64 data URL and ship via tRPC. We avoid a multipart form
    // endpoint so we don't have to add multer/busboy and so the same auth
    // path that gates everything else gates this too.
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)) as number[]);
    }
    const b64 = btoa(bin);
    const dataUrl = `data:${blob.type};base64,${b64}`;
    const date = new Date(periodStart).toISOString().slice(0, 10);
    addChunk.mutate({ date, periodStart, periodEnd, audioDataUrl: dataUrl });
  }

  if (!active) return null;
  // Tiny ambient indicator only — kid sees nothing meaningful, just the same
  // soft dot Mom can identify if she ever wants to confirm it's working.
  return (
    <div
      title="Kiwi is listening (Mom-only summary)"
      className="fixed bottom-2 left-2 w-1.5 h-1.5 rounded-full bg-emerald-500/70 animate-pulse pointer-events-none z-50 no-print"
    />
  );
}
