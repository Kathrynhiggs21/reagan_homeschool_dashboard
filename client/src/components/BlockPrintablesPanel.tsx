/**
 * v2.19 (2026-05-17) — BlockPrintablesPanel
 *
 * Third sub-panel inside `ManualBlockRow` (alongside BlockResourcesPanel
 * and BlockAdventurePanel). Lists daily printables attached to *this*
 * specific block on *this* date and lets Mom + Grandma:
 *   - add a worksheet (title + optional URL + bucket)
 *   - detach a worksheet (keep the row, just unanchor it from this block)
 *   - hard-delete a worksheet (remove it entirely; coins already earned
 *     are intentionally not clawed back)
 *
 * Server slice (v2.19):
 *   - trpc.printables.forBlock          (publicProcedure)
 *   - trpc.printables.attachToBlock     (familyAdminProcedure)
 *   - trpc.printables.detachFromBlock   (familyAdminProcedure)
 *   - trpc.printables.remove            (familyAdminProcedure)
 *
 * Reagan can't reach the mutations even if the panel renders because
 * familyAdmin is enforced server-side.
 *
 * UX rules mirror the v2.15/v2.18 panels for consistency:
 *   - Collapsible, default collapsed.
 *   - Loading + error states surfaced explicitly (red text, role=alert).
 *   - Cache invalidation on every mutation success.
 *   - Empty list shows a small hint.
 *   - Short-circuit: when blockId or date is missing, render nothing.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Bucket = "have_to_do" | "optional" | "extra";

const BUCKET_LABELS: Record<Bucket, string> = {
  have_to_do: "Have-to-do",
  optional: "Optional",
  extra: "Extra",
};

export interface BlockPrintablesPanelProps {
  /** YYYY-MM-DD date the block belongs to. */
  date: string | null | undefined;
  /** Plan-block id (UUID-ish string from `plans.blocks[].id`). */
  blockId: string | null | undefined;
}

export function BlockPrintablesPanel({ date, blockId }: BlockPrintablesPanelProps) {
  if (!date || !blockId) return null;
  return <BlockPrintablesPanelInner date={date} blockId={blockId} />;
}

function BlockPrintablesPanelInner({ date, blockId }: { date: string; blockId: string }) {
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();

  const { data, isLoading, error } = trpc.printables.forBlock.useQuery(
    { date, blockId },
    { staleTime: 15_000 },
  );

  const items = (Array.isArray(data) ? data : []) as Array<{
    id: number;
    title: string;
    bucket: string;
    sourceUrl?: string | null;
  }>;

  const refresh = () => utils.printables.forBlock.invalidate({ date, blockId });

  const attach = trpc.printables.attachToBlock.useMutation({ onSuccess: refresh });
  const detach = trpc.printables.detachFromBlock.useMutation({ onSuccess: refresh });
  const remove = trpc.printables.remove.useMutation({ onSuccess: refresh });

  // Local form state.
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [bucket, setBucket] = useState<Bucket>("have_to_do");

  function reset() {
    setTitle("");
    setUrl("");
    setBucket("have_to_do");
  }

  async function add() {
    const t = title.trim();
    if (!t) return;
    const u = url.trim();
    await attach.mutateAsync({
      date,
      blockId,
      title: t,
      bucket,
      // Only send sourceUrl when user actually typed one — server zod
      // expects a real URL, not an empty string.
      ...(u ? { sourceUrl: u } : {}),
    });
    reset();
  }

  return (
    <div
      data-testid={`block-printables-panel-${blockId}`}
      className="mt-2 rounded-md border border-border/40 bg-muted/30 p-2 text-sm"
    >
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="flex w-full items-center justify-between text-left"
        aria-expanded={open}
      >
        <span className="font-medium">
          🖨 Printables
          {!isLoading && !error ? (
            <span className="ml-2 text-muted-foreground">({items.length})</span>
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
              Couldn't load printables: {error.message}
            </div>
          ) : (
            <>
              {items.length === 0 ? (
                <div className="text-xs text-muted-foreground">
                  No printables attached to this block yet.
                </div>
              ) : (
                <ul className="space-y-1">
                  {items.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-2 rounded bg-background/40 px-2 py-1"
                      data-testid={`printable-row-${p.id}`}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-600">
                          {BUCKET_LABELS[(p.bucket as Bucket) ?? "have_to_do"] ?? p.bucket}
                        </span>
                        <span className="truncate">{p.title}</span>
                        {p.sourceUrl ? (
                          <a
                            href={p.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-500 hover:underline"
                          >
                            open
                          </a>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => detach.mutate({ id: p.id })}
                          className="text-xs text-muted-foreground hover:underline"
                          aria-label={`Detach ${p.title}`}
                          data-testid={`printable-detach-${p.id}`}
                        >
                          Detach
                        </button>
                        <button
                          type="button"
                          onClick={() => remove.mutate({ id: p.id })}
                          className="text-xs text-red-500 hover:underline"
                          aria-label={`Delete ${p.title}`}
                          data-testid={`printable-remove-${p.id}`}
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="grid grid-cols-12 gap-2">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Worksheet title…"
                  className="col-span-5 h-8 text-sm"
                  data-testid="printable-title-input"
                />
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://…"
                  className="col-span-5 h-8 text-sm"
                  data-testid="printable-url-input"
                />
                <select
                  value={bucket}
                  onChange={(e) => setBucket(e.target.value as Bucket)}
                  className="col-span-2 h-8 rounded border border-border/40 bg-background/60 px-2 text-sm"
                  data-testid="printable-bucket-select"
                >
                  <option value="have_to_do">Have-to-do</option>
                  <option value="optional">Optional</option>
                  <option value="extra">Extra</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={add}
                  disabled={!title.trim() || attach.isPending}
                  data-testid="printable-add"
                >
                  {attach.isPending ? "Adding…" : "Add printable"}
                </Button>
                {attach.error ? (
                  <span className="text-xs text-red-500" role="alert">
                    {attach.error.message}
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
