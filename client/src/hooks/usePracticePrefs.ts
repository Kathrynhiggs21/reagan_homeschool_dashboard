import { useEffect, useState } from "react";

export type PracticePrefs = {
  ihIxl: boolean;
  khanKids: boolean;
};

const KEY = "reagan.practicePrefs.v1";
const DEFAULTS: PracticePrefs = { ihIxl: true, khanKids: false };

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
