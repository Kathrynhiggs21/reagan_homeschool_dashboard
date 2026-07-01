import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useKiwi } from "@/contexts/KiwiContext";
import { trpc } from "@/lib/trpc";
import { Send, Mic, X, Shirt } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import KiwiSprite from "./KiwiSprite";
import FlockSprite, { type FlockMember } from "./FlockSprite";
import { speakLikeBird } from "@/lib/birdVoice";
import { speakAs, getActiveCompanionId, type CompanionId } from "@/lib/companionVoices";
import { transcriptHasWakeWord, extractQuestionAfterWake, transcriptHasStopPhrase } from "@shared/wakeWord";
import KiwiPerch from "./KiwiPerch";
import KiwiQuietListener from "./KiwiQuietListener";
import CompanionBelt from "./CompanionBelt";
import { resolveKiwiDayCharacter } from "@shared/kiwiCharacter";

/**
 * KiwiCompanion is now the SINGLE Kiwi entry point (2026-06-17, Katy:
 * "keep all kiwi things but combine into one kiwi companion piece").
 * It mounts, in one place with no capability lost:
 *   - the roaming/flying animated bird (KiwiPerch)
 *   - the invisible school-day quiet listener (KiwiQuietListener)
 *   - the tap/wake-word chat + voice popup (this component's panel)
 *   - dress-up / flock switching (CompanionBelt) folded inside the popup
 * App.tsx mounts ONLY <KiwiCompanion/> now.
 */
