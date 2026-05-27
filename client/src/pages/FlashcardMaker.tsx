import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

const SUBJECTS = [
  { slug: "math", label: "Math", emoji: "🔢", color: "#3b82f6" },
  { slug: "ela", label: "ELA", emoji: "📖", color: "#8b5cf6" },
  { slug: "science", label: "Science", emoji: "🔬", color: "#10b981" },
  { slug: "social-studies", label: "Social Studies", emoji: "🌍", color: "#f59e0b" },
  { slug: "spelling", label: "Spelling", emoji: "✏️", color: "#ec4899" },
  { slug: "other", label: "Other", emoji: "⭐", color: "#6b7280" },
];

function subjectColor(slug: string) {
  return SUBJECTS.find((s) => s.slug === slug)?.color ?? "#6b7280";
}
function subjectEmoji(slug: string) {
  return SUBJECTS.find((s) => s.slug === slug)?.emoji ?? "⭐";
}
function subjectLabel(slug: string) {
  return SUBJECTS.find((s) => s.slug === slug)?.label ?? slug;
}

/* ─── Flip Card ─────────────────────────────────────────────────────────── */
function FlipCard({
  front,
  back,
  hint,
  index,
  total,
  onNext,
  onPrev,
}: {
  front: string;
  back: string;
  hint?: string | null;
  index: number;
  total: number;
  onNext: () => void;
  onPrev: () => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Card */}
      <div
        className="relative w-full max-w-lg cursor-pointer select-none"
        style={{ perspective: "1000px", height: 240 }}
        onClick={() => setFlipped((f) => !f)}
      >
        <div
          className="absolute inset-0 transition-transform duration-500"
          style={{
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center p-6 shadow-lg border-2"
            style={{
              backfaceVisibility: "hidden",
              background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
              borderColor: "#334155",
            }}
          >
            <p className="text-xs uppercase tracking-widest text-slate-400 mb-3">Question</p>
            <p className="text-xl font-semibold text-white text-center leading-relaxed">{front}</p>
            <p className="text-xs text-slate-500 mt-4">Tap to flip</p>
          </div>
          {/* Back */}
          <div
            className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center p-6 shadow-lg border-2"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              background: "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
              borderColor: "#0ea5e9",
            }}
          >
            <p className="text-xs uppercase tracking-widest text-sky-400 mb-3">Answer</p>
            <p className="text-xl font-semibold text-white text-center leading-relaxed">{back}</p>
          </div>
        </div>
      </div>

      {/* Hint */}
      {hint && (
        <div className="text-center">
          {showHint ? (
            <p className="text-sm text-amber-300 bg-amber-950/30 border border-amber-800 rounded-lg px-4 py-2">
              💡 {hint}
            </p>
          ) : (
            <button
              className="text-xs text-slate-500 hover:text-amber-400 transition-colors"
              onClick={() => setShowHint(true)}
            >
              Show hint
            </button>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={onPrev} disabled={index === 0}>
          ← Prev
        </Button>
        <span className="text-sm text-slate-400">
          {index + 1} / {total}
        </span>
        <Button variant="outline" size="sm" onClick={onNext} disabled={index === total - 1}>
          Next →
        </Button>
      </div>
    </div>
  );
}

/* ─── Print Layout (hidden, used by window.print) ───────────────────────── */
function PrintLayout({
  deck,
  cards,
}: {
  deck: { title: string; subjectSlug: string };
  cards: Array<{ front: string; back: string; hint?: string | null }>;
}) {
  return (
    <div id="flashcard-print-area" className="hidden print:block p-8 bg-white text-black">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #flashcard-print-area, #flashcard-print-area * { visibility: visible; }
          #flashcard-print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .print-card { page-break-inside: avoid; }
        }
      `}</style>
      <h1 className="text-2xl font-bold mb-1">{deck.title}</h1>
      <p className="text-sm text-gray-500 mb-6">
        {subjectEmoji(deck.subjectSlug)} {subjectLabel(deck.subjectSlug)} · {cards.length} cards
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px",
        }}
      >
        {cards.map((card, i) => (
          <div
            key={i}
            className="print-card border-2 border-dashed border-gray-300 rounded-lg p-4"
            style={{ minHeight: 120 }}
          >
            <div
              className="text-xs font-bold uppercase tracking-wider mb-1"
              style={{ color: subjectColor(deck.subjectSlug) }}
            >
              Card {i + 1} — {subjectLabel(deck.subjectSlug)}
            </div>
            <div className="font-semibold text-sm mb-2 border-b border-gray-200 pb-2">
              Q: {card.front}
            </div>
            <div className="text-sm text-gray-700">A: {card.back}</div>
            {card.hint && (
              <div className="text-xs text-gray-400 mt-1 italic">Hint: {card.hint}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */
export default function FlashcardMaker() {
  const { user } = useAuth();
  const isAdmin = (user as any)?.role === "admin" || (user as any)?.role === "tutor";

  const [selectedDeckId, setSelectedDeckId] = useState<number | null>(null);
  const [studyMode, setStudyMode] = useState(false);
  const [studyIndex, setStudyIndex] = useState(0);
  const [filterSubject, setFilterSubject] = useState<string | null>(null);

  // Create deck form
  const [showCreateDeck, setShowCreateDeck] = useState(false);
  const [newDeckTitle, setNewDeckTitle] = useState("");
  const [newDeckSubject, setNewDeckSubject] = useState("math");
  const [newDeckDesc, setNewDeckDesc] = useState("");

  // Add card form
  const [showAddCard, setShowAddCard] = useState(false);
  const [newFront, setNewFront] = useState("");
  const [newBack, setNewBack] = useState("");
  const [newHint, setNewHint] = useState("");

  // AI generate
  const [showAiGen, setShowAiGen] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiSubject, setAiSubject] = useState("math");
  const [aiCount, setAiCount] = useState(10);

  const utils = trpc.useUtils();

  const { data: decks = [], isLoading: decksLoading } = trpc.flashcards.listDecks.useQuery(
    { subjectSlug: filterSubject ?? undefined },
    { refetchOnWindowFocus: false }
  );

  const selectedDeck = decks.find((d) => d.id === selectedDeckId) ?? null;

  const { data: cards = [], isLoading: cardsLoading } = trpc.flashcards.listCards.useQuery(
    { deckId: selectedDeckId! },
    { enabled: selectedDeckId !== null, refetchOnWindowFocus: false }
  );

  const createDeck = trpc.flashcards.createDeck.useMutation({
    onSuccess: () => {
      utils.flashcards.listDecks.invalidate();
      setShowCreateDeck(false);
      setNewDeckTitle("");
      setNewDeckDesc("");
      toast.success("Deck created!");
    },
  });

  const deleteDeck = trpc.flashcards.deleteDeck.useMutation({
    onSuccess: () => {
      utils.flashcards.listDecks.invalidate();
      setSelectedDeckId(null);
      toast.success("Deck deleted");
    },
  });

  const addCard = trpc.flashcards.addCard.useMutation({
    onSuccess: () => {
      utils.flashcards.listCards.invalidate({ deckId: selectedDeckId! });
      utils.flashcards.listDecks.invalidate();
      setNewFront("");
      setNewBack("");
      setNewHint("");
      setShowAddCard(false);
      toast.success("Card added!");
    },
  });

  const deleteCard = trpc.flashcards.deleteCard.useMutation({
    onSuccess: () => {
      utils.flashcards.listCards.invalidate({ deckId: selectedDeckId! });
      utils.flashcards.listDecks.invalidate();
    },
  });

  const aiGenerate = trpc.flashcards.aiGenerateDeck.useMutation({
    onSuccess: (data) => {
      utils.flashcards.listDecks.invalidate();
      setShowAiGen(false);
      setAiTopic("");
      toast.success(`✨ AI created ${data.cardCount} cards!`, { description: "Deck is ready to study." });
    },
    onError: (e) => toast.error("AI generation failed", { description: e.message }),
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white">
      {/* Print layout (hidden on screen) */}
      {selectedDeck && cards.length > 0 && (
        <PrintLayout deck={selectedDeck} cards={cards} />
      )}

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">🃏 Flashcard Maker</h1>
            <p className="text-slate-400 mt-1">Make decks, study, print, or let AI build one for you</p>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-violet-600 text-violet-300 hover:bg-violet-900/30"
                onClick={() => setShowAiGen(true)}
              >
                ✨ AI Generate
              </Button>
              <Button
                size="sm"
                className="bg-sky-600 hover:bg-sky-700 text-white"
                onClick={() => setShowCreateDeck(true)}
              >
                + New Deck
              </Button>
            </div>
          )}
        </div>

        {/* Subject filter */}
        <div className="flex gap-2 flex-wrap mb-6">
          <button
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${filterSubject === null ? "bg-white text-black" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
            onClick={() => setFilterSubject(null)}
          >
            All
          </button>
          {SUBJECTS.map((s) => (
            <button
              key={s.slug}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${filterSubject === s.slug ? "text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
              style={filterSubject === s.slug ? { backgroundColor: s.color } : {}}
              onClick={() => setFilterSubject(filterSubject === s.slug ? null : s.slug)}
            >
              {s.emoji} {s.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Deck list */}
          <div className="lg:col-span-1">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Your Decks ({decks.length})
            </h2>
            {decksLoading ? (
              <div className="text-slate-500 text-sm">Loading...</div>
            ) : decks.length === 0 ? (
              <div className="text-slate-500 text-sm bg-slate-900 rounded-xl p-6 text-center">
                <p className="text-2xl mb-2">🃏</p>
                <p>No decks yet.</p>
                {isAdmin && (
                  <p className="mt-1">
                    <button className="text-sky-400 underline" onClick={() => setShowCreateDeck(true)}>
                      Create one
                    </button>{" "}
                    or{" "}
                    <button className="text-violet-400 underline" onClick={() => setShowAiGen(true)}>
                      let AI build it
                    </button>
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {decks.map((deck) => (
                  <button
                    key={deck.id}
                    className={`w-full text-left rounded-xl p-4 border transition-all ${selectedDeckId === deck.id ? "border-sky-500 bg-sky-950/30" : "border-slate-700 bg-slate-900 hover:border-slate-500"}`}
                    onClick={() => {
                      setSelectedDeckId(deck.id);
                      setStudyMode(false);
                      setStudyIndex(0);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white text-sm">{deck.title}</span>
                      <Badge
                        className="text-xs"
                        style={{ backgroundColor: subjectColor(deck.subjectSlug) + "33", color: subjectColor(deck.subjectSlug), border: "none" }}
                      >
                        {subjectEmoji(deck.subjectSlug)} {subjectLabel(deck.subjectSlug)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-400">{deck.cardCount} cards</span>
                      {deck.isAiGenerated && <span className="text-xs text-violet-400">✨ AI</span>}
                    </div>
                    {deck.description && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-1">{deck.description}</p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Deck detail / study */}
          <div className="lg:col-span-2">
            {!selectedDeck ? (
              <div className="bg-slate-900 rounded-2xl p-12 text-center text-slate-500">
                <p className="text-4xl mb-3">👈</p>
                <p>Select a deck to study or manage cards</p>
              </div>
            ) : studyMode ? (
              <div className="bg-slate-900 rounded-2xl p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold text-white">{selectedDeck.title}</h2>
                  <Button variant="outline" size="sm" onClick={() => setStudyMode(false)}>
                    ✕ Exit Study
                  </Button>
                </div>
                {cards.length === 0 ? (
                  <p className="text-slate-400 text-center py-8">No cards in this deck yet.</p>
                ) : (
                  <FlipCard
                    front={cards[studyIndex]?.front ?? ""}
                    back={cards[studyIndex]?.back ?? ""}
                    hint={cards[studyIndex]?.hint}
                    index={studyIndex}
                    total={cards.length}
                    onNext={() => setStudyIndex((i) => Math.min(i + 1, cards.length - 1))}
                    onPrev={() => setStudyIndex((i) => Math.max(i - 1, 0))}
                  />
                )}
              </div>
            ) : (
              <div className="bg-slate-900 rounded-2xl p-6">
                {/* Deck header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-white">{selectedDeck.title}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        style={{ backgroundColor: subjectColor(selectedDeck.subjectSlug) + "33", color: subjectColor(selectedDeck.subjectSlug), border: "none" }}
                      >
                        {subjectEmoji(selectedDeck.subjectSlug)} {subjectLabel(selectedDeck.subjectSlug)}
                      </Badge>
                      <span className="text-xs text-slate-400">{cards.length} cards</span>
                      {selectedDeck.isAiGenerated && <span className="text-xs text-violet-400">✨ AI-generated</span>}
                    </div>
                    {selectedDeck.description && (
                      <p className="text-sm text-slate-400 mt-1">{selectedDeck.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap justify-end">
                    {cards.length > 0 && (
                      <>
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => { setStudyMode(true); setStudyIndex(0); }}
                        >
                          📚 Study
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-slate-600 text-slate-300"
                          onClick={handlePrint}
                        >
                          🖨️ Print
                        </Button>
                      </>
                    )}
                    {isAdmin && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-sky-600 text-sky-300"
                          onClick={() => setShowAddCard(true)}
                        >
                          + Card
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-800 text-red-400 hover:bg-red-950/30"
                          onClick={() => {
                            if (confirm(`Delete "${selectedDeck.title}" and all its cards?`)) {
                              deleteDeck.mutate({ id: selectedDeck.id });
                            }
                          }}
                        >
                          🗑️
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Cards list */}
                {cardsLoading ? (
                  <div className="text-slate-500 text-sm py-4">Loading cards...</div>
                ) : cards.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <p className="text-2xl mb-2">📭</p>
                    <p>No cards yet.</p>
                    {isAdmin && (
                      <Button size="sm" className="mt-3 bg-sky-600 hover:bg-sky-700" onClick={() => setShowAddCard(true)}>
                        + Add First Card
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-1">
                    {cards.map((card, i) => (
                      <div
                        key={card.id}
                        className="flex items-start gap-3 bg-slate-800 rounded-xl p-3 border border-slate-700"
                      >
                        <span className="text-xs text-slate-500 mt-1 w-5 shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white">{card.front}</p>
                          <p className="text-sm text-slate-400 mt-0.5">{card.back}</p>
                          {card.hint && <p className="text-xs text-amber-400 mt-0.5">💡 {card.hint}</p>}
                        </div>
                        {isAdmin && (
                          <button
                            className="text-slate-600 hover:text-red-400 transition-colors text-xs shrink-0"
                            onClick={() => deleteCard.mutate({ id: card.id })}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Create Deck Modal ── */}
        {showCreateDeck && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md">
              <h3 className="text-lg font-bold text-white mb-4">New Flashcard Deck</h3>
              <div className="flex flex-col gap-3">
                <Input
                  placeholder="Deck title (e.g. Fractions Review)"
                  value={newDeckTitle}
                  onChange={(e) => setNewDeckTitle(e.target.value)}
                  className="bg-slate-800 border-slate-600 text-white"
                />
                <select
                  value={newDeckSubject}
                  onChange={(e) => setNewDeckSubject(e.target.value)}
                  className="bg-slate-800 border border-slate-600 text-white rounded-md px-3 py-2 text-sm"
                >
                  {SUBJECTS.map((s) => (
                    <option key={s.slug} value={s.slug}>
                      {s.emoji} {s.label}
                    </option>
                  ))}
                </select>
                <Textarea
                  placeholder="Description (optional)"
                  value={newDeckDesc}
                  onChange={(e) => setNewDeckDesc(e.target.value)}
                  className="bg-slate-800 border-slate-600 text-white resize-none"
                  rows={2}
                />
              </div>
              <div className="flex gap-2 mt-4">
                <Button
                  className="flex-1 bg-sky-600 hover:bg-sky-700"
                  disabled={!newDeckTitle.trim() || createDeck.isPending}
                  onClick={() => createDeck.mutate({ title: newDeckTitle.trim(), subjectSlug: newDeckSubject, description: newDeckDesc.trim() || undefined })}
                >
                  {createDeck.isPending ? "Creating..." : "Create Deck"}
                </Button>
                <Button variant="outline" onClick={() => setShowCreateDeck(false)}>Cancel</Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Add Card Modal ── */}
        {showAddCard && selectedDeck && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md">
              <h3 className="text-lg font-bold text-white mb-4">Add Card to "{selectedDeck.title}"</h3>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Front (Question / Term)</label>
                  <Textarea
                    placeholder="e.g. What is a numerator?"
                    value={newFront}
                    onChange={(e) => setNewFront(e.target.value)}
                    className="bg-slate-800 border-slate-600 text-white resize-none"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Back (Answer / Definition)</label>
                  <Textarea
                    placeholder="e.g. The top number in a fraction"
                    value={newBack}
                    onChange={(e) => setNewBack(e.target.value)}
                    className="bg-slate-800 border-slate-600 text-white resize-none"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Hint (optional)</label>
                  <Input
                    placeholder="e.g. Think of a pizza slice"
                    value={newHint}
                    onChange={(e) => setNewHint(e.target.value)}
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button
                  className="flex-1 bg-sky-600 hover:bg-sky-700"
                  disabled={!newFront.trim() || !newBack.trim() || addCard.isPending}
                  onClick={() => addCard.mutate({ deckId: selectedDeck.id, front: newFront.trim(), back: newBack.trim(), hint: newHint.trim() || undefined })}
                >
                  {addCard.isPending ? "Adding..." : "Add Card"}
                </Button>
                <Button variant="outline" onClick={() => setShowAddCard(false)}>Cancel</Button>
              </div>
            </div>
          </div>
        )}

        {/* ── AI Generate Modal ── */}
        {showAiGen && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md">
              <h3 className="text-lg font-bold text-white mb-1">✨ AI Generate Deck</h3>
              <p className="text-sm text-slate-400 mb-4">Describe the topic and AI will build the whole deck.</p>
              <div className="flex flex-col gap-3">
                <Input
                  placeholder="Topic (e.g. Dividing Fractions, Photosynthesis)"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  className="bg-slate-800 border-slate-600 text-white"
                />
                <select
                  value={aiSubject}
                  onChange={(e) => setAiSubject(e.target.value)}
                  className="bg-slate-800 border border-slate-600 text-white rounded-md px-3 py-2 text-sm"
                >
                  {SUBJECTS.map((s) => (
                    <option key={s.slug} value={s.slug}>
                      {s.emoji} {s.label}
                    </option>
                  ))}
                </select>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Number of cards: {aiCount}</label>
                  <input
                    type="range"
                    min={5}
                    max={25}
                    step={5}
                    value={aiCount}
                    onChange={(e) => setAiCount(Number(e.target.value))}
                    className="w-full accent-violet-500"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-0.5">
                    <span>5</span><span>10</span><span>15</span><span>20</span><span>25</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button
                  className="flex-1 bg-violet-600 hover:bg-violet-700"
                  disabled={!aiTopic.trim() || aiGenerate.isPending}
                  onClick={() => aiGenerate.mutate({ subjectSlug: aiSubject, topicTitle: aiTopic.trim(), cardCount: aiCount })}
                >
                  {aiGenerate.isPending ? "Generating..." : "✨ Generate"}
                </Button>
                <Button variant="outline" onClick={() => setShowAiGen(false)}>Cancel</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
