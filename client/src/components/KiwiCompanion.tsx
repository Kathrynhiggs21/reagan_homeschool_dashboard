import { useState, useEffect, useRef } from "react";
import { useKiwi } from "@/contexts/KiwiContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Send, Mic, X, Volume2, VolumeX, MessageCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import KiwiSprite from "./KiwiSprite";
import { speakLikeBird } from "@/lib/birdVoice";

export default function KiwiCompanion() {
  const { open, setOpen, enabled, mode, voiceMode, adultPresent, companionName, companionAvatar, setCompanionName } = useKiwi();
  const [input, setInput] = useState("");
  const [muted, setMuted] = useState(false);
  const [lastInteractionAt, setLastInteractionAt] = useState<number>(Date.now());
  const [proactivePrompted, setProactivePrompted] = useState(false);
  const messages = trpc.kiwi.history.useQuery({ limit: 20 });
  const sendMsg = trpc.kiwi.chat.useMutation({
    onSuccess: (data: any) => {
      messages.refetch();
      setLastInteractionAt(Date.now());
      setProactivePrompted(false);
      if (data?.nameChange) {
        setCompanionName(data.nameChange);
      }
      if (!muted && voiceMode === "voice" && data?.reply) {
        speak(data.reply);
      }
    },
  });
  const utils = trpc.useUtils();

  // (Removed: 12-min proactive auto-open. Per Mom's request, Kiwi never opens
  // herself — only on direct click or wake word.)
  void lastInteractionAt; void proactivePrompted;
  // setLastInteractionAt and setProactivePrompted are still set by sendMsg's onSuccess above.

  // Kiwi now speaks with a parakeet voice (chirp + higher pitch/rate).
  function speak(text: string) { speakLikeBird(text); }

  // Wake-word listener (browser SpeechRecognition).
  //
  // Three layers of guards to avoid the phantom Chrome "site is using mic"
  // status sound that fires on page load even when the user has the mic
  // blocked at the browser level:
  //
  //   1) Hard opt-in via localStorage `kiwiMicConsent === "1"`.
  //   2) Live check of navigator.permissions.query({ name: "microphone" }) —
  //      if the browser-level permission is `denied`, we never call .start().
  //   3) On `onerror` of "not-allowed" / "service-not-allowed" / "audio-capture",
  //      we do NOT auto-restart — we shut down for the rest of the session.
  //      Auto-restart only fires on benign `no-speech` / natural ends and only
  //      when permission stays `granted`.
  const recognitionRef = useRef<any>(null);
  useEffect(() => {
    if (!enabled || mode !== "wake" || adultPresent || open) return;
    if (typeof window === "undefined") return;
    let consent = false;
    try { consent = window.localStorage?.getItem("kiwiMicConsent") === "1"; } catch { /* no storage */ }
    if (!consent) return;

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    let cancelled = false;
    let permanentlyOff = false; // flipped true on a permission/audio failure; blocks all restarts
    let r: any = null;

    const safeStart = () => {
      if (cancelled || permanentlyOff || !r) return;
      try { r.start(); } catch { /* already running or recently stopped */ }
    };

    const buildRecognizer = () => {
      r = new SR();
      r.continuous = true;
      r.interimResults = true;
      r.lang = "en-US";
      r.onresult = (e: any) => {
        const last = e.results[e.results.length - 1];
        const text = (last[0]?.transcript || "").toLowerCase();
        const name = (companionName || "kiwi").toLowerCase();
        if (
          text.includes(`hi ${name}`) ||
          text.includes(`hey ${name}`) ||
          text.includes(`ok ${name}`) ||
          text.includes(name) ||
          text.includes("hi kiwi") ||
          text.includes("hey kiwi") ||
          text.includes("kiwi")
        ) {
          setOpen(true);
        }
      };
      r.onerror = (e: any) => {
        const k = (e?.error || "").toString();
        // Permission-related errors → hard stop. This is what was causing the
        // phantom Chrome notification sound on every page load when mic was blocked.
        if (
          k === "not-allowed" ||
          k === "service-not-allowed" ||
          k === "audio-capture" ||
          k === "permission-denied"
        ) {
          permanentlyOff = true;
          try { r.stop(); } catch {}
          // Also flip consent off locally so we don't try again next page load.
          try { window.localStorage?.removeItem("kiwiMicConsent"); } catch {}
        }
      };
      r.onend = () => {
        if (cancelled || permanentlyOff) return;
        // Throttle restarts so we don't spin in a tight loop if Chrome keeps
        // ending the session.
        window.setTimeout(safeStart, 600);
      };
      recognitionRef.current = r;
    };

    const tryStartWithPermissionCheck = async () => {
      try {
        const nav: any = navigator;
        if (nav?.permissions?.query) {
          const status = await nav.permissions.query({ name: "microphone" as PermissionName });
          if (status.state === "denied") {
            // Browser-level mic block. Do nothing — do NOT call .start().
            return;
          }
        }
      } catch { /* permissions API not supported — fall through and try */ }
      if (cancelled) return;
      buildRecognizer();
      safeStart();
    };

    tryStartWithPermissionCheck();

    return () => {
      cancelled = true;
      try { r?.stop(); } catch {}
    };
  }, [enabled, mode, adultPresent, open, companionName, setOpen]);

  function send() {
    if (!input.trim()) return;
    sendMsg.mutate({ userMessage: input.trim(), adultPresent });
    setInput("");
  }

  function startVoiceInput() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Voice input needs Chrome or Edge."); return; }
    const r = new SR();
    r.lang = "en-US"; r.interimResults = false;
    r.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      sendMsg.mutate({ userMessage: text, adultPresent });
    };
    try { r.start(); } catch {}
  }

  if (!enabled) return null;

  return (
    <>
      {/* Kiwi's own floating perch (KiwiPerch) now handles opening chat; no separate launcher button needed */}

      {/* Panel */}
      {open && (
        <Card data-kiwi-companion className="fixed bottom-6 right-6 z-40 w-[380px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[80vh] flex flex-col shadow-2xl border-2 border-primary/20 no-print">
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10"><KiwiSprite pose={adultPresent ? "sleep" : "idle"} size={40} /></div>
              <div>
                <div className="font-display font-semibold text-base leading-tight">{companionName}</div>
                <div className="text-[10px] text-muted-foreground">{adultPresent ? "Resting — adult is here" : "Here for you 💛"}</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => setMuted(m => !m)} title={muted ? "Unmute" : "Mute voice"}>
                {muted ? <VolumeX className="w-4 h-4"/> : <Volume2 className="w-4 h-4"/>}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => { setOpen(false); utils.kiwi.history.invalidate(); }}>
                <X className="w-4 h-4"/>
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.isLoading && <div className="text-center text-sm text-muted-foreground">Loading...</div>}
            {messages.data?.length === 0 && (
              <div className="text-center text-sm text-muted-foreground p-6">
                <div className="flex justify-center mb-2"><KiwiSprite pose="chirp" size={80} /></div>
                <div className="font-hand text-lg">Hi Reagan!</div>
                <div className="text-xs mt-2">I'm here whenever. Ask me anything, or just say hi.</div>
              </div>
            )}
            {messages.data?.slice().reverse().map((m: any) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {sendMsg.isPending && <div className="text-xs text-muted-foreground italic">{companionName} is thinking...</div>}
          </div>

          <div className="p-3 border-t flex gap-2 items-end">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={adultPresent ? "Adult here — quiet mode" : "Talk to me..."}
              className="resize-none min-h-[44px] max-h-[120px] rounded-xl"
              rows={1}
              disabled={adultPresent}
            />
            <Button size="icon" variant="outline" onClick={startVoiceInput} disabled={adultPresent} className="bg-card">
              <Mic className="w-4 h-4"/>
            </Button>
            <Button size="icon" onClick={send} disabled={!input.trim() || adultPresent}>
              <Send className="w-4 h-4"/>
            </Button>
          </div>
        </Card>
      )}
    </>
  );
}
