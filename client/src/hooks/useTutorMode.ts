/**
 * useTutorMode (push 36 — 2026-05-13)
 *
 * Mom's spec: when a tutor walks in, Mom flips a single toggle and the
 * sidebar collapses to the three pages that matter mid-lesson — Agenda
 * Editor, Curriculum Hub, Notebook — hiding Analytics, Settings, and the
 * Drive Hub link so a non-tech tutor can't wander off. Flipping back
 * restores the full adult sidebar.
 *
 * Persisted server-side via the existing `appSettings` key/value table
 * under `tutor.mode` ("1" = on, "0"/null = off). Allowed in the
 * publicProcedure `prefs.getPublic` allow-list so the kid + tutor
 * sessions can read it without unlocking the adult passcode.
 *
 * No new table, no new procedure, no new column — purely a UI lens
 * over an existing setting key.
 */
import { trpc } from "@/lib/trpc";
import { useCallback } from "react";

const KEY = "tutor.mode";

export function useTutorMode(): {
  /** true when tutor focus mode is currently on. Defaults to false. */
  enabled: boolean;
  /** still resolving the initial server fetch */
  isLoading: boolean;
  /** flip the toggle to on/off; persisted in appSettings + invalidates the query. */
  setEnabled: (next: boolean) => void;
  /** convenience: flip current value */
  toggle: () => void;
} {
  const utils = trpc.useUtils();
  const q = trpc.prefs.getPublic.useQuery({ key: KEY });
  const m = trpc.prefs.set.useMutation({
    onSuccess: () => {
      void utils.prefs.getPublic.invalidate({ key: KEY });
      void utils.prefs.get.invalidate({ key: KEY });
    },
  });

  const enabled = q.data === "1";

  const setEnabled = useCallback(
    (next: boolean) => {
      m.mutate({ key: KEY, value: next ? "1" : "0" });
    },
    [m],
  );

  const toggle = useCallback(() => {
    setEnabled(!enabled);
  }, [enabled, setEnabled]);

  return {
    enabled,
    isLoading: q.isLoading,
    setEnabled,
    toggle,
  };
}
