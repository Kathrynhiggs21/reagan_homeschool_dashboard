/**
 * v2.18 (2026-05-17) — BlockAdventurePanel
 *
 * Sub-panel mounted inside `ManualBlockRow` whenever the block is tied
 * to an adventure (`block.adventureId` is set). Lets Mom + Grandma
 * inline-edit the adventure's materials list — add a missing rope,
 * remove a borrowed magnifier — without leaving the AgendaEditor.
 *
 * Server slice (v2.18):
 *   - trpc.adventures.get({ id }) → { ..., materials: string[] }
 *   - trpc.adventures.updateMaterials({ id, materials })  ← familyAdmin
 *
 * Reagan can't reach this panel because it's only rendered when an
 * adventure is attached, and the mutation is gated by familyAdmin
 * server-side regardless. Defense-in-depth.
 *
 * UX rules:
 *   - Collapsible, default collapsed (saves vertical space in the row).
 *   - Loading + error states surfaced explicitly (red text on error).
 *   - Optimistic-feeling: after save, we invalidate the `get` cache so
 *     the next render reflects the persisted list.
 *   - Empty list shows a small "No materials yet" hint.
 */

import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface BlockAdventurePanelProps {
  /**
   * Adventure id from `block.adventureId`. When null/undefined the
   * panel returns null and renders nothing — keeps the parent simple.
   */
  adventureId: number | null | undefined;
}

export function BlockAdventurePanel({ adventureId }: BlockAdventurePanelProps) {
  // Short-circuit: no adventure attached → render nothing.
  if (!adventureId) return null;
  return <BlockAdventurePanelInner adventureId={adventureId} />;
}

function BlockAdventurePanelInner({ adventureId }: { adventureId: number }) {
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();

  const { data: adventure, isLoading, error } = trpc.adventures.get.useQuery(
    { id: adventureId },
    { staleTime: 30_000 },
  );

  const updateMaterials = trpc.adventures.updateMaterials.useMutation({
    onSuccess: async () => {
      await utils.adventures.get.invalidate({ id: adventureId });
    },
  });

  // Local edit state — start from the server list, replace on add/remove.
  // We don't use a controlled `materials` prop so users can type without
  // round-tripping every keystroke.
  const serverMaterials = useMemo<string[]>(
    () => (Array.isArray((adventure as any)?.materials) ? (adventure as any).materials : []),
    [adventure],
  );
  const [draft, setDraft] = useState<string[] | null>(null);
  const materials = draft ?? serverMaterials;
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(serverMaterials);

  const [newItem, setNewItem] = useState("");

  function addItem() {
    const v = newItem.trim();
    if (!v) return;
    if (materials.length >= 50) return; // server cap
    setDraft([...materials, v]);
    setNewItem("");
  }

  function removeItem(idx: number) {
    setDraft(materials.filter((_, i) => i !== idx));
  }

  function reset() {
    setDraft(null);
    setNewItem("");
  }

  async function save() {
    if (!dirty) return;
    await updateMaterials.mutateAsync({ id: adventureId, materials: draft! });
    setDraft(null);
  }

  return (
    <div
      data-testid={`block-adventure-panel-${adventureId}`}
      className="mt-2 rounded-md border border-border/40 bg-muted/30 p-2 text-sm"
    >
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="flex w-full items-center justify-between text-left"
        aria-expanded={open}
      >
        <span className="font-medium">
          🎒 Adventure materials
          {!isLoading && !error ? (
            <span className="ml-2 text-muted-foreground">({materials.length})</span>
          ) : null}
        </span>
        <span className="text-muted-foreground">{open ? "▾" : "▸"}</span>
      </button>

      {open ? (
        <div className="mt-2 space-y-2">
          {isLoading ? (
            <div className="text-muted-foreground">Loading…</div>
          ) : error ? (
            <div className="text-red-500" role="alert">
              Couldn't load adventure: {error.message}
            </div>
          ) : (
            <>
              {(adventure as any)?.title ? (
                <div className="text-xs text-muted-foreground">
                  for <span className="font-medium">{(adventure as any).title}</span>
                </div>
              ) : null}
              {materials.length === 0 ? (
                <div className="text-xs text-muted-foreground">No materials yet.</div>
              ) : (
                <ul className="space-y-1">
                  {materials.map((m, idx) => (
                    <li
                      key={`${idx}-${m}`}
                      className="flex items-center justify-between gap-2 rounded bg-background/40 px-2 py-1"
                    >
                      <span className="truncate">{m}</span>
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="text-xs text-red-500 hover:underline"
                        aria-label={`Remove ${m}`}
                        data-testid={`adventure-material-remove-${idx}`}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex items-center gap-2">
                <Input
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  placeholder="Add a material…"
                  className="h-8 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addItem();
                    }
                  }}
                  data-testid="adventure-material-input"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addItem}
                  disabled={!newItem.trim() || materials.length >= 50}
                  data-testid="adventure-material-add"
                >
                  Add
                </Button>
              </div>
              {materials.length >= 50 ? (
                <div className="text-xs text-amber-500">
                  Materials list is full (50 max). Remove one to add another.
                </div>
              ) : null}

              <div className="flex items-center gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  onClick={save}
                  disabled={!dirty || updateMaterials.isPending}
                  data-testid="adventure-material-save"
                >
                  {updateMaterials.isPending ? "Saving…" : "Save"}
                </Button>
                {dirty ? (
                  <Button type="button" size="sm" variant="outline" onClick={reset}>
                    Reset
                  </Button>
                ) : null}
                {updateMaterials.error ? (
                  <span className="text-xs text-red-500">
                    {updateMaterials.error.message}
                  </span>
                ) : null}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
