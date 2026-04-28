import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";

/**
 * AdultLockContext — session-level adult unlock.
 * Default passcode is 3918 (stored on profile in DB later; for now a constant).
 * Unlock persists for the tab session only (sessionStorage).
 */

const DEFAULT_PASSCODE = "3918";
const STORAGE_KEY = "reagan_adult_unlocked";
const PASSCODE_KEY = "reagan_adult_passcode"; // allows runtime override from Settings

type AdultLockContextValue = {
  unlocked: boolean;
  unlock: (code: string) => boolean;
  lock: () => void;
  setPasscode: (newCode: string) => void;
  currentPasscode: string;
};

const AdultLockContext = createContext<AdultLockContextValue | undefined>(undefined);

export function AdultLockProvider({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  });
  const [currentPasscode, setCurrentPasscode] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_PASSCODE;
    return localStorage.getItem(PASSCODE_KEY) || DEFAULT_PASSCODE;
  });

  // Keep session state in sync if another tab changes it
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === PASSCODE_KEY && e.newValue) setCurrentPasscode(e.newValue);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const unlock = useCallback(
    (code: string) => {
      if (code.trim() === currentPasscode) {
        setUnlocked(true);
        try {
          sessionStorage.setItem(STORAGE_KEY, "1");
        } catch {
          // ignore
        }
        return true;
      }
      return false;
    },
    [currentPasscode]
  );

  const lock = useCallback(() => {
    setUnlocked(false);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const setPasscode = useCallback((newCode: string) => {
    const clean = newCode.trim();
    if (clean.length < 4) return;
    setCurrentPasscode(clean);
    try {
      localStorage.setItem(PASSCODE_KEY, clean);
    } catch {
      // ignore
    }
  }, []);

  return (
    <AdultLockContext.Provider value={{ unlocked, unlock, lock, setPasscode, currentPasscode }}>
      {children}
    </AdultLockContext.Provider>
  );
}

export function useAdultLock() {
  const ctx = useContext(AdultLockContext);
  if (!ctx) throw new Error("useAdultLock must be used inside AdultLockProvider");
  return ctx;
}
