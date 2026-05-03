import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";


type Kind = "worksheet" | "video" | "lesson" | "reading" | "printable" | "link";
const KIND_EMOJI: Record<Kind, string> = {
  worksheet: "📝",
  video: "🎬",
  lesson: "📚",
  reading: "📖",
  printable: "🖨",
  link: "🔗",
};

export default function TopicDrawer({
  topicId,
  topicTitle,
  topicCode,
  open,
  onClose,
}: {
  topicId: number;
  topicTitle: string;
  topicCode: string;
  open: boolean;
  onClose: () => void;
}) {
  const rollup = trpc.curriculum.rollup.useQuery({ topicId }, { enabled: open });
  const utils = trpc.useUtils();
  const addM = trpc.curriculum.addResource.useMutation();
  const removeM = trpc.curriculum.removeResource.useMutation();

  const [kind, setKind] = useState<Kind>("worksheet");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");

  if (!open) return null;

  async function handleAdd() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    await addM.mutateAsync({
      topicId,
      kind,
      title: title.trim(),
      url: url.trim() || null,
      source: kind === "video" ? "manual" : null,
    });
    setTitle("");
    setUrl("");
    utils.curriculum.rollup.invalidate({ topicId });
    toast.success("Resource added");
  }

  async function handleRemove(id: number) {
    await removeM.mutateAsync({ id });
    utils.curriculum.rollup.invalidate({ topicId });
  }

  const data: any = rollup.data ?? { resources: [], blocks: [] };
  const resources: any[] = data.resources ?? [];
  const blocks: any[] = data.blocks ?? [];

  function planForTopic() {
    // Dispatch a custom event consumed by AIScheduleGeneratorCard to seed the
    // adult prompt + topicId. Defaults to today; adult can change in dialog.
    const today = new Date();
    const yyyyMmDd = today.toISOString().slice(0, 10);
    window.dispatchEvent(
      new CustomEvent("kiwi:seed-topic", {
        detail: { topicId, title: topicTitle, code: topicCode, date: yyyyMmDd },
      }),
    );
    onClose();
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-md h-full bg-popover text-popover-foreground border-l shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-popover border-b p-3 flex items-center gap-2 z-10">
          <Badge variant="outline" className="font-mono text-[10px]">{topicCode}</Badge>
          <div className="flex-1 min-w-0">
            <div className="font-display font-semibold text-sm truncate">{topicTitle}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm opacity-60 hover:opacity-100 px-2"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-5">
          <Button
            type="button"
            onClick={planForTopic}
            className="w-full"
            size="sm"
          >
            ✨ Plan a daily assignment for this topic
          </Button>

          <section>
            <h3 className="font-semibold text-xs uppercase tracking-wider mb-2 opacity-70">
              Resources ({resources.length})
            </h3>
            {resources.length === 0 ? (
              <p className="text-xs italic opacity-60">No resources attached yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {resources.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-start gap-2 p-2 rounded border border-border/60 bg-background/30 text-xs"
                  >
                    <span aria-hidden>{KIND_EMOJI[r.kind as Kind] ?? "•"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{r.title}</div>
                      {r.url && (
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] underline opacity-70 truncate block"
                        >
                          {r.url}
                        </a>
                      )}
                      {r.source && (
                        <span className="text-[9px] opacity-50">{r.source}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemove(r.id)}
                      className="text-[10px] opacity-50 hover:text-red-600"
                      aria-label="Remove resource"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="border-t pt-4">
            <h3 className="font-semibold text-xs uppercase tracking-wider mb-2 opacity-70">
              Add resource
            </h3>
            <div className="space-y-2">
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as Kind)}
                className="w-full text-xs rounded border bg-background px-2 py-1"
              >
                <option value="worksheet">Worksheet</option>
                <option value="video">Video</option>
                <option value="lesson">Lesson</option>
                <option value="reading">Reading</option>
                <option value="printable">Printable</option>
                <option value="link">Link</option>
              </select>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title (e.g. Khan: Multiplying Fractions)"
                className="w-full text-xs rounded border bg-background px-2 py-1"
              />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="URL (optional)"
                className="w-full text-xs rounded border bg-background px-2 py-1"
              />
              <Button size="sm" onClick={handleAdd} disabled={addM.isPending}>
                {addM.isPending ? "Adding…" : "Add"}
              </Button>
            </div>
          </section>

          <section className="border-t pt-4">
            <h3 className="font-semibold text-xs uppercase tracking-wider mb-2 opacity-70">
              Linked daily blocks ({blocks.length})
            </h3>
            {blocks.length === 0 ? (
              <p className="text-xs italic opacity-60">
                Not yet used in any daily plan.
              </p>
            ) : (
              <ul className="space-y-1">
                {blocks.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center gap-2 p-1.5 rounded border border-border/60 bg-background/30 text-xs"
                  >
                    <Badge
                      variant="outline"
                      className={`text-[9px] px-1 py-0 h-4 ${
                        b.status === "complete"
                          ? "border-emerald-400 text-emerald-700"
                          : b.status === "in_progress"
                          ? "border-amber-400 text-amber-700"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {b.status}
                    </Badge>
                    <span className="flex-1 truncate">{b.title}</span>
                    <span className="text-[10px] opacity-60">{b.durationMin}m</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
