import { useEffect, useImperativeHandle, forwardRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { popConfettiFromElement } from "@/lib/confetti";

type Bucket = "have_to_do" | "optional" | "extra";

export type TodayPrintableItem = {
  id: number;
  title: string;
  description?: string | null;
  source: string;
  sourceUrl?: string | null;
  thumbKey?: string | null;
  pdfKey?: string | null;
  estMinutes?: number | null;
  coinReward?: number;
  status: string;
  subjectSlug?: string | null;
  bucket?: Bucket;
};

export type TodaySchoolWorkHandle = {
  openById: (id: number) => boolean;
  getItems: () => TodayPrintableItem[];
};

const BUCKETS: { key: Bucket; label: string; emoji: string; color: string; bg: string }[] = [
  { key: "have_to_do", label: "Have-to-do", emoji: "📌", color: "text-rose-700", bg: "from-rose-50 to-rose-100/40" },
  { key: "optional",   label: "Optional",   emoji: "🌟", color: "text-sky-700",  bg: "from-sky-50 to-sky-100/40" },
  { key: "extra",      label: "Extras",     emoji: "🎨", color: "text-emerald-700", bg: "from-emerald-50 to-emerald-100/40" },
];

function thumbUrl(key?: string | null): string | null {
  if (!key) return null;
  if (key.startsWith("http")) return key;
  if (key.startsWith("/")) return key;
  return `/manus-storage/${key}`;
}

const TodaySchoolWork = forwardRef<TodaySchoolWorkHandle, { onItemsChanged?: (items: TodayPrintableItem[]) => void }>(
  function TodaySchoolWork({ onItemsChanged }, ref) {
    const today = trpc.printables.today.useQuery();
    const utils = trpc.useUtils();
    const markM = trpc.printables.markDone.useMutation({
      onSuccess: (r: any) => {
        utils.printables.today.invalidate();
        utils.rewards?.myCoins?.invalidate?.();
        toast.success(`Nice work! +${r?.coins ?? 0} Kiwi Coins 🪙`);
      },
    });
    const submitM = trpc.printables.submitWork.useMutation({
      onSuccess: (r: any) => {
        utils.printables.today.invalidate();
        utils.rewards?.myCoins?.invalidate?.();
        toast.success(`Submitted! +${r?.coins ?? 0} Kiwi Coins. ${r?.autoGrade ?? ""}`.trim());
      },
      onError: (e) => toast.error(e.message || "Couldn't submit"),
    });
    const [open, setOpen] = useState<TodayPrintableItem | null>(null);
    const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
    const [grading, setGrading] = useState(false);

    const data = today.data as { date: string; have_to_do?: TodayPrintableItem[]; optional?: TodayPrintableItem[]; extra?: TodayPrintableItem[] } | undefined;

    const allItems: TodayPrintableItem[] = [
      ...((data?.have_to_do ?? []).map(i => ({ ...i, bucket: "have_to_do" as Bucket }))),
      ...((data?.optional   ?? []).map(i => ({ ...i, bucket: "optional"   as Bucket }))),
      ...((data?.extra      ?? []).map(i => ({ ...i, bucket: "extra"      as Bucket }))),
    ];

    useEffect(() => { onItemsChanged?.(allItems); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [today.dataUpdatedAt]);

    useImperativeHandle(ref, () => ({
      openById: (id: number) => {
        const hit = allItems.find(i => i.id === id);
        if (hit) { setOpen(hit); setPhotoDataUrl(null); return true; }
        return false;
      },
      getItems: () => allItems,
    }), [today.dataUpdatedAt]);

    if (today.isLoading) {
      return (
        <Card id="today-school-work" className="p-4 rounded-2xl">
          <div className="text-sm opacity-70">Loading today's school work…</div>
        </Card>
      );
    }

    const isEmpty = allItems.length === 0;

    async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
      const f = e.target.files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => setPhotoDataUrl(String(reader.result));
      reader.readAsDataURL(f);
    }

    async function submitDone(ev: React.MouseEvent) {
      if (!open) return;
      setGrading(true);
      try {
        popConfettiFromElement(ev.currentTarget as HTMLElement);
        if (photoDataUrl) {
          await submitM.mutateAsync({ id: open.id, photoDataUrl });
        } else {
          await markM.mutateAsync({ id: open.id });
        }
        setOpen(null);
        setPhotoDataUrl(null);
      } finally {
        setGrading(false);
      }
    }

    return (
      <Card id="today-school-work" className="p-4 rounded-2xl scroll-mt-24">
        <div className="flex items-center justify-between mb-3">
          <div className="font-extrabold text-lg">📝 Today's School Work</div>
          <div className="text-xs opacity-70">School-day work · No homework</div>
        </div>

        {isEmpty && (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm opacity-80">
            Nothing picked yet. Mom or the morning brief will fill this in by 7am.
          </div>
        )}

        {!isEmpty && (
          <div className="space-y-4">
            {BUCKETS.map(b => {
              const items = (data?.[b.key] ?? []) as TodayPrintableItem[];
              if (items.length === 0) return null;
              return (
                <div key={b.key} className={`rounded-xl p-3 bg-gradient-to-br ${b.bg}`}>
                  <div className={`flex items-center gap-2 mb-2 font-bold ${b.color}`}>
                    <span className="text-xl">{b.emoji}</span>
                    <span>{b.label}</span>
                    <span className="opacity-60 text-xs font-normal">({items.length})</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {items.map(it => {
                      const t = thumbUrl(it.thumbKey);
                      const isDone = it.status === "done";
                      return (
                        <button
                          key={it.id}
                          id={`printable-tile-${it.id}`}
                          onClick={() => { setOpen({ ...it, bucket: b.key }); setPhotoDataUrl(null); }}
                          className={`group relative text-left rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition border scroll-mt-28 ${isDone ? "opacity-60" : ""}`}
                        >
                          <div className="aspect-[4/3] bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center overflow-hidden">
                            {t ? (
                              <img src={t} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="text-4xl">📄</div>
                            )}
                          </div>
                          <div className="p-2">
                            <div className="text-xs font-semibold line-clamp-2">{it.title}</div>
                            <div className="text-[10px] opacity-70 mt-0.5 flex items-center gap-1">
                              <span>{it.source}</span>
                              {it.estMinutes ? <><span>·</span><span>{it.estMinutes}m</span></> : null}
                              {it.coinReward ? <><span>·</span><span>{it.coinReward} 🪙</span></> : null}
                            </div>
                          </div>
                          {isDone && (
                            <div className="absolute top-1 right-1 bg-emerald-500 text-white rounded-full text-[10px] font-bold px-2 py-0.5">✓ done</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {open && (
          <Dialog open onOpenChange={() => setOpen(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{open.title}</DialogTitle>
                <DialogDescription>
                  {open.source}{open.estMinutes ? ` · ${open.estMinutes} min` : ""}{open.coinReward ? ` · ${open.coinReward} Kiwi Coins 🪙` : ""}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                {open.description && <div>{open.description}</div>}
                {open.sourceUrl && (
                  <a href={open.sourceUrl} target="_blank" rel="noreferrer" className="inline-block px-3 py-2 bg-sky-600 text-white rounded-lg font-semibold">
                    Open the page →
                  </a>
                )}
                {open.pdfKey && (
                  <a href={thumbUrl(open.pdfKey)!} target="_blank" rel="noreferrer" className="inline-block ml-2 px-3 py-2 bg-emerald-600 text-white rounded-lg font-semibold">
                    Open the PDF →
                  </a>
                )}
                <div className="border-t pt-3">
                  <div className="font-semibold text-xs mb-1">All done? Snap a photo (optional):</div>
                  <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="text-xs" />
                  {photoDataUrl && <img src={photoDataUrl} alt="" className="mt-2 max-h-40 rounded border" />}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(null)}>Close</Button>
                <Button disabled={grading || open.status === "done"} onClick={submitDone}>
                  {open.status === "done" ? "Already done ✓" : grading ? (photoDataUrl ? "Auto-grading…" : "Saving…") : photoDataUrl ? "Submit photo & earn 🪙" : "Mark done & earn 🪙"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </Card>
    );
  }
);

export default TodaySchoolWork;
