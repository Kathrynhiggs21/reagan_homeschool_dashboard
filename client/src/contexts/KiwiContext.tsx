import { createContext, useContext, useState, ReactNode } from "react";

type KiwiMode = "off" | "tap" | "wake" | "always";
type KiwiVoiceMode = "text" | "voice";

/** Behavioral sliders for Kiwi (0=off, 1=calm, 2=normal, 3=lively, 4=max).
 *  Persisted to localStorage so we don't need a schema migration; consumed
 *  by KiwiCompanion / KiwiPerch / KiwiQuietListener to gate animations,
 *  talk frequency, and humor injections. */
export type KiwiLevel = 0 | 1 | 2 | 3 | 4;

interface KiwiState {
  enabled: boolean;
  mode: KiwiMode;
  voiceMode: KiwiVoiceMode;
  adultPresent: boolean;
  /** Adult-unlocked means the 3918 passcode was entered this session.
   *  This is the REAL gate for adult-only pages & controls. */
  adultUnlocked: boolean;
  open: boolean;
  companionName: string;
  companionAvatar: string;
  photoUrl: string | null;
  /** New 2026-05-05: behavior sliders (adult-controlled in Settings). */
  animationLevel: KiwiLevel;
  talkLevel: KiwiLevel;
  funnyLevel: KiwiLevel;
  /** New 2026-05-05: per-object visibility toggles. Default: flock OFF. */
  showSidebarFlock: boolean;
  showKiwiPerch: boolean;
  showQuickAddFab: boolean;
  showNotebookDrawer: boolean;
  setEnabled: (b: boolean) => void;
  setMode: (m: KiwiMode) => void;
  setVoiceMode: (m: KiwiVoiceMode) => void;
  setAdultPresent: (b: boolean) => void;
  setAdultUnlocked: (b: boolean) => void;
  setOpen: (b: boolean) => void;
  setCompanionName: (s: string) => void;
  setCompanionAvatar: (s: string) => void;
  setPhotoUrl: (s: string | null) => void;
  setAnimationLevel: (n: KiwiLevel) => void;
  setTalkLevel: (n: KiwiLevel) => void;
  setFunnyLevel: (n: KiwiLevel) => void;
  setShowSidebarFlock: (b: boolean) => void;
  setShowKiwiPerch: (b: boolean) => void;
  setShowQuickAddFab: (b: boolean) => void;
  setShowNotebookDrawer: (b: boolean) => void;
}

const Ctx = createContext<KiwiState | null>(null);

