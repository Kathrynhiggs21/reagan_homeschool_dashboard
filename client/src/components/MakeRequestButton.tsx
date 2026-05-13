/**
 * MakeRequestButton — push 26 (2026-05-12)
 *
 * Tiny pill on Reagan's pages (default mounted in the Today header). Opens a
 * dialog with a textarea + 4 quick "kind" chips (general / schedule / stuck /
 * feeling) + a "Help me write" button that asks Kiwi to draft something based
 * on a one-line prompt.
 *
 * On submit it calls trpc.kidRequests.create which:
 *   - inserts a row in `kidRequests` (audit + future SMTP source-of-truth)
 *   - calls notifyOwner so Mom (and the family admins) see it on the go
 *   - records the recipient list (Mom/Dad/Grandma) in `emailedTo`
 *
 * The component is intentionally low-pressure: no error toasts on success,
 * just a soft "Sent! Mom will see this." confirmation.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type RequestKind = "general" | "schedule" | "stuck" | "feeling";

const KIND_OPTIONS: { kind: RequestKind; emoji: string; label: string }[] = [
  { kind: "general",  emoji: "💌", label: "Just a note" },
  { kind: "schedule", emoji: "📅", label: "About my day" },
  { kind: "stuck",    emoji: "🤔", label: "I'm stuck" },
  { kind: "feeling",  emoji: "💛", label: "How I feel" },
];

export function MakeRequestButton() {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<RequestKind>("general");
  const [drafting, setDrafting] = useState(false);

  const create = trpc.kidRequests.create.useMutation({
    onSuccess: () => {
      toast.success("Sent! Mom will see this.", { icon: "💌" });
      setBody("");
      setKind("general");
      setOpen(false);
    },
    onError: (e) => {
      toast.error(`Couldn't send: ${e.message}`);
    },
  });

  // Reuses the existing kiwi.chat endpoint to draft the body for Reagan
  // when she presses "Help me write". Falls back gracefully on failure.
  const draft = trpc.kiwi.chat.useMutation();
  async function helpMeWrite() {
    if (drafting) return;
    setDrafting(true);
    try {
      const seed = body.trim() || `I want to send my mom a note about ${KIND_OPTIONS.find(k => k.kind === kind)?.label?.toLowerCase()}.`;
      const res: any = await draft.mutateAsync({
        userMessage: `Help me write a short, kind, kid-friendly note to my mom (and family) about: ${seed}\n\nKeep it under 50 words. First-person, soft tone. No sign-off.`,
        adultPresent: false,
      } as any);
      const text = (res?.reply ?? res?.text ?? res?.assistant ?? res?.answer ?? "").toString().trim();
      if (text) setBody(text);
    } catch {
      // Keep silent; Reagan can just type it herself.
    } finally {
      setDrafting(false);
    }
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="lg"
        variant="outline"
        className="rounded-full bg-card font-display text-base px-5 py-6"
        title="Send a quick note to Mom, Dad, and Grandma"
      >
        💌 Make a request
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              Make a request
            </DialogTitle>
            <p className="text-sm text-foreground/70">
              This goes to Mom, Dad, and Grandma — so any of them can help.
            </p>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {KIND_OPTIONS.map(opt => (
                <button
                  key={opt.kind}
                  type="button"
                  onClick={() => setKind(opt.kind)}
                  className={
                    "rounded-full px-3 py-1.5 text-sm font-display transition " +
                    (kind === opt.kind
                      ? "bg-amber-300 text-amber-950 ring-2 ring-amber-500"
                      : "bg-amber-100 text-amber-900 hover:bg-amber-200")
                  }
                >
                  <span className="mr-1">{opt.emoji}</span>{opt.label}
                </button>
              ))}
            </div>

            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type what you want to say…"
              rows={5}
              className="resize-none"
              maxLength={2000}
            />

            <div className="flex items-center justify-between text-xs text-foreground/60">
              <span>{body.length}/2000</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={helpMeWrite}
                disabled={drafting || draft.isPending}
                className="text-amber-700 hover:text-amber-900"
              >
                {drafting ? "Kiwi is writing…" : "🐤 Help me write"}
              </Button>
            </div>
          </div>

          <DialogFooter className="flex flex-row justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => create.mutate({ body: body.trim(), kind })}
              disabled={!body.trim() || create.isPending}
              className="bg-amber-500 text-amber-950 hover:bg-amber-400 font-display"
            >
              {create.isPending ? "Sending…" : "Send 💌"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
