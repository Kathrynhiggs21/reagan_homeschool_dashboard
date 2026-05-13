/**
 * Push 87 (2026-05-13) — Tap-block inline edit (start time + duration only).
 *
 * Adult-only. Reagan's session never sees the pencil button because
 * `blocks.canInlineEdit` returns { allowed: false } for her. Server-side
 * `blocks.update` is also gated by `familyAdminProcedure`, so this is a
 * defense-in-depth pattern (UI hide + server reject).
 *
 * Limited to startTime + durationMin per the locked spec — content edits
 * still happen through the AI Agenda Editor.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";

interface Props {
  blockId: number;
  startTime: string | null;
  durationMin: number;
  onSaved?: () => void;
}

export function TapEditPopover({ blockId, startTime, durationMin, onSaved }: Props) {
  const { data: gate } = trpc.blocks.canInlineEdit.useQuery();
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState<string>(startTime ?? "");
  const [mins, setMins] = useState<number>(durationMin || 30);
  const [saving, setSaving] = useState(false);
  const utils = trpc.useUtils();
  const mut = trpc.blocks.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.blocks.list.invalidate(),
        utils.today.coverageWithActuals.invalidate().catch(() => undefined),
        utils.today.coverage.invalidate().catch(() => undefined),
      ]);
      setOpen(false);
      onSaved?.();
    },
  });

  if (!gate?.allowed) return null;

  async function save() {
    setSaving(true);
    try {
      const patch: { id: number; startTime?: string | null; durationMin?: number } = { id: blockId };
      if (time && /^\d{1,2}:\d{2}$/.test(time)) patch.startTime = time;
      if (mins > 0 && mins <= 240) patch.durationMin = mins;
      await mut.mutateAsync(patch);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        data-testid={`tap-edit-pencil-${blockId}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-50/70 text-xs text-amber-700 hover:bg-amber-100"
        aria-label="Tap-edit block time"
        title="Edit start time + duration"
      >
        ✎
      </button>
    );
  }

  return (
    <div
      data-testid={`tap-edit-popover-${blockId}`}
      className="ml-2 inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/95 px-2 py-1 text-xs shadow-sm"
      onClick={(e) => e.stopPropagation()}
    >
      <label className="flex items-center gap-1">
        <span className="text-amber-900/80">Start</span>
        <input
          type="time"
          data-testid={`tap-edit-start-${blockId}`}
          className="rounded border border-amber-300 bg-white px-1 py-0.5 text-xs text-amber-900"
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
      </label>
      <label className="flex items-center gap-1">
        <span className="text-amber-900/80">Min</span>
        <input
          type="number"
          min={5}
          max={240}
          step={5}
          data-testid={`tap-edit-mins-${blockId}`}
          className="w-14 rounded border border-amber-300 bg-white px-1 py-0.5 text-xs text-amber-900"
          value={mins}
          onChange={(e) => setMins(Math.max(5, Math.min(240, Number(e.target.value) || 0)))}
        />
      </label>
      <button
        type="button"
        data-testid={`tap-edit-save-${blockId}`}
        disabled={saving}
        onClick={save}
        className="rounded-md bg-emerald-600 px-2 py-0.5 text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {saving ? "…" : "Save"}
      </button>
      <button
        type="button"
        data-testid={`tap-edit-cancel-${blockId}`}
        onClick={() => setOpen(false)}
        className="rounded-md bg-stone-100 px-2 py-0.5 text-stone-700 hover:bg-stone-200"
      >
        Cancel
      </button>
    </div>
  );
}