export function KiwiProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(true);
  // Default to "off" so that nothing prompts Chrome to request microphone
  // access on first load. Mom can flip this to wake/tap/always in Settings.
  const [mode, setMode] = useState<KiwiMode>(
    (localStorage.getItem("kiwiMode") as KiwiMode) || "off"
  );
  const [voiceMode, setVoiceMode] = useState<KiwiVoiceMode>(
    (localStorage.getItem("kiwiVoiceMode") as KiwiVoiceMode) || "text"
  );
  const [adultPresent, setAdultPresent] = useState(
    localStorage.getItem("adultPresent") === "1"
  );
  // Adult-unlocked uses sessionStorage so it resets when the tab closes.
  const [adultUnlocked, setAdultUnlockedState] = useState(
    sessionStorage.getItem("adultUnlocked") === "1"
  );
  const [open, setOpen] = useState(false);
  const [companionName, setCompanionNameState] = useState(
    localStorage.getItem("companionName") || "Kiwi"
  );
  const [companionAvatar, setCompanionAvatarState] = useState(
    localStorage.getItem("companionAvatar") || "⭐"
  );
  const [photoUrl, setPhotoUrlState] = useState<string | null>(
    localStorage.getItem("reaganPhotoUrl") || null
  );

  // Behavior sliders — clamp to 0..4. Defaults: animation lively, talk
  // normal, funny normal — matches the previous "always-lively" Kiwi feel.
  const readLvl = (k: string, d: KiwiLevel): KiwiLevel => {
    const n = parseInt(localStorage.getItem(k) || "", 10);
    if (Number.isFinite(n) && n >= 0 && n <= 4) return n as KiwiLevel;
    return d;
  };
  const [animationLevel, setAnimationLevelState] = useState<KiwiLevel>(readLvl("kiwiAnimationLevel", 3));
  const [talkLevel, setTalkLevelState] = useState<KiwiLevel>(readLvl("kiwiTalkLevel", 2));
  const [funnyLevel, setFunnyLevelState] = useState<KiwiLevel>(readLvl("kiwiFunnyLevel", 2));

  // Per-object visibility — sidebar flock is OFF by default per Mom's
  // request 2026-05-05 ("don't want sprites in sidebar"). Other objects
  // remain ON so the dashboard still feels alive out of the box.
  const readBool = (k: string, d: boolean): boolean => {
    const v = localStorage.getItem(k);
    if (v === "1") return true;
    if (v === "0") return false;
    return d;
  };
  const [showSidebarFlock, setShowSidebarFlockState] = useState<boolean>(readBool("showSidebarFlock", false));
  const [showKiwiPerch, setShowKiwiPerchState] = useState<boolean>(readBool("showKiwiPerch", true));
  const [showQuickAddFab, setShowQuickAddFabState] = useState<boolean>(readBool("showQuickAddFab", true));
  const [showNotebookDrawer, setShowNotebookDrawerState] = useState<boolean>(readBool("showNotebookDrawer", true));

  const setCompanionName = (s: string) => { setCompanionNameState(s); localStorage.setItem("companionName", s); };
  const setCompanionAvatar = (s: string) => { setCompanionAvatarState(s); localStorage.setItem("companionAvatar", s); };
  const setPhotoUrl = (s: string | null) => {
    setPhotoUrlState(s);
    if (s) localStorage.setItem("reaganPhotoUrl", s);
    else localStorage.removeItem("reaganPhotoUrl");
  };
  const setModeP = (m: KiwiMode) => { setMode(m); localStorage.setItem("kiwiMode", m); };
  const setVoiceModeP = (m: KiwiVoiceMode) => { setVoiceMode(m); localStorage.setItem("kiwiVoiceMode", m); };
  const setAdultP = (b: boolean) => { setAdultPresent(b); localStorage.setItem("adultPresent", b ? "1" : "0"); };
  const setAdultUnlocked = (b: boolean) => {
    setAdultUnlockedState(b);
    if (b) sessionStorage.setItem("adultUnlocked", "1");
    else sessionStorage.removeItem("adultUnlocked");
  };
  const persistLvl = (k: string, n: KiwiLevel) => { try { localStorage.setItem(k, String(n)); } catch {} };
  const setAnimationLevel = (n: KiwiLevel) => { setAnimationLevelState(n); persistLvl("kiwiAnimationLevel", n); };
  const setTalkLevel = (n: KiwiLevel) => { setTalkLevelState(n); persistLvl("kiwiTalkLevel", n); };
  const setFunnyLevel = (n: KiwiLevel) => { setFunnyLevelState(n); persistLvl("kiwiFunnyLevel", n); };
  const persistBool = (k: string, b: boolean) => { try { localStorage.setItem(k, b ? "1" : "0"); } catch {} };
  const setShowSidebarFlock = (b: boolean) => { setShowSidebarFlockState(b); persistBool("showSidebarFlock", b); };
  const setShowKiwiPerch = (b: boolean) => { setShowKiwiPerchState(b); persistBool("showKiwiPerch", b); };
  const setShowQuickAddFab = (b: boolean) => { setShowQuickAddFabState(b); persistBool("showQuickAddFab", b); };
  const setShowNotebookDrawer = (b: boolean) => { setShowNotebookDrawerState(b); persistBool("showNotebookDrawer", b); };

  return (
    <Ctx.Provider value={{
      enabled, mode, voiceMode, adultPresent, adultUnlocked, open, companionName, companionAvatar, photoUrl,
      animationLevel, talkLevel, funnyLevel,
      showSidebarFlock, showKiwiPerch, showQuickAddFab, showNotebookDrawer,
      setEnabled, setMode: setModeP, setVoiceMode: setVoiceModeP,
      setAdultPresent: setAdultP, setAdultUnlocked,
      setOpen, setCompanionName, setCompanionAvatar, setPhotoUrl,
      setAnimationLevel, setTalkLevel, setFunnyLevel,
      setShowSidebarFlock, setShowKiwiPerch, setShowQuickAddFab, setShowNotebookDrawer,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useKiwi() {
  const v = useContext(Ctx);
  if (!v) throw new Error("KiwiProvider missing");
  return v;
}
