/**
 * 2026-06-16 — WorksheetRunner
 *
 * The page Reagan actually works on. Tapping an academic block opens this:
 *  - full worksheet content (real problems / passages / prompts) with type-in
 *    answer fields she fills ONLINE,
 *  - autosave (debounced) + a "Done" submit,
 *  - "Open in IXL / Khan" buttons (PRIMARY for progress tracking — Katy likes
 *    that the apps track Reagan automatically),
 *  - "Download PDF" (full printable; also auto-files to Google Drive).
 *
 * Non-academic blocks (lunch/breaks) never reach here — the caller checks
 * `nonAcademic` from worksheets.forBlock and shows a simple break card instead.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Download, ExternalLink, Loader2, CheckCircle2 } from "lucide-react";
import type {
  WorksheetContent,
  WorksheetItem,
} from "@shared/worksheetTypes";

export type WorksheetRunnerSeed = {
  date: string; // YYYY-MM-DD
  blockId: string;
  title: string;
  subjectSlug?: string | null;
  blockType?: string | null;
  topicHint?: string | null;
  bookRef?: string | null;
};

type AppOpt = { label: string; url: string; app: "khan" | "ixl" | "prodigy" | "education" };
type AppLink = AppOpt & {
  alts?: AppOpt[];
  alt?: AppOpt; // back-compat
};

export default function WorksheetRunner({
  seed,
  open,
  onOpenChange,
}: {
  seed: WorksheetRunnerSeed | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [content, setContent] = useState<WorksheetContent | null>(null);
  const [appLink, setAppLink] = useState<AppLink | null>(null);
  const [printableId, setPrintableId] = useState<number | null>(null);
  const [nonAcademic, setNonAcademic] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const forBlock = trpc.worksheets.forBlock.useMutation();
  const saveAnswers = trpc.worksheets.saveAnswers.useMutation();
  const makePdf = trpc.worksheets.makePdf.useMutation();

  // Load worksheet content when the dialog opens for a seed.
  useEffect(() => {
    if (!open || !seed) return;
    let cancelled = false;
    setLoading(true);
    setContent(null);
    setAnswers({});
    setSubmitted(false);
    forBlock
      .mutateAsync({
        date: seed.date,
        blockId: seed.blockId,
        title: seed.title,
        subjectSlug: seed.subjectSlug ?? undefined,
        blockType: seed.blockType ?? undefined,
        topicHint: seed.topicHint ?? undefined,
        bookRef: seed.bookRef ?? undefined,
      })
      .then((res) => {
        if (cancelled) return;
        setNonAcademic(!!res.nonAcademic);
        setContent((res.content as WorksheetContent | null) ?? null);
        setAppLink((res.appLink as AppLink | null) ?? null);
        setPrintableId(res.printableId ?? null);
        const saved = (res.content as any)?.answers;
        if (saved && typeof saved === "object") setAnswers(saved);
      })
      .catch((e) => {
        if (!cancelled) toast.error(e?.message ?? "Couldn't load this worksheet.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, seed?.blockId, seed?.date]);

  // Debounced autosave.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function queueSave(next: Record<string, string>) {
    if (!printableId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveAnswers.mutate({ printableId, answers: next });
    }, 900);
  }

  function setAnswer(id: string, val: string) {
    setAnswers((prev) => {
      const next = { ...prev, [id]: val };
      queueSave(next);
      return next;
    });
  }

  async function handleSubmit() {
    if (!printableId) return;
    try {
      await saveAnswers.mutateAsync({ printableId, answers, submitted: true });
      setSubmitted(true);
      toast.success("Great work! Your answers are saved.");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't save.");
    }
  }

  async function handleDownloadPdf() {
    if (!printableId) return;
    const t = toast.loading("Building your worksheet PDF…");
    try {
      const res = await makePdf.mutateAsync({ printableId, date: seed?.date });
      toast.dismiss(t);
      toast.success("PDF ready — opening. (Also saved to your Google Drive.)");
      window.open(res.url, "_blank", "noopener");
    } catch (e: any) {
      toast.dismiss(t);
      toast.error(e?.message ?? "Couldn't make the PDF.");
    }
  }

  const answerable = useMemo(() => {
    if (!content) return 0;
    return content.sections.reduce(
      (n, s) => n + s.items.filter((i) => i.kind !== "passage").length,
      0,
    );
  }, [content]);
  const answered = useMemo(
    () => Object.values(answers).filter((v) => v && v.trim()).length,
    [answers],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {content?.title ?? seed?.title ?? "Worksheet"}
          </DialogTitle>
          {content?.intro && (
            <DialogDescription className="text-base">{content.intro}</DialogDescription>
          )}
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Getting your worksheet ready…
          </div>
        )}

        {!loading && nonAcademic && (
          <div className="py-8 text-center text-muted-foreground">
            <p className="text-lg">This is a break — no work to open. Enjoy! 🌿</p>
          </div>
        )}

        {!loading && !nonAcademic && content && (
          <div className="space-y-5">
            {/* App deep links — primary path (apps track her progress) */}
            {appLink && (
              <div className="flex flex-wrap gap-2 rounded-lg bg-muted/50 p-3">
                <span className="w-full text-xs text-muted-foreground">
                  Practice in your app (tracks your progress) — or work below and download the PDF:
                </span>
                <Button
                  size="sm"
                  onClick={() => {
                    // One-time, gentle reminder so the FIRST launch signs in as
                    // Reagan (so her progress tracks) and the browser saves it.
                    if (
                      appLink.app === "ixl" &&
                      typeof window !== "undefined" &&
                      !localStorage.getItem("ixl-signin-tip-seen")
                    ) {
                      localStorage.setItem("ixl-signin-tip-seen", "1");
                      toast("Sign in as Reagan the first time", {
                        description:
                          "Use Reagan's IXL login once and let the browser save it — after that it opens straight to the skill.",
                      });
                    }
                    window.open(appLink.url, "_blank", "noopener");
                  }}
                >
                  <ExternalLink className="h-4 w-4 mr-1" /> {appLink.label}
                </Button>
                {(appLink.alts ?? (appLink.alt ? [appLink.alt] : [])).map((a) => (
                  <Button
                    key={a.app + a.url}
                    size="sm"
                    variant="outline"
                    className="bg-background"
                    onClick={() => window.open(a.url, "_blank", "noopener")}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" /> {a.label}
                  </Button>
                ))}
              </div>
            )}

            {content.bookRef && (
              <p className="text-sm text-muted-foreground">📖 Book: {content.bookRef}</p>
            )}

            {/* The actual fill-in worksheet */}
            {content.sections.map((sec, si) => (
              <div key={si} className="space-y-3">
                {sec.heading && (
                  <h3 className="font-semibold text-lg border-b pb-1">{sec.heading}</h3>
                )}
                {sec.instructions && (
                  <p className="text-sm italic text-muted-foreground">{sec.instructions}</p>
                )}
                {sec.items.map((item) => (
                  <ItemField
                    key={item.id}
                    item={item}
                    value={answers[item.id] ?? ""}
                    onChange={(v) => setAnswer(item.id, v)}
                  />
                ))}
              </div>
            ))}

            {/* Footer actions */}
            <div className="flex flex-wrap items-center gap-2 border-t pt-4">
              <span className="text-sm text-muted-foreground mr-auto">
                {answered}/{answerable} answered
                {saveAnswers.isPending && " · saving…"}
              </span>
              <Button variant="outline" className="bg-background" onClick={handleDownloadPdf} disabled={makePdf.isPending}>
                {makePdf.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-1" />
                )}
                Download PDF
              </Button>
              <Button onClick={handleSubmit} disabled={submitted}>
                {submitted ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Done!
                  </>
                ) : (
                  "I'm done"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ItemField({
  item,
  value,
  onChange,
}: {
  item: WorksheetItem;
  value: string;
  onChange: (v: string) => void;
}) {
  if (item.kind === "passage") {
    return (
      <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm leading-relaxed whitespace-pre-wrap">
        {item.prompt}
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium leading-snug block">{item.prompt}</label>
      {item.kind === "mc" ? (
        <div className="space-y-1">
          {(item.choices ?? []).map((c, i) => {
            const letter = String.fromCharCode(65 + i);
            const checked = value === c;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onChange(c)}
                className={`w-full text-left rounded-md border px-3 py-2 text-sm transition ${
                  checked
                    ? "border-primary bg-primary/10 font-medium"
                    : "border-input hover:bg-muted/50"
                }`}
              >
                <span className="font-semibold mr-2">{letter})</span>
                {c}
              </button>
            );
          })}
        </div>
      ) : item.kind === "long" || item.kind === "prompt" ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={item.lines ?? 3}
          placeholder="Type your answer…"
        />
      ) : (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type your answer…"
        />
      )}
    </div>
  );
}
