/**
 * BlockResourcesPanel — v2.15 (2026-05-17)
 *
 * Adult-side AgendaEditor sub-panel for managing the materials/links/printables
 * attached to a curriculum topic. Mounted under each ManualBlockRow in
 * AgendaEditor.tsx whenever the block has a curriculumTopicCode set.
 *
 * Wiring:
 *   topicCode (e.g. "M.5.A.1")
 *     ↓ trpc.curriculum.topicByCode  → topicId (number)
 *     ↓ trpc.curriculum.rollup        → { resources, blocks }
 *     ↑ trpc.curriculum.addResource   ← form submit
 *     ↑ trpc.curriculum.removeResource ← per-row remove button
 *
 * Behavior:
 *  - Renders nothing if topicCode is null/empty (no topic to attach to).
 *  - Collapsible with a "📎 Resources (N)" toggle so the editor row stays compact.
 *  - On add/remove success, invalidates the rollup so the list re-renders.
 *  - Defensive: addResource is gated until kind+title are non-empty.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const KIND_OPTIONS = ["worksheet", "video", "lesson", "reading", "printable", "link"] as const;
type Kind = (typeof KIND_OPTIONS)[number];

const KIND_BADGE: Record<Kind, string> = {
  worksheet: "📝",
  video: "🎬",
  lesson: "📚",
  reading: "📖",
  printable: "🖨️",
  link: "🔗",
};

export function BlockResourcesPanel({ topicCode }: { topicCode: string | null | undefined }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("link");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");

  const utils = trpc.useUtils();

  // Resolve topic code → numeric id.
  const topicByCode = trpc.curriculum.topicByCode.useQuery(
    { code: topicCode ?? "" },
    { enabled: !!topicCode }
  );
  const topicId = topicByCode.data?.id ?? null;

  // Pull resources via the rollup procedure (returns { resources, blocks }).
  const rollup = trpc.curriculum.rollup.useQuery(
    { topicId: topicId as number },
    { enabled: typeof topicId === "number" && topicId > 0 }
  );

  const resources: Array<{ id: number; kind: string; title: string; url: string | null }> =
    (rollup.data?.resources ?? []) as any[];

  const addResource = trpc.curriculum.addResource.useMutation({
    onSuccess: async () => {
      setTitle("");
      setUrl("");
      if (typeof topicId === "number") {
        await utils.curriculum.rollup.invalidate({ topicId });
      }
      toast.success("Resource added");
    },
    onError: (err) => toast.error(err.message || "Could not add resource"),
  });

  const removeResource = trpc.curriculum.removeResource.useMutation({
    onSuccess: async () => {
      if (typeof topicId === "number") {
        await utils.curriculum.rollup.invalidate({ topicId });
      }
      toast.success("Resource removed");
    },
    onError: (err) => toast.error(err.message || "Could not remove resource"),
  });

  // Render nothing when there's no topic to anchor to.
  if (!topicCode) return null;

  const count = resources.length;
  const disabled = !topicId || addResource.isPending || !title.trim();

  return (
    <div
      className="mt-1 rounded border border-border/40 bg-muted/20"
      data-testid={`block-resources-panel-${topicCode}`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
      >
        <span>📎</span>
        <span>Resources{count > 0 ? ` (${count})` : ""}</span>
        <span className="ml-auto opacity-60">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="space-y-2 border-t border-border/40 px-2 py-2">
          {/* Existing resources list */}
          {topicByCode.isError ? (
            <p className="text-[11px] text-red-500">
              Could not look up topic <code>{topicCode}</code>: {topicByCode.error?.message ?? "unknown error"}
            </p>
          ) : rollup.isError ? (
            <p className="text-[11px] text-red-500">
              Could not load resources: {rollup.error?.message ?? "unknown error"}
            </p>
          ) : topicByCode.isLoading || rollup.isLoading ? (
            <p className="text-[11px] text-muted-foreground">Loading…</p>
          ) : !topicId ? (
            <p className="text-[11px] text-muted-foreground">
              Topic <code>{topicCode}</code> not in catalog yet.
            </p>
          ) : resources.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              No materials attached yet — add one below.
            </p>
          ) : (
            <ul className="space-y-1">
              {resources.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-2 text-[11px]"
                  data-testid={`block-resource-row-${r.id}`}
                >
                  <span title={r.kind}>{KIND_BADGE[r.kind as Kind] ?? "📎"}</span>
                  <span className="font-medium">{r.title}</span>
                  {r.url && (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      open
                    </a>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-6 px-2 text-[11px] text-red-500 hover:text-red-700"
                    onClick={() => {
                      if (confirm(`Remove "${r.title}"?`)) {
                        removeResource.mutate({ id: r.id });
                      }
                    }}
                    disabled={removeResource.isPending}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {/* Add-resource form */}
          <div className="grid items-center gap-1" style={{ gridTemplateColumns: "110px 1fr 1fr 70px" }}>
            <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
              <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {KIND_OPTIONS.map((k) => (
                  <SelectItem key={k} value={k}>{KIND_BADGE[k]} {k}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="h-7 text-[11px]"
              placeholder="Title (e.g. Khan: Multi-digit multiplication)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              data-testid={`block-resource-title-input-${topicCode}`}
            />
            <Input
              className="h-7 text-[11px]"
              placeholder="URL (optional)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              data-testid={`block-resource-url-input-${topicCode}`}
            />
            <Button
              type="button"
              size="sm"
              className="h-7 text-[11px]"
              disabled={disabled}
              onClick={() => {
                if (!topicId) return;
                addResource.mutate({
                  topicId,
                  kind,
                  title: title.trim(),
                  url: url.trim() ? url.trim() : null,
                });
              }}
              data-testid={`block-resource-add-button-${topicCode}`}
            >
              Add
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default BlockResourcesPanel;
