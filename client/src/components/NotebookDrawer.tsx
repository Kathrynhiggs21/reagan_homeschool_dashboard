/**
 * NotebookDrawer — global slide-over panel for adult-only notebook tools.
 *
 * 2026-05-05 upgrade: per-day reopen (already opens to today's date), light
 * cream-paper background regardless of theme so handwriting + scans read
 * well, plus a Day Attachments card under the day notes:
 *
 *   • Upload an image (camera or library)
 *   • Upload a PDF / worksheet
 *   • Tap any thumbnail → MarkupCanvas (pen / highlight / erase / colors)
 *   • Markup saves alongside the original; original is never overwritten
 *   • All attachments are date-keyed so flipping back to a prior day shows
 *     yesterday's marks intact on yesterday's page
 */
import { useRef, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAdultLock } from "@/contexts/AdultLockContext";
import { trpc } from "@/lib/trpc";
import TutorDayNotesBox from "@/components/TutorDayNotesBox";
import MarkupCanvas from "@/components/MarkupCanvas";

type DayAttachmentRow = {
  id: number;
  dateStr: string;
  kind: "image" | "pdf";
  fileKey: string;
  fileName: string | null;
  markupKey: string | null;
  pageIndex: number;
  createdAt: string | Date;
};

function fileKeyToUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  return `/manus-storage/${key}`;
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export default function NotebookDrawer() {
  const { unlocked } = useAdultLock();
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [dateStr, setDateStr] = useState<string>(today);
  const [editing, setEditing] = useState<DayAttachmentRow | null>(null);

  const utils = trpc.useUtils();

  // Tutor of the day → autofills TutorDayNotesBox author field
  const tutorQ =
    (trpc as any).tutors?.tutorOfDay?.useQuery?.({ dateStr }) ?? {
      data: null,
      isLoading: false,
    };
  const tutorOfDayName: string | undefined =
    (tutorQ.data as any)?.name ?? undefined;

  // Day attachments
  const attachmentsQ =
    (trpc as any).notebookAttachments?.list?.useQuery?.({ dateStr }) ?? {
      data: [] as DayAttachmentRow[],
      isLoading: false,
    };
  const attachments: DayAttachmentRow[] = (attachmentsQ.data as any) ?? [];

  const addMutation = (trpc as any).notebookAttachments?.add?.useMutation?.({
    onSuccess: () => utils.notebookAttachments?.list?.invalidate?.(),
  });
  const removeMutation = (trpc as any).notebookAttachments?.remove?.useMutation?.({
    onSuccess: () => utils.notebookAttachments?.list?.invalidate?.(),
  });

  const imgInputRef = useRef<HTMLInputElement | null>(null);
  const camInputRef = useRef<HTMLInputElement | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);

  const [busy, setBusy] = useState(false);

  const handleUpload = async (file: File, kind: "image" | "pdf") => {
    if (!file || !addMutation) return;
    setBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      await addMutation.mutateAsync({
        dateStr,
        kind,
        dataUrl,
        fileName: file.name,
      });
    } catch (e) {
      console.warn("[Notebook] upload failed", e);
      alert("Couldn't upload. Try again?");
    } finally {
      setBusy(false);
    }
  };

  if (!unlocked) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          {/* Mid-right edge pill — narrow, vertical, out of the way */}
          <button
            type="button"
            aria-label="Open Notebook"
            title="Notebook"
            className="
              no-print
              fixed right-0 top-1/2 -translate-y-1/2 z-40
              flex flex-col items-center gap-1
              px-1.5 py-3
              rounded-l-lg
              border border-r-0 border-amber-300/50
              bg-amber-50 text-emerald-900 shadow-md
              hover:bg-amber-100 hover:shadow-lg
              transition-all
              text-[11px] font-semibold tracking-wide
            "
            style={{
              writingMode: "vertical-rl",
              transform: "translateY(-50%) rotate(180deg)",
            }}
          >
            <span className="rotate-180" aria-hidden>
              📓
            </span>
            <span>Notebook</span>
          </button>
        </SheetTrigger>
        <SheetContent
          side="right"
          /* Light cream-paper background regardless of theme so uploaded
             scans + handwriting are legible. Forces dark ink throughout. */
          className="w-full sm:max-w-lg overflow-y-auto bg-amber-50 text-stone-900 dark:bg-amber-50 dark:text-stone-900"
        >
          <SheetHeader>
            <SheetTitle className="font-display text-xl text-stone-900">
              📓 Notebook
            </SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6 space-y-4 text-stone-900">
            {/* Day picker + tutor of the day inline */}
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <div className="text-xs text-stone-700 mb-1">Day</div>
                <Input
                  type="date"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value || today)}
                  className="w-44 bg-white text-stone-900"
                />
              </div>
              <div className="ml-auto text-sm">
                {tutorOfDayName ? (
                  <span>
                    <span className="text-stone-700">With Reagan: </span>
                    <span className="font-medium">{tutorOfDayName}</span>
                  </span>
                ) : null}
              </div>
            </div>

            <TutorDayNotesBox
              dateStr={dateStr}
              tutorOfDayName={tutorOfDayName}
            />

            {/* Day attachments */}
            <div className="rounded-xl border border-amber-200 bg-amber-100/60 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-stone-900">
                    Day attachments
                  </div>
                  <div className="text-xs text-stone-700">
                    Photos, scans, and worksheets for this day. Tap to mark up.
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <input
                  ref={imgInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) await handleUpload(f, "image");
                    e.target.value = "";
                  }}
                />
                <input
                  ref={camInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) await handleUpload(f, "image");
                    e.target.value = "";
                  }}
                />
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept="application/pdf"
                  hidden
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) await handleUpload(f, "pdf");
                    e.target.value = "";
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-white"
                  onClick={() => imgInputRef.current?.click()}
                  disabled={busy}
                >
                  🖼 Upload image
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-white"
                  onClick={() => camInputRef.current?.click()}
                  disabled={busy}
                >
                  📷 Take photo
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-white"
                  onClick={() => pdfInputRef.current?.click()}
                  disabled={busy}
                >
                  📄 Upload PDF
                </Button>
                {busy ? (
                  <span className="text-xs text-stone-700 self-center">
                    Uploading…
                  </span>
                ) : null}
              </div>

              {/* Hide entirely if no attachments and not uploading */}
              {attachments.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {attachments.map((a) => {
                    const url = fileKeyToUrl(a.fileKey);
                    const markupUrl = fileKeyToUrl(a.markupKey);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        className="relative group rounded-md border border-amber-300 overflow-hidden bg-white text-left"
                        onClick={() => setEditing(a)}
                        title={a.fileName ?? "Attachment"}
                      >
                        {a.kind === "image" && url ? (
                          <img
                            src={url}
                            alt={a.fileName ?? "attachment"}
                            className="w-full h-24 object-cover"
                          />
                        ) : (
                          <div className="w-full h-24 flex flex-col items-center justify-center text-stone-700">
                            <span className="text-2xl">📄</span>
                            <span className="text-[10px] mt-1 truncate w-full text-center px-1">
                              {a.fileName ?? "PDF"}
                            </span>
                          </div>
                        )}
                        {markupUrl ? (
                          <span className="absolute top-1 left-1 text-[10px] bg-amber-200 text-stone-900 rounded px-1">
                            ✎ marked
                          </span>
                        ) : null}
                        <span
                          className="absolute top-1 right-1 text-[10px] bg-rose-200 text-stone-900 rounded px-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (
                              window.confirm(
                                "Remove this attachment from the day?",
                              )
                            ) {
                              removeMutation?.mutate?.({ id: a.id });
                            }
                          }}
                        >
                          ✕
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {editing ? (
        <MarkupCanvas
          attachmentId={editing.id}
          fileUrl={fileKeyToUrl(editing.fileKey)!}
          kind={editing.kind}
          existingMarkupUrl={fileKeyToUrl(editing.markupKey)}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}
