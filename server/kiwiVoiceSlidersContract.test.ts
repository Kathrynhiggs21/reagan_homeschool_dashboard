/**
 * kiwiVoiceSlidersContract.test.ts — v2.87 (2026-05-21)
 *
 * Locks Mom's three asks for Kiwi's voice work:
 *
 *   1. Talk-to-Kiwi mic button — exists, click-only (no auto-listen),
 *      no programmatic mic permission popup, sends transcript through
 *      kiwi.chat, plays reply through speakLikeBird.
 *
 *   2. Faster, brighter child-bird voice defaults (rate ≥ 1.20, pitch ≥ 1.9)
 *      AND voice config is dynamic (reads localStorage on every speak so
 *      slider changes take effect instantly).
 *
 *   3. Expanded sliders panel — speed, pitch, volume, warmth, playfulness,
 *      brevity. Values persist in localStorage. Reset button. Test button.
 *
 *   4. Server side: kiwi.chat accepts the three personality knobs
 *      (warmth/playfulness/brevity) as optional 0..1 numbers and folds
 *      them into the system prompt as a tone-tuning suffix.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROUTERS = path.join(__dirname, "routers.ts");
const TODAY_TSX = path.join(__dirname, "..", "client", "src", "pages", "Today.tsx");
const KIWI_TSX = path.join(__dirname, "..", "client", "src", "pages", "Kiwi.tsx");
const TALK_BTN = path.join(
  __dirname, "..", "client", "src", "components", "TalkToKiwiButton.tsx",
);
const SLIDERS = path.join(
  __dirname, "..", "client", "src", "components", "KiwiVoiceSliders.tsx",
);
const BIRD_VOICE = path.join(__dirname, "..", "client", "src", "lib", "birdVoice.ts");

describe("Kiwi voice & sliders contract (v2.87)", () => {
  describe("birdVoice.ts — faster/brighter defaults + dynamic config", () => {
    const src = fs.readFileSync(BIRD_VOICE, "utf8");

    it("exports BIRD_VOICE_DEFAULTS with rate ≥ 1.20 and pitch ≥ 1.9", () => {
      // The constant block has the literal numbers.
      expect(src).toMatch(/BIRD_VOICE_DEFAULTS\s*=\s*\{[^}]*rate:\s*1\.[2-9][0-9]?/);
      expect(src).toMatch(/BIRD_VOICE_DEFAULTS\s*=\s*\{[^}]*pitch:\s*[12]\.[0-9]+/);
      // Pitch must clear 1.9.
      const m = src.match(/BIRD_VOICE_DEFAULTS\s*=\s*\{[^}]*pitch:\s*([0-9.]+)/);
      expect(m).not.toBeNull();
      expect(parseFloat(m![1])).toBeGreaterThanOrEqual(1.9);
    });

    it("exposes getBirdVoiceConfig + setBirdVoiceConfig (dynamic config)", () => {
      expect(src).toMatch(/export function getBirdVoiceConfig\(\)/);
      expect(src).toMatch(/export function setBirdVoiceConfig\(/);
    });

    it("reads slider overrides from localStorage on every speak (not at module init)", () => {
      // The browser-fallback path uses getBirdVoiceConfig() inside the call.
      const speakWithBrowser = src.slice(src.indexOf("function speakWithBrowser"));
      expect(speakWithBrowser.slice(0, 800)).toContain("getBirdVoiceConfig()");
      // The neural-cartoon path also reads cfg per-call.
      const speakLikeBird = src.slice(src.indexOf("export function speakLikeBird"));
      expect(speakLikeBird.slice(0, 1200)).toContain("getBirdVoiceConfig()");
    });

    it("applies playbackRate to the neural HTMLAudioElement so the speed slider feels live", () => {
      expect(src).toMatch(/audio\.playbackRate\s*=\s*Math\.max\(/);
    });

    it("respects the kiwiSilent gate (no surprise audio)", () => {
      expect(src).toContain('localStorage?.getItem("kiwiSilent")');
    });
  });

  describe("TalkToKiwiButton — click-only mic, no auto-listen, no popup", () => {
    const src = fs.readFileSync(TALK_BTN, "utf8");

    it("only constructs SpeechRecognition inside the click handler (no auto-start)", () => {
      // The component must NOT call rec.start() outside a callback.
      // Easiest contract: SpeechRecognition is referenced via getRecognitionCtor
      // and only inside the `start` callback, never in a useEffect that fires
      // on mount unconditionally.
      expect(src).toMatch(/function start\b|const start = useCallback/);
      // No mount-time start: there should be no `useEffect(() => { start(); }`
      expect(src).not.toMatch(/useEffect\(\s*\(\)\s*=>\s*\{\s*start\(/);
      // The browser permission prompt is unavoidable on first .start(),
      // but we don't pre-emptively call getUserMedia / permissions.query.
      expect(src).not.toContain("navigator.mediaDevices.getUserMedia");
      expect(src).not.toContain("navigator.permissions.query");
    });

    it("calls kiwi.chat and pipes the reply into speakLikeBird", () => {
      expect(src).toMatch(/trpc\.kiwi\.chat\.useMutation/);
      expect(src).toMatch(/speakLikeBird\(reply\)/);
    });

    it("forwards personality slider values from localStorage", () => {
      expect(src).toContain("getKiwiPersonality()");
      expect(src).toMatch(/personalityWarmth:\s*p\.warmth/);
      expect(src).toMatch(/personalityPlayfulness:\s*p\.playfulness/);
      expect(src).toMatch(/personalityBrevity:\s*p\.brevity/);
    });

    it("falls back gracefully when the browser doesn't support SpeechRecognition", () => {
      // We toast a message instead of throwing.
      expect(src).toMatch(/Ctor\s*=\s*getRecognitionCtor\(\)/);
      expect(src).toMatch(/if\s*\(!Ctor\)/);
    });

    it("carries the talk-to-kiwi-btn testid", () => {
      expect(src).toContain('data-testid="talk-to-kiwi-btn"');
    });
  });

  describe("Today header mounts both buttons (Print + Talk)", () => {
    const src = fs.readFileSync(TODAY_TSX, "utf8");
    it("imports + mounts <TalkToKiwiButton/>", () => {
      expect(src).toMatch(
        /import\s+TalkToKiwiButton\s+from\s+["']@\/components\/TalkToKiwiButton["']/,
      );
      expect(src).toMatch(/<TalkToKiwiButton\s*\/>/);
    });
    it("imports + mounts <PrintAgendaButton/>", () => {
      expect(src).toMatch(
        /import\s+PrintAgendaButton\s+from\s+["']@\/components\/PrintAgendaButton["']/,
      );
      expect(src).toMatch(/<PrintAgendaButton\s+forDate=\{todayDate\}\s*\/>/);
    });
  });

  describe("KiwiVoiceSliders — 6 sliders, persist, reset, test", () => {
    const src = fs.readFileSync(SLIDERS, "utf8");

    it("renders all six sliders with stable testids", () => {
      for (const id of ["speed", "pitch", "volume", "warmth", "playfulness", "brevity"]) {
        expect(src).toContain(`id="${id}"`);
      }
    });

    it("persists voice sliders via setBirdVoiceConfig + personality keys via localStorage", () => {
      expect(src).toContain("setBirdVoiceConfig(");
      expect(src).toContain("kiwiPersonalityWarmth");
      expect(src).toContain("kiwiPersonalityPlayfulness");
      expect(src).toContain("kiwiPersonalityBrevity");
    });

    it("Test button speaks a sample line through the live config", () => {
      expect(src).toContain('data-testid="kiwi-sliders-test-btn"');
      expect(src).toMatch(/speakLikeBird\(/);
    });

    it("Reset button clears voice + personality keys back to defaults", () => {
      expect(src).toContain('data-testid="kiwi-sliders-reset-btn"');
      expect(src).toMatch(/setBirdVoiceConfig\(\{\s*\.\.\.BIRD_VOICE_DEFAULTS\s*\}\)/);
      expect(src).toMatch(/removeItem\(LS_KEYS\.warmth\)/);
    });

    it("exports getKiwiPersonality so other components can read the values", () => {
      expect(src).toMatch(/export function getKiwiPersonality\(\)/);
    });
  });

  describe("Kiwi page mounts the sliders panel", () => {
    const src = fs.readFileSync(KIWI_TSX, "utf8");
    it("imports + renders <KiwiVoiceSliders/>", () => {
      expect(src).toMatch(
        /import\s+KiwiVoiceSliders\s+from\s+["']@\/components\/KiwiVoiceSliders["']/,
      );
      expect(src).toMatch(/<KiwiVoiceSliders\s*\/>/);
    });
  });

  describe("Server: kiwi.chat accepts personality knobs + folds them into prompt", () => {
    const src = fs.readFileSync(ROUTERS, "utf8");
    it("declares the three optional 0..1 fields on kiwi.chat input", () => {
      const i = src.indexOf("chat: publicProcedure.input(z.object({\n      userMessage: z.string()");
      expect(i).toBeGreaterThan(-1);
      const block = src.slice(i, i + 1500);
      expect(block).toMatch(/personalityWarmth:\s*z\.number\(\)\.min\(0\)\.max\(1\)\.optional\(\)/);
      expect(block).toMatch(/personalityPlayfulness:\s*z\.number\(\)\.min\(0\)\.max\(1\)\.optional\(\)/);
      expect(block).toMatch(/personalityBrevity:\s*z\.number\(\)\.min\(0\)\.max\(1\)\.optional\(\)/);
    });

    it("appends a tone-tuning suffix to the system prompt instead of the raw one", () => {
      expect(src).toContain("TONE TUNING (from Mom's sliders)");
      expect(src).toMatch(/const tunedSystemPrompt = systemPrompt \+ tone/);
      // The invokeLLM call must use tunedSystemPrompt, not the raw systemPrompt.
      // Anchor inside the kiwi.chat handler so we skip unrelated invokeLLM calls.
      const kiwiChatStart = src.indexOf("chat: publicProcedure.input(z.object({\n      userMessage: z.string()");
      expect(kiwiChatStart).toBeGreaterThan(-1);
      // Look at a generous window after kiwi.chat starts; the invokeLLM call
      // is in the same handler.
      const kiwiChatBlock = src.slice(kiwiChatStart, kiwiChatStart + 8000);
      expect(kiwiChatBlock).toContain("tunedSystemPrompt");
      expect(kiwiChatBlock).toContain("invokeLLM");
      // Find the line where systemPrompt is referenced in the messages array
      // — it must be the tuned one. Specifically: the first occurrence after
      // the tuning block of the literal string `content: tunedSystemPrompt`.
      expect(kiwiChatBlock).toMatch(/content:\s*tunedSystemPrompt/);
    });
  });
});
