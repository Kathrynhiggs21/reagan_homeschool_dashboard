import { useState, useEffect, useRef } from "react";
import { useWhisper } from "@/contexts/WhisperContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Send, Mic, X, Volume2, VolumeX, MessageCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

export default function WhisperCompanion() {
  const { open, setOpen, enabled, mode, voiceMode, adultPresent, companionName, companionAvatar, setCompanionName } = useWhisper();
  const [input, setInput] = useState("");
  const [muted, setMuted] = useState(false);
  const [lastInteractionAt, setLastInteractionAt] = useState<number>(Date.now());
  const [proactivePrompted, setProactivePrompted] = useState(false);
  const messages = trpc.whisper.history.useQuery({ limit: 20 });
  const sendMsg = trpc.whisper.chat.useMutation({
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

  // Proactive idle nudge: if no interaction for 12+ minutes and no adult present, gently check in (once)
  useEffect(() => {
    if (!enabled || adultPresent || proactivePrompted) return;
    const t = setInterval(() => {
      const idleMs = Date.now() - lastInteractionAt;
      if (idleMs > 12 * 60 * 1000) {
        setProactivePrompted(true);
        // Send a gentle check-in via the chat (counts as user-initiated to surface a response)
        sendMsg.mutate({
          userMessage: "(silent prompt) Reagan has been quiet for a while. Drop a soft, real check-in — one short sentence. No pressure. Maybe ask about an animal.",
          adultPresent: false,
        });
        if (!open) setOpen(true);
      }
    }, 60 * 1000);
    return () => clearInterval(t);
  }, [enabled, adultPresent, proactivePrompted, lastInteractionAt, open, setOpen]);

  function speak(text: string) {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.02; u.pitch = 1.15; u.volume = 0.9;
    const voices = speechSynthesis.getVoices();
    const preferred = voices.find(v => /samantha|aria|jenny|natural|female/i.test(v.name)) || voices.find(v => v.lang.startsWith("en"));
    if (preferred) u.voice = preferred;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  // Wake word listener (lightweight, browser SpeechRecognition)
  const recognitionRef = useRef<any>(null);
  useEffect(() => {
    if (!enabled || mode !== "wake" || adultPresent || open) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-US";
    r.onresult = (e: any) => {
      const last = e.results[e.results.length - 1];
      const text = (last[0]?.transcript || "").toLowerCase();
      const wake = `hey ${companionName.toLowerCase()}`;
      if (text.includes(wake) || text.includes("hey whisper")) {
        setOpen(true);
      }
    };
    try { r.start(); recognitionRef.current = r; } catch {}
    return () => { try { r.stop(); } catch {} };
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
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 w-16 h-16 rounded-full bg-primary text-primary-foreground shadow-2xl hover:scale-110 transition-transform flex items-center justify-center text-3xl ring-4 ring-primary/20 no-print"
          style={{ boxShadow: "0 10px 30px -5px oklch(0.7 0.12 65 / 0.5)" }}
          data-whisper-launcher
          aria-label={`Open ${companionName}`}
        >
          {adultPresent ? "💤" : companionAvatar}
        </button>
      )}

      {/* Panel */}
      {open && (
        <Card data-whisper-companion className="fixed bottom-6 right-6 z-40 w-[380px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[80vh] flex flex-col shadow-2xl border-2 border-primary/20 no-print">
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{companionAvatar}</span>
              <div>
                <div className="font-display font-semibold text-base leading-tight">{companionName}</div>
                <div className="text-[10px] text-muted-foreground">{adultPresent ? "Resting — adult is here" : "Here for you 💛"}</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => setMuted(m => !m)} title={muted ? "Unmute" : "Mute voice"}>
                {muted ? <VolumeX className="w-4 h-4"/> : <Volume2 className="w-4 h-4"/>}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => { setOpen(false); utils.whisper.history.invalidate(); }}>
                <X className="w-4 h-4"/>
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.isLoading && <div className="text-center text-sm text-muted-foreground">Loading...</div>}
            {messages.data?.length === 0 && (
              <div className="text-center text-sm text-muted-foreground p-6">
                <div className="text-3xl mb-2">{companionAvatar}</div>
                <div className="font-hand text-lg">Hi Whisperer.</div>
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
