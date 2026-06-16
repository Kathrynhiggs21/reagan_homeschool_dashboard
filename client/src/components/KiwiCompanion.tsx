import { useState, useEffect, useRef, useCallback } from "react";
import { useKiwi } from "@/contexts/KiwiContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Send, Mic, MicOff, X, Volume2, VolumeX, MessageCircle, MessageSquareText } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import KiwiSprite from "./KiwiSprite";
import FlockSprite, { type FlockMember } from "./FlockSprite";
import { speakLikeBird } from "@/lib/birdVoice";
import { speakAs, getActiveCompanionId, type CompanionId } from "@/lib/companionVoices";
import { transcriptHasWakeWord, extractQuestionAfterWake } from "@shared/wakeWord";

export default function KiwiCompanion() {
  const { open, setOpen, enabled, mode, voiceMode, setVoiceMode, adultPresent, companionName, companionAvatar, setCompanionName } = useKiwi();
  const [input, setInput] = useState("");
  const [muted, setMuted] = useState(false);
  const [lastInteractionAt, setLastInteractionAt] = useState<number>(Date.now());
  const [proactivePrompted, setProactivePrompted] = useState(false);
  // Track which flock companion is the "voice" right now. The CompanionBelt
  // dispatches "kiwi:active-companion-changed" so we re-render here.
  const [activeCompanion, setActiveCompanion] = useState<CompanionId>(() => getActiveCompanionId());
  // Wake-word state mirrors localStorage so Reagan can flip it from inside
  // the chat popup without diving into adult Settings.
  const [wakeWordOn, setWakeWordOn] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return window.localStorage?.getItem("kiwiMicConsent") === "1"; } catch { return false; }
  });
  // Quiz persistence: track answer counts from Kiwi's quiz summary messages.
  // When Kiwi says "X out of Y" we extract the score and persist it.
  const [quizPersisted, setQuizPersisted] = useState(false);
  useEffect(() => {
    function onChange(e: Event) {
      const id = (e as CustomEvent).detail?.id as CompanionId | undefined;
      if (id) setActiveCompanion(id);
    }
    function onWakeChange(e: Event) {
      const on = !!(e as CustomEvent).detail?.on;
      setWakeWordOn(on);
    }
    window.addEventListener("kiwi:active-companion-changed", onChange as EventListener);
    window.addEventListener("kiwi:wake-word-changed", onWakeChange as EventListener);
    return () => {
      window.removeEventListener("kiwi:active-companion-changed", onChange as EventListener);
      window.removeEventListener("kiwi:wake-word-changed", onWakeChange as EventListener);
    };
  }, []);
  function toggleWakeWord() {
    const next = !wakeWordOn;
    setWakeWordOn(next);
    try { window.localStorage?.setItem("kiwiMicConsent", next ? "1" : "0"); } catch { /* ignore */ }
    try { window.dispatchEvent(new CustomEvent("kiwi:wake-word-changed", { detail: { on: next } })); } catch { /* ignore */ }
  }
  const messages = trpc.kiwi.history.useQuery({ limit: 20 });
  // Detect active review block for quiz mode using plans.byDate
  const todayISO = new Date().toISOString().slice(0, 10);
  const todayPlanData = trpc.plans.byDate.useQuery({ date: todayISO }, { staleTime: 30000 });
  const activeReviewBlock = (todayPlanData.data?.blocks as any[])?.find(
    (b: any) => b.blockType === 'review' && (b.status === 'in_progress' || b.status === 'not_started')
  ) ?? null;
  // Reset quiz-persisted flag when the review block changes
  const activeReviewBlockId = activeReviewBlock?.id ?? null;
  useEffect(() => { setQuizPersisted(false); }, [activeReviewBlockId]);
  const reviewQuizPayload: string | undefined = activeReviewBlock?.description
    ? (() => { try { const p = JSON.parse(activeReviewBlock.description); return p._type === 'review_block' ? activeReviewBlock.description : undefined; } catch { return undefined; } })()
    : undefined;
  const submitQuizResult = trpc.topicMastery.submitQuizResult.useMutation();

  // Detect quiz completion from Kiwi's summary message.
  // Pattern: "X out of Y" — e.g. "3 out of 4 — solid"
  const detectAndPersistQuiz = useCallback((reply: string) => {
    if (!activeReviewBlock || !reviewQuizPayload || quizPersisted) return;
    const match = reply.match(/\b(\d+)\s+out\s+of\s+(\d+)\b/i);
    if (!match) return;
    const correct = parseInt(match[1], 10);
    const total = parseInt(match[2], 10);
    if (isNaN(correct) || isNaN(total) || total === 0) return;
    const score = Math.round((correct / total) * 100);
    try {
      const quiz = JSON.parse(reviewQuizPayload);
      const topic = quiz.topics?.[0];
      if (!topic) return;
      setQuizPersisted(true);
      submitQuizResult.mutate({
        subjectSlug: topic.subjectSlug,
        topicHandle: topic.topicHandle,
        topicTitle: topic.topicTitle,
        gradeLevel: String(quiz.gradeLevel ?? "5"),
        score,
        totalQuestions: total,
        correctAnswers: correct,
        kiwiQuizLog: { correct, total, reply },
      });
    } catch { /* ignore parse errors */ }
  }, [activeReviewBlock, reviewQuizPayload, quizPersisted, submitQuizResult]);

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
      // Detect quiz completion and persist results
      if (data?.reply) {
        detectAndPersistQuiz(data.reply);
      }
    },
  });
  const utils = trpc.useUtils();

  // (Removed: 12-min proactive auto-open. Per Mom's request, Kiwi never opens
  // herself — only on direct click or wake word.)
  void lastInteractionAt; void proactivePrompted;
  // setLastInteractionAt and setProactivePrompted are still set by sendMsg's onSuccess above.

  // Speaks with the active companion's voice config. Kiwi uses speakLikeBird
  // (chirp + bright/female voice) for back-compat; the others use speakAs.
  function speak(text: string) {
    if (activeCompanion === "kiwi") speakLikeBird(text);
    else speakAs(activeCompanion, text);
  }

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
  // Refs so the wake-word listener (built once per effect run) can reach the
  // latest mutation + active-block values without re-subscribing the mic.
  const lastWakeAtRef = useRef<number>(0);
  const sendMsgRef = useRef<any>(null);
  const activeReviewBlockRef = useRef<any>(null);
  const reviewQuizPayloadRef = useRef<string | undefined>(undefined);
  useEffect(() => { sendMsgRef.current = sendMsg.mutate; }, [sendMsg.mutate]);
  useEffect(() => { activeReviewBlockRef.current = activeReviewBlock; }, [activeReviewBlock]);
  useEffect(() => { reviewQuizPayloadRef.current = reviewQuizPayload; }, [reviewQuizPayload]);
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
        // Only act on FINAL results so we don't fire on every interim word.
        const last = e.results[e.results.length - 1];
        if (!last || last.isFinal === false) return;
        const rawText = (last[0]?.transcript || "").trim();
        if (!rawText) return;
        if (!transcriptHasWakeWord(rawText, companionName)) return;

        // Debounce: ignore if we just handled an identical/utterance recently.
        const now = Date.now();
        if (now - lastWakeAtRef.current < 1500) return;
        lastWakeAtRef.current = now;

        // Reagan said the wake word. Open the panel...
        setOpen(true);
        // ...and if she included a question after the name, send it straight
        // to Kiwi so the answer comes back without a second step.
        const question = extractQuestionAfterWake(rawText, companionName);
        if (question && question.length >= 2) {
          try { r.stop(); } catch {}
          (sendMsgRef.current as any)?.({
            userMessage: question,
            adultPresent,
            currentBlockType: activeReviewBlockRef.current ? "review" : undefined,
            quizPayload: reviewQuizPayloadRef.current,
          });
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

  // Kid-driven "Make a Request" — Reagan picks a kind (assignment, adventure,
  // schedule change, snack, supplies, help) and Kiwi turns the rest of her
  // sentence into a structured studentRequests row that surfaces in Mom's
  // Settings inbox.
  const createRequest = trpc.studentRequests.create.useMutation();
  function send() {
    if (!input.trim()) return;
    (sendMsg.mutate as any)({
      userMessage: input.trim(),
      adultPresent,
      currentBlockType: activeReviewBlock ? 'review' : undefined,
      quizPayload: reviewQuizPayload,
    });
    setInput("");
  }
  function makeRequest(kind: "assignment" | "adventure" | "schedule" | "snack" | "supplies" | "help") {
    const body = input.trim();
    if (!body) {
      setInput(
        kind === "assignment" ? "Can I do this assignment instead: "
          : kind === "adventure" ? "I'd like to try this adventure: "
          : kind === "schedule" ? "Can we change my schedule by: "
          : kind === "snack" ? "I'd love this snack: "
          : kind === "supplies" ? "I need these supplies: "
          : "I need help with: "
      );
      return;
    }
    createRequest.mutate({ kind, body });
    sendMsg.mutate({ userMessage: `Make-a-Request (${kind}): ${body}`, adultPresent });
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
              <div className="w-10 h-10">
                {activeCompanion === "kiwi" ? (
                  <KiwiSprite pose={adultPresent ? "sleep" : "idle"} size={40} />
                ) : (
                  <FlockSprite member={activeCompanion as FlockMember} size={40} />
                )}
              </div>
              <div>
                <div className="font-display font-semibold text-base leading-tight">{companionName}</div>
                <div className="text-[10px] text-muted-foreground">{adultPresent ? "Resting — adult is here" : "Here for you 💛"}</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setVoiceMode(voiceMode === "voice" ? "text" : "voice")}
                title={voiceMode === "voice" ? "Voice mode ON — I talk back out loud. Tap for Text mode." : "Text mode — type and read. Tap for Voice mode (I talk back)."}
                aria-pressed={voiceMode === "voice"}
                data-testid="kiwi-voice-mode-toggle"
                className={`gap-1 px-2 ${voiceMode === "voice" ? "text-sky-500" : "text-muted-foreground"}`}
              >
                {voiceMode === "voice" ? <Volume2 className="w-4 h-4"/> : <MessageSquareText className="w-4 h-4"/>}
                <span className="text-[11px] font-medium">{voiceMode === "voice" ? "Voice" : "Text"}</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleWakeWord}
                title={wakeWordOn ? "Wake word ON — say ‘Hi Kiwi’ to call me" : "Wake word OFF — tap me to talk"}
                className={wakeWordOn ? "text-emerald-500" : "text-muted-foreground"}
              >
                {wakeWordOn ? <Mic className="w-4 h-4"/> : <MicOff className="w-4 h-4"/>}
              </Button>
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
                <div className="font-hand text-lg">Ask me something.</div>
                <div className="text-xs mt-2">Type a question or tap a request below. I won't talk back unless you do.</div>
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

          {!adultPresent && (
            <div className="px-3 pt-2 pb-1 flex flex-wrap gap-1.5 border-t bg-amber-50/40 dark:bg-amber-950/20">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground self-center mr-1">Ask Mom for:</span>
              {([
                ["assignment", "📝 Assignment"],
                ["adventure", "🏕️ Adventure"],
                ["schedule", "⏰ Schedule change"],
                ["snack", "🍪 Snack"],
                ["supplies", "✏️ Supplies"],
                ["help", "🆘 Help"],
              ] as const).map(([kind, label]) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => makeRequest(kind as any)}
                  className="text-[11px] px-2 py-1 rounded-full border border-amber-300 bg-white hover:bg-amber-100 text-amber-900 transition"
                >
                  {label}
                </button>
              ))}
            </div>
          )}
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