export default function KiwiCompanion() {
  const { open, setOpen, enabled, mode, setMode, voiceMode, setVoiceMode, adultPresent, companionName, setCompanionName, showKiwiPerch } = useKiwi();
  const [input, setInput] = useState("");
  const [muted, setMuted] = useState(false);
  const [showDressUp, setShowDressUp] = useState(false);
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
  async function toggleWakeWord() {
    const next = !wakeWordOn;
    setWakeWordOn(next);
    try { window.localStorage?.setItem("kiwiMicConsent", next ? "1" : "0"); } catch { /* ignore */ }
    if (next) {
      // Turning the always-listening feature ON: make sure the listening loop
      // is in a mic-using mode, voice (TTS) is on so Kiwi talks back, and the
      // browser microphone permission is actually granted. We request the mic
      // here — on a real user gesture — which is the correct moment to prompt,
      // and immediately release the stream (SpeechRecognition reacquires it).
      try { if (mode !== "wake" && mode !== "always") setMode("wake"); } catch { /* ignore */ }
      try { if (voiceMode !== "voice") setVoiceMode("voice"); } catch { /* ignore */ }
      setMuted(false);
      try {
        const stream = await navigator.mediaDevices?.getUserMedia?.({ audio: true });
        stream?.getTracks?.().forEach((t) => t.stop());
      } catch {
        // Permission denied/blocked — reflect that so we don't claim it's on.
        setWakeWordOn(false);
        try { window.localStorage?.setItem("kiwiMicConsent", "0"); } catch { /* ignore */ }
        try { window.dispatchEvent(new CustomEvent("kiwi:wake-word-changed", { detail: { on: false } })); } catch { /* ignore */ }
        alert("To let Kiwi listen for her name, allow microphone access for this site in your browser, then turn this on again.");
        return;
      }
    }
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
  // Today's Kiwi costume from the authoritative server resolver (calendar +
  // holiday + summer/vacation aware). Falls back to a plain everyday resolve.
  const kiwiToday = trpc.kiwi.today.useQuery(undefined, { staleTime: 10 * 60_000 });
  const kiwiDayCostume = useMemo(
    () => (kiwiToday.data ?? resolveKiwiDayCharacter(todayISO, {})).costume,
    [kiwiToday.data, todayISO],
  );

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
  const companionNameRef = useRef<string>(companionName);
  // Conversation state: true once the wake word is heard, meaning subsequent
  // utterances are treated as direct questions (hands-free) WITHOUT needing the
  // wake word again — until a stop phrase or the silence timeout fires.
  const conversingRef = useRef<boolean>(false);
  const silenceTimerRef = useRef<number | null>(null);
  // "Listening" indicator surfaced to the UI (the green dot on the panel header).
  const [activelyListening, setActivelyListening] = useState(false);
  const SILENCE_MS = 15_000; // back to passive wake-word waiting after 15s quiet
  useEffect(() => { sendMsgRef.current = sendMsg.mutate; }, [sendMsg.mutate]);
  useEffect(() => { activeReviewBlockRef.current = activeReviewBlock; }, [activeReviewBlock]);
  useEffect(() => { reviewQuizPayloadRef.current = reviewQuizPayload; }, [reviewQuizPayload]);
  useEffect(() => { companionNameRef.current = companionName; }, [companionName]);
  useEffect(() => {
    // Listen whenever the feature is on (wake OR always mode) and an adult
    // isn't present. We no longer bail when `open` is true: once Reagan wakes
    // Kiwi, the panel opens and we KEEP listening so the chat is hands-free.
    if (!enabled || (mode !== "wake" && mode !== "always") || adultPresent) return;
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

    // Return Kiwi to passive wake-word waiting.
    const endConversation = () => {
      conversingRef.current = false;
      if (silenceTimerRef.current) { window.clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    };
    // (Re)arm the silence countdown; when it elapses Kiwi stops responding
    // freely and waits for the wake word again.
    const armSilence = () => {
      if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = window.setTimeout(() => {
        endConversation();
      }, SILENCE_MS) as unknown as number;
    };

    // Send an utterance to Kiwi as a real question and keep the conversation
    // alive (re-arm the silence timer).
    const ask = (question: string) => {
      if (!question || question.length < 2) return;
      setOpen(true);
      conversingRef.current = true;
      armSilence();
      (sendMsgRef.current as any)?.({
        userMessage: question,
        adultPresent,
        currentBlockType: activeReviewBlockRef.current ? "review" : undefined,
        quizPayload: reviewQuizPayloadRef.current,
      });
    };

    const buildRecognizer = () => {
      r = new SR();
      r.continuous = true;
      r.interimResults = true;
      r.lang = "en-US";
      r.onstart = () => { if (!cancelled) setActivelyListening(true); };
      r.onresult = (e: any) => {
        // Only act on FINAL results so we don't fire on every interim word.
        const last = e.results[e.results.length - 1];
        if (!last || last.isFinal === false) return;
        const rawText = (last[0]?.transcript || "").trim();
        if (!rawText) return;
        const name = companionNameRef.current;
        const now = Date.now();

        // STOP PHRASE: "bye Kiwi" / "stop" → leave conversation, wait for wake.
        if (conversingRef.current && transcriptHasStopPhrase(rawText, name)) {
          endConversation();
          return;
        }

        const hasWake = transcriptHasWakeWord(rawText, name);

        // CASE 1 — already conversing: treat the whole utterance as a question,
        // no wake word needed (hands-free back-and-forth).
        if (conversingRef.current && !hasWake) {
          armSilence();
          ask(extractQuestionAfterWake(rawText, name) || rawText);
          return;
        }

        // CASE 2 — passive: only react to the wake word.
        if (!hasWake) return;
        // Debounce duplicate wake utterances.
        if (now - lastWakeAtRef.current < 1500) return;
        lastWakeAtRef.current = now;

        // Reagan said the wake word. Open the panel + enter conversation mode.
        setOpen(true);
        conversingRef.current = true;
        armSilence();
        const question = extractQuestionAfterWake(rawText, name);
        if (question && question.length >= 2) {
          ask(question);
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
        if (!cancelled) setActivelyListening(false);
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
      setActivelyListening(false);
      if (silenceTimerRef.current) { window.clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
      conversingRef.current = false;
      try { r?.stop(); } catch {}
    };
    // Intentionally NOT depending on `open` or `companionName`: tearing the mic
    // down and rebuilding it on every panel-open or name change would drop the
    // hands-free conversation. The latest name is read via companionNameRef.
  }, [enabled, mode, adultPresent, setOpen]);

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

  // toggleWakeWord / makeRequest / createRequest are retained for behavior and
  // future re-surfacing but are no longer wired to on-panel buttons (2026-07-01
  // declutter). Reference them so lint stays quiet without deleting logic.
  void toggleWakeWord; void makeRequest;

  if (!enabled) return null;

  return (
    <>
      {/* The roaming animated bird + the invisible quiet listener now render
          from inside this single companion, so App.tsx has exactly ONE Kiwi
          mount. Both keep all their original behavior. */}
      {showKiwiPerch && <KiwiPerch />}
      <KiwiQuietListener />

      {/* Panel — decluttered glass card (2026-07-01, Katy). Just Kiwi's face,
          the conversation, one input + send, a close button, and dress-up
          tucked behind a single small button. The old mic/voice/mute/notebook
          cluster and the "Ask Mom for…" chip strip were removed. */}
      {open && (
        <div data-kiwi-companion className="kiwi-glass-panel fixed bottom-6 right-6 z-40 w-[360px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[78vh] flex flex-col no-print">
          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10">
                {activeCompanion === "kiwi" ? (
                  <KiwiSprite pose={adultPresent ? "sleep" : "idle"} size={40} costume={kiwiDayCostume} />
                ) : (
                  <FlockSprite member={activeCompanion as FlockMember} size={40} />
                )}
              </div>
              <div>
                <div className="font-display font-semibold text-base leading-tight text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]">{companionName}</div>
                <div className="text-[10px] text-white/80 flex items-center gap-1">
                  {activelyListening && !adultPresent && (
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
                  )}
                  {adultPresent
                    ? "Resting — adult is here"
                    : activelyListening
                      ? "Listening — say ‘Hey Kiwi’"
                      : "Here for you 💛"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowDressUp((v) => !v)}
                title="Dress up Kiwi"
                aria-pressed={showDressUp}
                className={`glass-control w-8 h-8 flex items-center justify-center ${showDressUp ? "text-pink-200" : ""}`}
              >
                <Shirt className="w-4 h-4"/>
              </button>
              <button
                onClick={() => { setOpen(false); utils.kiwi.history.invalidate(); }}
                title="Close"
                className="glass-control w-8 h-8 flex items-center justify-center"
              >
                <X className="w-4 h-4"/>
              </button>
            </div>
          </div>

          {showDressUp && (
            <div className="px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-white/70 mb-1">Dress up — pick your buddy</div>
              <CompanionBelt size={34} />
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.isLoading && <div className="text-center text-sm text-muted-foreground">Loading...</div>}
            {messages.data?.length === 0 && (
              <div className="text-center text-sm text-white/85 p-6">
                <div className="flex justify-center mb-2"><KiwiSprite pose="chirp" size={80} /></div>
                <div className="font-hand text-lg text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]">Ask me anything.</div>
                <div className="text-xs mt-2 text-white/75">I won't talk back unless you do.</div>
              </div>
            )}
            {messages.data?.slice().reverse().map((m: any) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`kiwi-bubble max-w-[85%] px-3 py-2 text-sm ${
                  m.role === "user" ? "kiwi-bubble--me" : "kiwi-bubble--kiwi"
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {sendMsg.isPending && <div className="text-xs text-white/75 italic">{companionName} is thinking...</div>}
          </div>

          <div className="p-3 flex gap-2 items-end">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={adultPresent ? "Adult here — quiet mode" : "Talk to me..."}
              className="kiwi-input resize-none min-h-[44px] max-h-[120px]"
              rows={1}
              disabled={adultPresent}
            />
            <button onClick={startVoiceInput} disabled={adultPresent} title="Talk" className="glass-control w-11 h-11 flex items-center justify-center shrink-0">
              <Mic className="w-4 h-4"/>
            </button>
            <button onClick={send} disabled={!input.trim() || adultPresent} title="Send" className="glass-control glass-control--primary w-11 h-11 flex items-center justify-center shrink-0">
              <Send className="w-4 h-4"/>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
