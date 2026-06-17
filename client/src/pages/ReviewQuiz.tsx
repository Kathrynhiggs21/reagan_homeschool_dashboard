import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

const SUBJECTS = [
  { slug: "math",          label: "Math",          emoji: "🔢", color: "#3b82f6" },
  { slug: "ela",           label: "ELA",           emoji: "📖", color: "#8b5cf6" },
  { slug: "science",       label: "Science",       emoji: "🔬", color: "#10b981" },
  { slug: "social-studies",label: "Social Studies",emoji: "🌍", color: "#f59e0b" },
  { slug: "spelling",      label: "Spelling",      emoji: "✏️", color: "#ec4899" },
  { slug: "other",         label: "Other",         emoji: "⭐", color: "#6b7280" },
];

function subjectColor(slug: string) {
  return SUBJECTS.find((s) => s.slug === slug)?.color ?? "#6b7280";
}
function subjectEmoji(slug: string) {
  return SUBJECTS.find((s) => s.slug === slug)?.emoji ?? "⭐";
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/* ─── Quiz Runner ──────────────────────────────────────────────────────── */
function QuizRunner({
  sessionId,
  questions,
  onComplete,
}: {
  sessionId: number;
  questions: Array<{ id: number; question: string; correctAnswer: string; choices?: string[] | null }>;
  onComplete: (score: number, total: number) => void;
}) {
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<Array<{ correct: boolean }>>([]);

  const submitAnswer = trpc.reviewSessions.submitAnswer.useMutation();
  const completeSession = trpc.reviewSessions.completeSession.useMutation();

  const q = questions[qIndex];
  const choices = q?.choices ?? [];

  const handleSelect = (choice: string) => {
    if (revealed) return;
    setSelected(choice);
    setRevealed(true);
    const correct = choice === q.correctAnswer;
    if (correct) setScore((s) => s + 1);
    setAnswers((a) => [...a, { correct }]);
    submitAnswer.mutate({ questionId: q.id, studentAnswer: choice, isCorrect: correct });
  };

  const handleNext = async () => {
    if (qIndex + 1 >= questions.length) {
      // Done
      await completeSession.mutateAsync({ sessionId });
      onComplete(score + (selected === q.correctAnswer ? 0 : 0), questions.length);
    } else {
      setQIndex((i) => i + 1);
      setSelected(null);
      setRevealed(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-slate-800 rounded-full h-2">
          <div
            className="bg-sky-500 h-2 rounded-full transition-all"
            style={{ width: `${((qIndex) / questions.length) * 100}%` }}
          />
        </div>
        <span className="text-xs text-slate-400">{qIndex + 1} / {questions.length}</span>
      </div>

      {/* Question */}
      <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Question {qIndex + 1}</p>
        <p className="text-lg font-semibold text-white leading-relaxed">{q.question}</p>
      </div>

      {/* Choices */}
      <div className="grid grid-cols-1 gap-2">
        {choices.map((choice, i) => {
          let cls = "w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all ";
          if (!revealed) {
            cls += "border-slate-700 bg-slate-800 text-white hover:border-sky-500 hover:bg-sky-950/30";
          } else if (choice === q.correctAnswer) {
            cls += "border-emerald-500 bg-emerald-950/40 text-emerald-300";
          } else if (choice === selected) {
            cls += "border-red-500 bg-red-950/40 text-red-300";
          } else {
            cls += "border-slate-700 bg-slate-800 text-slate-500";
          }
          return (
            <button key={i} className={cls} onClick={() => handleSelect(choice)}>
              <span className="font-bold mr-2 text-slate-400">{["A", "B", "C", "D"][i]}.</span>
              {choice}
              {revealed && choice === q.correctAnswer && <span className="ml-2">✓</span>}
              {revealed && choice === selected && choice !== q.correctAnswer && <span className="ml-2">✗</span>}
            </button>
          );
        })}
      </div>

      {revealed && (
        <Button
          className="bg-sky-600 hover:bg-sky-700 text-white"
          onClick={handleNext}
          disabled={completeSession.isPending}
        >
          {qIndex + 1 >= questions.length ? "Finish Questionnaire" : "Next Question →"}
        </Button>
      )}
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */
export default function ReviewQuiz() {
  const { user } = useAuth();
  const isAdmin = (user as any)?.role === "admin" || (user as any)?.role === "tutor";

  const [tab, setTab] = useState<"weak" | "quiz" | "history">("weak");
  const [showGenerate, setShowGenerate] = useState(false);
  const [genSubject, setGenSubject] = useState("math");
  const [genTopic, setGenTopic] = useState("");
  const [genCount, setGenCount] = useState(5);
  const [genCk12, setGenCk12] = useState("");

  // Active quiz state
  const [activeSession, setActiveSession] = useState<{
    id: number;
    subject: string;
    topic: string;
    questions: Array<{ id: number; question: string; correctAnswer: string; choices?: string[] | null }>;
  } | null>(null);
  const [quizResult, setQuizResult] = useState<{ score: number; total: number; subject: string; topic: string } | null>(null);

  const utils = trpc.useUtils();

  const { data: weakTopics = [] } = trpc.reviewSessions.allWeakTopics.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const { data: todaySessions = [] } = trpc.reviewSessions.listSessionsForDate.useQuery(
    { dateStr: todayStr() },
    { refetchOnWindowFocus: false }
  );

  const aiGenerate = trpc.reviewSessions.aiGenerateQuiz.useMutation({
    onSuccess: async (data) => {
      utils.reviewSessions.allWeakTopics.invalidate();
      utils.reviewSessions.listSessionsForDate.invalidate();
      setShowGenerate(false);
      setGenTopic("");
      toast.success(`Questionnaire ready! ${data.questionCount} questions`);
      // Fetch the session questions
      // We'll use the sessionId to load questions from the session
      // For now, show a placeholder — the session is created, user can see it in history
    },
      onError: (e) => toast.error("Failed to generate questionnaire", { description: e.message }),
  });

  const updateWeakTopic = trpc.reviewSessions.updateWeakTopic.useMutation({
    onSuccess: () => utils.reviewSessions.allWeakTopics.invalidate(),
  });

  const handleQuizComplete = (score: number, total: number) => {
    if (!activeSession) return;
    const pct = Math.round((score / total) * 100);
    // Update weak topic score
    updateWeakTopic.mutate({
      subjectSlug: activeSession.subject,
      topicHandle: activeSession.topic,
      topicTitle: activeSession.topic,
      newScore: pct,
    });
    setQuizResult({ score, total, subject: activeSession.subject, topic: activeSession.topic });
    setActiveSession(null);
    utils.reviewSessions.listSessionsForDate.invalidate();
    utils.reviewSessions.allWeakTopics.invalidate();
  };

  const sortedWeak = useMemo(
    () => [...weakTopics].sort((a, b) => (a.masteryScore ?? 100) - (b.masteryScore ?? 100)),
    [weakTopics]
  );

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">🧠 Review & Questionnaire</h1>
            <p className="text-slate-400 mt-1">Practice what you know, strengthen what you don't</p>
          </div>
          {isAdmin && (
            <Button
              className="bg-violet-600 hover:bg-violet-700 text-white"
              onClick={() => setShowGenerate(true)}
            >
              ✨ Generate Questionnaire
            </Button>
          )}
        </div>

        {/* Active quiz */}
        {activeSession && !quizResult && (
          <div className="bg-slate-900 rounded-2xl p-6 border border-sky-800 mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-white">{activeSession.topic}</h2>
                <Badge style={{ backgroundColor: subjectColor(activeSession.subject) + "33", color: subjectColor(activeSession.subject), border: "none" }}>
                  {subjectEmoji(activeSession.subject)} {activeSession.subject}
                </Badge>
              </div>
              <Button variant="outline" size="sm" onClick={() => setActiveSession(null)}>✕ Exit</Button>
            </div>
            <QuizRunner
              sessionId={activeSession.id}
              questions={activeSession.questions}
              onComplete={handleQuizComplete}
            />
          </div>
        )}

        {/* Quiz result */}
        {quizResult && (
          <div className="bg-slate-900 rounded-2xl p-8 border border-emerald-700 mb-8 text-center">
            <p className="text-5xl mb-3">
              {quizResult.score / quizResult.total >= 0.8 ? "🎉" : quizResult.score / quizResult.total >= 0.5 ? "💪" : "🔁"}
            </p>
            <h2 className="text-2xl font-bold text-white mb-1">
              {quizResult.score} / {quizResult.total} correct
            </h2>
            <p className="text-slate-400 mb-1">{quizResult.topic}</p>
            <p className="text-lg font-semibold" style={{ color: quizResult.score / quizResult.total >= 0.8 ? "#10b981" : quizResult.score / quizResult.total >= 0.5 ? "#f59e0b" : "#ef4444" }}>
              {Math.round((quizResult.score / quizResult.total) * 100)}%
            </p>
            <p className="text-sm text-slate-500 mt-3">
              {quizResult.score / quizResult.total >= 0.8
                ? "Strong work — this topic is getting solid."
                : quizResult.score / quizResult.total >= 0.5
                ? "Getting there. A bit more practice will help."
                : "This one needs more time. It's been added to your review list."}
            </p>
            <Button className="mt-4 bg-sky-600 hover:bg-sky-700" onClick={() => setQuizResult(null)}>
              Back to Review
            </Button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-900 rounded-xl p-1 mb-6 w-fit">
          {(["weak", "quiz", "history"] as const).map((t) => (
            <button
              key={t}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"}`}
              onClick={() => setTab(t)}
            >
              {t === "weak" ? "🎯 Weak Topics" : t === "quiz" ? "📝 Today's Questionnaires" : "📊 History"}
            </button>
          ))}
        </div>

        {/* Weak Topics Tab */}
        {tab === "weak" && (
          <div>
            {sortedWeak.length === 0 ? (
              <div className="bg-slate-900 rounded-2xl p-12 text-center text-slate-500">
                <p className="text-3xl mb-3">🌱</p>
                <p>No weak topics tracked yet.</p>
                <p className="text-sm mt-1">Take a questionnaire to start tracking what needs more practice.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {sortedWeak.map((topic) => {
                  const score = topic.masteryScore ?? 50;
                  const color = score >= 80 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
                  return (
                    <div
                      key={topic.id}
                      className="bg-slate-900 rounded-xl p-4 border border-slate-700 flex items-center gap-4"
                    >
                      <div className="text-2xl w-8 text-center">{subjectEmoji(topic.subjectSlug)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white text-sm">{topic.topicTitle}</p>
                        <p className="text-xs text-slate-400">{topic.subjectSlug}</p>
                        {/* Mastery bar */}
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 bg-slate-800 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full transition-all"
                              style={{ width: `${score}%`, backgroundColor: color }}
                            />
                          </div>
                          <span className="text-xs font-semibold" style={{ color }}>{score}%</span>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {topic.ck12Url && (
                          <a
                            href={topic.ck12Url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-sky-400 hover:text-sky-300 border border-sky-800 rounded-lg px-2 py-1"
                          >
                            CK-12 Practice
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Today's Quizzes Tab */}
        {tab === "quiz" && (
          <div>
            {todaySessions.length === 0 ? (
              <div className="bg-slate-900 rounded-2xl p-12 text-center text-slate-500">
                <p className="text-3xl mb-3">📝</p>
                <p>No questionnaires today yet.</p>
                {isAdmin && (
                  <Button className="mt-4 bg-violet-600 hover:bg-violet-700" onClick={() => setShowGenerate(true)}>
                    ✨ Generate a Questionnaire
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {todaySessions.map((session) => (
                  <div
                    key={session.id}
                    className="bg-slate-900 rounded-xl p-4 border border-slate-700 flex items-center gap-4"
                  >
                    <div className="text-2xl w-8 text-center">{subjectEmoji(session.subjectSlug)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white text-sm">{session.topicTitle || session.subjectSlug}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge style={{ backgroundColor: subjectColor(session.subjectSlug) + "33", color: subjectColor(session.subjectSlug), border: "none" }}>
                          {session.subjectSlug}
                        </Badge>
                        <span className="text-xs text-slate-400">{session.totalQuestions} questions</span>
                        {session.completedAt && (
                          <span className="text-xs text-emerald-400">
                            ✓ {session.correctAnswers ?? 0}/{session.totalQuestions} correct
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0">
                      {session.completedAt ? (
                        <span className="text-xs text-slate-500">Done</span>
                      ) : (
                        <span className="text-xs text-amber-400">Ready</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {tab === "history" && (
          <div className="bg-slate-900 rounded-2xl p-8 text-center text-slate-500">
            <p className="text-3xl mb-3">📊</p>
            <p>Full quiz history coming soon.</p>
            <p className="text-sm mt-1">Weak topics above already reflect your progress over time.</p>
          </div>
        )}

        {/* ── AI Generate Modal ── */}
        {showGenerate && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md">
              <h3 className="text-lg font-bold text-white mb-1">✨ Generate Quiz</h3>
              <p className="text-sm text-slate-400 mb-4">AI will write {genCount} multiple-choice questions on any topic.</p>
              <div className="flex flex-col gap-3">
                <Input
                  placeholder="Topic (e.g. Photosynthesis, Long Division)"
                  value={genTopic}
                  onChange={(e) => setGenTopic(e.target.value)}
                  className="bg-slate-800 border-slate-600 text-white"
                />
                <select
                  value={genSubject}
                  onChange={(e) => setGenSubject(e.target.value)}
                  className="bg-slate-800 border border-slate-600 text-white rounded-md px-3 py-2 text-sm"
                >
                  {SUBJECTS.map((s) => (
                    <option key={s.slug} value={s.slug}>{s.emoji} {s.label}</option>
                  ))}
                </select>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Questions: {genCount}</label>
                  <input
                    type="range" min={3} max={10} step={1} value={genCount}
                    onChange={(e) => setGenCount(Number(e.target.value))}
                    className="w-full accent-violet-500"
                  />
                </div>
                <Input
                  placeholder="CK-12 practice URL (optional)"
                  value={genCk12}
                  onChange={(e) => setGenCk12(e.target.value)}
                  className="bg-slate-800 border-slate-600 text-white text-xs"
                />
              </div>
              <div className="flex gap-2 mt-4">
                <Button
                  className="flex-1 bg-violet-600 hover:bg-violet-700"
                  disabled={!genTopic.trim() || aiGenerate.isPending}
                  onClick={() => aiGenerate.mutate({
                    dateStr: todayStr(),
                    subjectSlug: genSubject,
                    topicTitle: genTopic.trim(),
                    questionCount: genCount,
                    ck12Url: genCk12.trim() || undefined,
                  })}
                >
                  {aiGenerate.isPending ? "Generating..." : "✨ Generate"}
                </Button>
                <Button variant="outline" onClick={() => setShowGenerate(false)}>Cancel</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
