import { createContext, useContext, useState, ReactNode } from "react";

type WhisperMode = "off" | "tap" | "wake" | "always";
type WhisperVoiceMode = "text" | "voice";

interface WhisperState {
  enabled: boolean;
  mode: WhisperMode;
  voiceMode: WhisperVoiceMode;
  adultPresent: boolean;
  open: boolean;
  companionName: string;
  companionAvatar: string;
  setEnabled: (b: boolean) => void;
  setMode: (m: WhisperMode) => void;
  setVoiceMode: (m: WhisperVoiceMode) => void;
  setAdultPresent: (b: boolean) => void;
  setOpen: (b: boolean) => void;
  setCompanionName: (s: string) => void;
  setCompanionAvatar: (s: string) => void;
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
  const [open, setOpen] = useState(false);
  const [companionName, setCompanionNameState] = useState(
    localStorage.getItem("companionName") || "Whisper"
  );
  const [companionAvatar, setCompanionAvatarState] = useState(
    localStorage.getItem("companionAvatar") || "🪶"
  );

  const setCompanionName = (s: string) => { setCompanionNameState(s); localStorage.setItem("companionName", s); };
  const setCompanionAvatar = (s: string) => { setCompanionAvatarState(s); localStorage.setItem("companionAvatar", s); };
  const setModeP = (m: WhisperMode) => { setMode(m); localStorage.setItem("whisperMode", m); };
  const setVoiceModeP = (m: WhisperVoiceMode) => { setVoiceMode(m); localStorage.setItem("whisperVoiceMode", m); };
  const setAdultP = (b: boolean) => { setAdultPresent(b); localStorage.setItem("adultPresent", b ? "1" : "0"); };

  return (
    <Ctx.Provider value={{
      enabled, mode, voiceMode, adultPresent, open, companionName, companionAvatar,
      setEnabled, setMode: setModeP, setVoiceMode: setVoiceModeP, setAdultPresent: setAdultP,
      setOpen, setCompanionName, setCompanionAvatar,
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
