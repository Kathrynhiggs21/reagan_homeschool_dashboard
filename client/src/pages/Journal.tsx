import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useAdultLock } from "@/contexts/AdultLockContext";
import { NotebookPen, HelpCircle, Trash2, Check } from "lucide-react";

/**
 * Journal — Reagan's personal page.
 * Two simple sections:
 *   1. Today's Journal: free-form note (saves locally for now).
 *   2. What I'd Like Help With: persistent list she can add to anytime.
 *      Items are private to her unless an adult unlocks the adult view,
 *      at which point a "Mark as handled" control appears.
 *
 * Data persists via localStorage for now; when DB migration 0007 is applied,
 * this page will be switched to tRPC mutations against the journalEntries
 * and helpList tables (already defined in drizzle/schema.ts).
 */

type HelpItem = {
  id: string;
  text: string;
  createdAt: number;
  handled?: boolean;
};

type JournalEntry = {
  id: string;
  text: string;
  createdAt: number;
};

const HELP_KEY = "reagan_help_list";
const JOURNAL_KEY = "reagan_journal_entries";

function loadHelp(): HelpItem[] {
  try {
    const raw = localStorage.getItem(HELP_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function loadJournal(): JournalEntry[] {
  try {
    const raw = localStorage.getItem(JOURNAL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function Journal() {
  const { unlocked } = useAdultLock();
  const [helpItems, setHelpItems] = useState<HelpItem[]>(() => loadHelp());
  const [helpInput, setHelpInput] = useState("");
  const [journal, setJournal] = useState<JournalEntry[]>(() => loadJournal());
  const [draft, setDraft] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem(HELP_KEY, JSON.stringify(helpItems));
    } catch {
      // ignore
    }
  }, [helpItems]);

  useEffect(() => {
    try {
      localStorage.setItem(JOURNAL_KEY, JSON.stringify(journal));
    } catch {
      // ignore
    }
  }, [journal]);

  function addHelp() {
    const text = helpInput.trim();
    if (!text) return;
    setHelpItems((prev) => [
      { id: crypto.randomUUID(), text, createdAt: Date.now() },
      ...prev,
    ]);
    setHelpInput("");
  }

  function toggleHandled(id: string) {
    setHelpItems((prev) =>
      prev.map((h) => (h.id === id ? { ...h, handled: !h.handled } : h))
    );
  }

  function removeHelp(id: string) {
    setHelpItems((prev) => prev.filter((h) => h.id !== id));
  }

  function addJournal() {
    const text = draft.trim();
    if (!text) return;
    setJournal((prev) => [
      { id: crypto.randomUUID(), text, createdAt: Date.now() },
      ...prev,
    ]);
    setDraft("");
  }

  return (
    <div className="container py-5 space-y-5 max-w-3xl">
      {/* Page hero */}
      <div className="chalkboard">
        <p className="font-chalk-hand text-lg mb-1" style={{ color: "#ffe27a" }}>
          Your Journal
        </p>
        <h1 className="text-4xl sm:text-5xl hero-title font-display">
          Write what's on your mind.
        </h1>
        <p className="mt-2 text-sm text-white/80">
          This is your space — no grades, no scores.
        </p>
      </div>

      {/* What I'd like help with */}
      <section className="classroom-card p-6">
        <div className="flex items-center gap-2 mb-2">
          <HelpCircle className="w-5 h-5 text-white/80" />
          <h2 className="font-display text-xl chalk-white">What I'd like help with</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Add anything you'd like a grown-up to help you with. You're in charge of this list.
        </p>
        <div className="flex gap-2 mb-4">
          <Input
            value={helpInput}
            placeholder="Something I'd like help with..."
            onChange={(e) => setHelpInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addHelp();
              }
            }}
          />
          <Button onClick={addHelp} disabled={!helpInput.trim()}>
            Add
          </Button>
        </div>
        {helpItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No items yet.</p>
        ) : (
          <ul className="space-y-2">
            {helpItems.map((h) => (
              <li
                key={h.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-white/10 px-3 py-2 bg-white/5"
              >
                <span
                  className={h.handled ? "line-through text-muted-foreground" : ""}
                >
                  {h.text}
                </span>
                <div className="flex items-center gap-1">
                  {unlocked && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs"
                      onClick={() => toggleHandled(h.id)}
                      title="Mark handled (adult)"
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs"
                    onClick={() => removeHelp(h.id)}
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Today's free-form journal */}
      <section className="classroom-card p-6">
        <div className="flex items-center gap-2 mb-2">
          <NotebookPen className="w-5 h-5 text-white/80" />
          <h2 className="font-display text-xl chalk-white">Today's journal</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Write as much or as little as you want. Nobody grades this.
        </p>
        <Textarea
          rows={5}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Today I..."
          className="mb-3"
        />
        <div className="flex justify-end">
          <Button onClick={addJournal} disabled={!draft.trim()}>
            Save entry
          </Button>
        </div>

        {journal.length > 0 && (
          <div className="mt-6 space-y-3">
            <h3 className="font-display text-sm uppercase tracking-wide text-muted-foreground">
              Past entries
            </h3>
            {journal.map((j) => (
              <div
                key={j.id}
                className="rounded-lg border border-white/10 p-3 bg-white/5"
              >
                <div className="text-xs text-muted-foreground mb-1">
                  {new Date(j.createdAt).toLocaleString()}
                </div>
                <div className="whitespace-pre-wrap">{j.text}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
