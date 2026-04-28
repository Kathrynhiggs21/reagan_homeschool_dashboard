import { createContext, useContext, useState, ReactNode } from "react";

type WhisperMode = "off" | "tap" | "wake" | "always";
type WhisperVoiceMode = "text" | "voice";

interface WhisperState {
  enabled: boolean;
  mode: WhisperMode;
  voiceMode: WhisperVoiceMode;
  adultPresent: boolean;
  /** Adult-unlocked means the 3918 passcode was entered this session.
   *  This is the REAL gate for adult-only pages & controls. */
  adultUnlocked: boolean;
  open: boolean;
  companionName: string;
  companionAvatar: string;
  photoUrl: string | null;
  setEnabled: (b: boolean) => void;
  setMode: (m: WhisperMode) => void;
  setVoiceMode: (m: WhisperVoiceMode) => void;
  setAdultPresent: (b: boolean) => void;
  setAdultUnlocked: (b: boolean) => void;
  setOpen: (b: boolean) => void;
  setCompanionName: (s: string) => void;
  setCompanionAvatar: (s: string) => void;
  setPhotoUrl: (s: string | null) => void;
}

const Ctx = createContext<WhisperState | null>(null);

export function WhisperProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(true);
  const [mode, setMode] = useState<WhisperMode>(
    (localStorage.getItem("whisperMode") as WhisperMode) || "wake"
  );
  const [voiceMode, setVoiceMode] = useState<WhisperVoiceMode>(
    (localStorage.getItem("whisperVoiceMode") as WhisperVoiceMode) || "text"
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
    localStorage.getItem("companionName") || "Whisper"
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
  const setModeP = (m: WhisperMode) => { setMode(m); localStorage.setItem("whisperMode", m); };
  const setVoiceModeP = (m: WhisperVoiceMode) => { setVoiceMode(m); localStorage.setItem("whisperVoiceMode", m); };
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

export function useWhisper() {
  const v = useContext(Ctx);
  if (!v) throw new Error("WhisperProvider missing");
  return v;
}
