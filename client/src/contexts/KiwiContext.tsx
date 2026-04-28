import { createContext, useContext, useState, ReactNode } from "react";

type KiwiMode = "off" | "tap" | "wake" | "always";
type KiwiVoiceMode = "text" | "voice";

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
  setEnabled: (b: boolean) => void;
  setMode: (m: KiwiMode) => void;
  setVoiceMode: (m: KiwiVoiceMode) => void;
  setAdultPresent: (b: boolean) => void;
  setAdultUnlocked: (b: boolean) => void;
  setOpen: (b: boolean) => void;
  setCompanionName: (s: string) => void;
  setCompanionAvatar: (s: string) => void;
  setPhotoUrl: (s: string | null) => void;
}

const Ctx = createContext<KiwiState | null>(null);

export function KiwiProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(true);
  const [mode, setMode] = useState<KiwiMode>(
    (localStorage.getItem("kiwiMode") as KiwiMode) || "tap"
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

  return (
    <Ctx.Provider value={{
      enabled, mode, voiceMode, adultPresent, adultUnlocked, open, companionName, companionAvatar, photoUrl,
      setEnabled, setMode: setModeP, setVoiceMode: setVoiceModeP,
      setAdultPresent: setAdultP, setAdultUnlocked,
      setOpen, setCompanionName, setCompanionAvatar, setPhotoUrl,
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
