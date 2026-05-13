import { useEffect, useState } from "react";

export type PracticePrefs = {
  ihIxl: boolean;
  khanKids: boolean;
};

// Push 56 (2026-05-13) — bumped key to v2 + flipped ihIxl default OFF.
// Reagan's @ihsd.us SSO is dead, so IXL links must NOT bounce through it
// by default. Adults can still re-enable from PracticePrefsCard if a Madeira
// (or other) school IXL seat is set up. The v1 → v2 key bump quietly resets
// any stale "true" stored in browsers from before this push.
const KEY = "reagan.practicePrefs.v2";
const DEFAULTS: PracticePrefs = { ihIxl: false, khanKids: false };

export function usePracticePrefs() {
  const [prefs, setPrefs] = useState<PracticePrefs>(DEFAULTS);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) setPrefs({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
  }, []);

  function update(next: Partial<PracticePrefs>) {
    setPrefs((prev) => {
      const merged = { ...prev, ...next };
      try {
        window.localStorage.setItem(KEY, JSON.stringify(merged));
      } catch {
        /* ignore */
      }
      return merged;
    });
  }

  return { prefs, update };
}
