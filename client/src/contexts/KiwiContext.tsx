import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { trpc } from "@/lib/trpc";

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
  // Reagan's profile photo (her + her duck). Falls back to the bundled
  // avatar so the upper-left circle is never empty, even before the
  // profile fetch resolves or on a fresh device. The profile fetch below
  // can still override this if Mom uploads a different photo in Settings.
  const DEFAULT_REAGAN_PHOTO = "/manus-storage/reagan_avatar_d8d25131.png";
  // Guard against stale/placeholder photo values (e.g. the old
  // "https://example.com/reagan.jpg" seed) that would otherwise win over the
  // real bundled avatar. Any non-http(s)/-storage value, or a known
  // placeholder host, is treated as missing so the circle always shows Reagan.
  const sanitizePhoto = (v: string | null | undefined): string => {
    if (!v) return DEFAULT_REAGAN_PHOTO;
    const s = v.trim();
    if (!s) return DEFAULT_REAGAN_PHOTO;
    if (s.includes("example.com")) return DEFAULT_REAGAN_PHOTO;
    if (s.startsWith("/manus-storage/") || s.startsWith("http://") || s.startsWith("https://")) return s;
    return DEFAULT_REAGAN_PHOTO;
  };
  // Heal any stale localStorage value on load so it can't keep shadowing the
  // real photo across reloads.
  try {
    const cached = localStorage.getItem("reaganPhotoUrl");
    if (cached && sanitizePhoto(cached) !== cached) localStorage.setItem("reaganPhotoUrl", sanitizePhoto(cached));
  } catch { /* ignore */ }
  const [photoUrl, setPhotoUrlState] = useState<string | null>(
    sanitizePhoto(localStorage.getItem("reaganPhotoUrl"))
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

  // 2026-05-12 push 15: also mirror to server appSettings so Mom's chosen
  // slider values follow Reagan across devices/browsers. publicProcedure
  // `prefs.set` requires auth, so this only fires for logged-in adults; if
  // the call fails we still keep the localStorage write as the source of
  // truth for the current session.
  // Hooks called once at the top of the provider (Rules of Hooks).
  const trpcUtils = (trpc as any).useUtils?.();
  const prefsSet = (trpc as any).prefs?.set?.useMutation?.({
    retry: false,
    onError: () => {
      // swallow — localStorage already updated, server mirror is best-effort
    },
  });
  const persistLvlServer = (key: string, n: KiwiLevel) => {
    try {
      prefsSet?.mutate?.({ key, value: String(n) });
    } catch {
      // ignore — slider still works locally
    }
  };
  const setAnimationLevel = (n: KiwiLevel) => {
    setAnimationLevelState(n);
    persistLvl("kiwiAnimationLevel", n);
    persistLvlServer("kiwi.animationLevel", n);
  };
  const setTalkLevel = (n: KiwiLevel) => {
    setTalkLevelState(n);
    persistLvl("kiwiTalkLevel", n);
    persistLvlServer("kiwi.talkLevel", n);
  };
  const setFunnyLevel = (n: KiwiLevel) => {
    setFunnyLevelState(n);
    persistLvl("kiwiFunnyLevel", n);
    persistLvlServer("kiwi.funnyLevel", n);
  };

  // 2026-05-12 push 15: on first mount, ask the server for the canonical
  // slider values and overlay them on top of whatever localStorage had.
  // This is what gives Mom's prefs cross-device portability.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 2026-06-17 (Katy): sync Reagan's profile photo/companion FIRST and
      // independently, so it runs even if the prefs router is unavailable.
      try {
        if (trpcUtils?.profile?.get?.fetch) {
          const prof: any = await trpcUtils.profile.get.fetch().catch(() => null);
          if (!cancelled && prof) {
            // Only accept a real (non-placeholder) server photo; otherwise keep the bundled avatar.
            if (prof.photoUrl && sanitizePhoto(prof.photoUrl) === prof.photoUrl) { setPhotoUrlState(prof.photoUrl); try { localStorage.setItem("reaganPhotoUrl", prof.photoUrl); } catch {} }
            if (prof.companionName) { setCompanionNameState(prof.companionName); try { localStorage.setItem("companionName", prof.companionName); } catch {} }
            if (prof.companionAvatar) { setCompanionAvatarState(prof.companionAvatar); try { localStorage.setItem("companionAvatar", prof.companionAvatar); } catch {} }
          }
        }
      } catch { /* ignore */ }
      try {
        if (!trpcUtils?.prefs?.get?.fetch) return;
        const [a, t, f] = await Promise.all([
          trpcUtils.prefs.get.fetch({ key: "kiwi.animationLevel" }).catch(() => null),
          trpcUtils.prefs.get.fetch({ key: "kiwi.talkLevel" }).catch(() => null),
          trpcUtils.prefs.get.fetch({ key: "kiwi.funnyLevel" }).catch(() => null),
        ]);
        if (cancelled) return;
        const clamp = (s: string | null): KiwiLevel | null => {
          if (!s) return null;
          const n = parseInt(s, 10);
          if (Number.isFinite(n) && n >= 0 && n <= 4) return n as KiwiLevel;
          return null;
        };
        const ac = clamp(a);
        const tc = clamp(t);
        const fc = clamp(f);
        if (ac !== null) { setAnimationLevelState(ac); persistLvl("kiwiAnimationLevel", ac); }
        if (tc !== null) { setTalkLevelState(tc); persistLvl("kiwiTalkLevel", tc); }
        if (fc !== null) { setFunnyLevelState(fc); persistLvl("kiwiFunnyLevel", fc); }
      } catch {
        // ignore — local values still work as a fallback
      }
    })();
    return () => { cancelled = true; };
    // run once on mount; the prefs router is auth-gated so this only succeeds for logged-in users
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
