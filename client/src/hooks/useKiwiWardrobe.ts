import { useCallback, useEffect, useState } from "react";
import {
  type Equipped,
  equipItem,
  removeSlot,
  clearAll,
  surpriseMe,
  type WardrobeSlot,
} from "@shared/kiwiWardrobe";

/**
 * useKiwiWardrobe — persists Kiwi's equipped dress-up outfit, saved presets,
 * and the lookbook snapshot gallery in localStorage so she stays dressed across
 * sessions and Reagan's saved looks survive reloads.
 *
 * Keys:
 *   kiwi_outfit_v1        → current Equipped map
 *   kiwi_outfit_savedAt   → ms timestamp the outfit was last saved (for
 *                            "carried over to a new day" opinions)
 *   kiwi_outfit_presets   → named outfit presets [{name, equipped}]
 *   kiwi_lookbook_v1      → saved snapshots [{id, dataUrl, ts, name}]
 */

const OUTFIT_KEY = "kiwi_outfit_v1";
const SAVED_AT_KEY = "kiwi_outfit_savedAt";
const PRESETS_KEY = "kiwi_outfit_presets";
const LOOKBOOK_KEY = "kiwi_lookbook_v1";

export type OutfitPreset = { name: string; equipped: Equipped };
export type LookbookShot = { id: string; dataUrl: string; ts: number; name: string };

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full / unavailable — ignore */
  }
}

export function useKiwiWardrobe() {
  const [equipped, setEquipped] = useState<Equipped>(() => readJSON<Equipped>(OUTFIT_KEY, {}));
  const [presets, setPresets] = useState<OutfitPreset[]>(() =>
    readJSON<OutfitPreset[]>(PRESETS_KEY, []),
  );
  const [lookbook, setLookbook] = useState<LookbookShot[]>(() =>
    readJSON<LookbookShot[]>(LOOKBOOK_KEY, []),
  );

  // Persist the live outfit whenever it changes so the perch picks it up, and
  // broadcast a same-tab event so the live perch sprite refreshes immediately
  // (the native `storage` event only fires in OTHER tabs).
  useEffect(() => {
    writeJSON(OUTFIT_KEY, equipped);
    try {
      window.dispatchEvent(new CustomEvent("kiwi-outfit-changed"));
    } catch {
      /* SSR / no window */
    }
  }, [equipped]);
  useEffect(() => {
    writeJSON(PRESETS_KEY, presets);
  }, [presets]);
  useEffect(() => {
    writeJSON(LOOKBOOK_KEY, lookbook);
  }, [lookbook]);

  const equip = useCallback((id: string) => {
    setEquipped((prev) => equipItem(prev, id));
  }, []);
  const removeBySlot = useCallback((slot: WardrobeSlot) => {
    setEquipped((prev) => removeSlot(prev, slot));
  }, []);
  const takeOffAll = useCallback(() => {
    setEquipped(clearAll());
  }, []);
  const surprise = useCallback(() => {
    setEquipped(surpriseMe(Date.now() & 0xffffffff));
  }, []);
  const saveLook = useCallback(() => {
    writeJSON(SAVED_AT_KEY, Date.now());
  }, []);

  const addPreset = useCallback((name: string) => {
    setPresets((prev) => {
      const filtered = prev.filter((p) => p.name !== name);
      return [...filtered, { name, equipped }];
    });
  }, [equipped]);
  const wearPreset = useCallback((name: string) => {
    setPresets((prev) => {
      const found = prev.find((p) => p.name === name);
      if (found) setEquipped(found.equipped);
      return prev;
    });
  }, []);
  const deletePreset = useCallback((name: string) => {
    setPresets((prev) => prev.filter((p) => p.name !== name));
  }, []);

  const addLookbookShot = useCallback((shot: LookbookShot) => {
    setLookbook((prev) => [shot, ...prev].slice(0, 30));
  }, []);
  const deleteLookbookShot = useCallback((id: string) => {
    setLookbook((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return {
    equipped,
    setEquipped,
    equip,
    removeBySlot,
    takeOffAll,
    surprise,
    saveLook,
    presets,
    addPreset,
    wearPreset,
    deletePreset,
    lookbook,
    addLookbookShot,
    deleteLookbookShot,
  };
}
