import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

/* ─── CK-12 subject catalogue ─────────────────────────────────────────────── */
const CK12_BASE = "https://www.ck12.org";

interface Concept {
  label: string;
  slug: string;
  conceptHandle: string;
}

interface Topic {
  label: string;
  topicHandle: string;
  concepts: Concept[];
}

interface Subject {
  key: string;
  label: string;
  emoji: string;
  color: string;
  browseUrl: string;
  collectionHandle: string;
  topics: Topic[];
}

/* ─── Grade 5 subjects ─────────────────────────────────────────────────────── */
const SUBJECTS_GRADE5: Subject[] = [
  {
    key: "math5",
    label: "Math — Grade 5",
    emoji: "🔢",
    color: "bg-blue-100 border-blue-300 text-blue-800",
    browseUrl: `${CK12_BASE}/assessment/ui/browse/practice/elementary-math-grade-5/?topic=MAT.EM5`,
    collectionHandle: "elementary-math-grade-5",
    topics: [
      {
        label: "Multiplication & Division",
        topicHandle: "multiplication-and-division",
        concepts: [
          { label: "Long Division", slug: "long-division-practice", conceptHandle: "long-division" },
          { label: "Dividing Multi-Digit Numbers", slug: "dividing-multi-digit-numbers-practice", conceptHandle: "dividing-multi-digit-numbers" },
          { label: "Multiply Multi-Digit Numbers", slug: "multiply-multi-digit-numbers-practice", conceptHandle: "multiply-multi-digit-numbers" },
          { label: "Order of Operations", slug: "order-of-operations-practice", conceptHandle: "order-of-operations" },
        ],
      },
      {
        label: "Fractions",
        topicHandle: "fractions",
        concepts: [
          { label: "Comparing & Ordering Fractions", slug: "compare-fractions-practice", conceptHandle: "comparing-ordering-and-simplifying-fractions" },
          { label: "Adding Fractions (Different Denominators)", slug: "add-fractions-with-different-denominators-practice", conceptHandle: "adding-fractions-with-different-denominators" },
          { label: "Subtracting Fractions (Different Denominators)", slug: "subtract-fractions-with-different-denominators-practice", conceptHandle: "subtracting-fractions-with-different-denominators" },
          { label: "Multiplying Fractions", slug: "multiply-fractions-practice", conceptHandle: "multiplying-fractions" },
          { label: "Dividing Fractions", slug: "dividing-fractions-practice", conceptHandle: "dividing-fractions" },
          { label: "Mixed Numbers — Add/Subtract", slug: "add-mixed-numbers-with-common-denominators-practice", conceptHandle: "adding-mixed-numbers-with-common-denominators" },
          { label: "Converting Fractions & Decimals", slug: "convert-fractions-to-decimals-practice", conceptHandle: "converting-between-fractions-and-decimals" },
        ],
      },
      {
        label: "Decimals",
        topicHandle: "decimals",
        concepts: [
          { label: "Adding Decimals", slug: "adding-decimals-practice", conceptHandle: "adding-decimals" },
          { label: "Subtracting Decimals", slug: "subtracting-decimals-practice", conceptHandle: "subtracting-decimals" },
          { label: "Multiplying Decimals", slug: "multiplying-decimals-practice", conceptHandle: "multiplying-decimals" },
          { label: "Dividing Decimals", slug: "dividing-decimals-practice", conceptHandle: "dividing-decimals" },
          { label: "Comparing Decimals", slug: "comparing-decimals-practice", conceptHandle: "comparing-and-ordering-decimals" },
        ],
      },
      {
        label: "Place Values",
        topicHandle: "place-values",
        concepts: [
          { label: "Place Value (Whole Numbers)", slug: "place-value-practice", conceptHandle: "place-value" },
          { label: "Rounding Whole Numbers", slug: "rounding-whole-numbers-practice", conceptHandle: "rounding-whole-numbers" },
          { label: "Rounding Decimals", slug: "rounding-decimals-practice", conceptHandle: "rounding-decimals" },
        ],
      },
      {
        label: "Geometry",
        topicHandle: "geometry",
        concepts: [
          { label: "Area of Rectangles", slug: "area-of-rectangles-practice", conceptHandle: "area-of-rectangles" },
          { label: "Volume of Rectangular Prisms", slug: "volume-of-rectangular-prisms-practice", conceptHandle: "volume-of-rectangular-prisms" },
          { label: "Coordinate Plane", slug: "coordinate-plane-practice", conceptHandle: "coordinate-plane" },
          { label: "Classifying Triangles", slug: "classifying-triangles-practice", conceptHandle: "classifying-triangles" },
        ],
      },
      {
        label: "Measurement",
        topicHandle: "measurement",
        concepts: [
          { label: "Converting Units (Customary)", slug: "customary-unit-conversion-practice", conceptHandle: "customary-unit-conversions" },
          { label: "Converting Units (Metric)", slug: "metric-unit-conversion-practice", conceptHandle: "metric-unit-conversions" },
          { label: "Elapsed Time", slug: "elapsed-time-practice", conceptHandle: "elapsed-time" },
        ],
      },
    ],
  },
  {
    key: "earth-sci",
    label: "Earth Science",
    emoji: "🌍",
    color: "bg-green-100 border-green-300 text-green-800",
    browseUrl: `${CK12_BASE}/assessment/ui/browse/practice/earth-science/?topic=SCI.ESC`,
    collectionHandle: "earth-science",
    topics: [
      {
        label: "Rocks & Minerals",
        topicHandle: "rocks-and-minerals",
        concepts: [
          { label: "Types of Rocks", slug: "types-of-rocks-practice", conceptHandle: "types-of-rocks" },
          { label: "Rock Cycle", slug: "rock-cycle-practice", conceptHandle: "rock-cycle" },
          { label: "Minerals", slug: "minerals-practice", conceptHandle: "minerals" },
        ],
      },
      {
        label: "Weather & Climate",
        topicHandle: "weather-and-climate",
        concepts: [
          { label: "Weather vs Climate", slug: "weather-vs-climate-practice", conceptHandle: "weather-vs-climate" },
          { label: "Water Cycle", slug: "water-cycle-practice", conceptHandle: "water-cycle" },
          { label: "Clouds & Precipitation", slug: "clouds-and-precipitation-practice", conceptHandle: "clouds-and-precipitation" },
        ],
      },
      {
        label: "Earth's Structure",
        topicHandle: "earths-structure",
        concepts: [
          { label: "Layers of the Earth", slug: "layers-of-the-earth-practice", conceptHandle: "layers-of-the-earth" },
          { label: "Plate Tectonics", slug: "plate-tectonics-practice", conceptHandle: "plate-tectonics" },
          { label: "Volcanoes & Earthquakes", slug: "volcanoes-and-earthquakes-practice", conceptHandle: "volcanoes-and-earthquakes" },
        ],
      },
    ],
  },
  {
    key: "life-sci",
    label: "Life Science",
    emoji: "🌱",
    color: "bg-emerald-100 border-emerald-300 text-emerald-800",
    browseUrl: `${CK12_BASE}/assessment/ui/browse/practice/life-science/?topic=SCI.LSC`,
    collectionHandle: "life-science",
    topics: [
      {
        label: "Cells",
        topicHandle: "cells",
        concepts: [
          { label: "Cell Parts & Functions", slug: "cell-parts-and-functions-practice", conceptHandle: "cell-parts-and-functions" },
          { label: "Plant vs Animal Cells", slug: "plant-vs-animal-cells-practice", conceptHandle: "plant-vs-animal-cells" },
          { label: "Photosynthesis", slug: "photosynthesis-practice", conceptHandle: "photosynthesis" },
        ],
      },
      {
        label: "Ecosystems",
        topicHandle: "ecosystems",
        concepts: [
          { label: "Food Chains & Webs", slug: "food-chains-and-webs-practice", conceptHandle: "food-chains-and-webs" },
          { label: "Producers, Consumers, Decomposers", slug: "producers-consumers-decomposers-practice", conceptHandle: "producers-consumers-and-decomposers" },
          { label: "Biomes", slug: "biomes-practice", conceptHandle: "biomes" },
        ],
      },
      {
        label: "Human Body",
        topicHandle: "human-body",
        concepts: [
          { label: "Body Systems Overview", slug: "body-systems-practice", conceptHandle: "body-systems" },
          { label: "Skeletal System", slug: "skeletal-system-practice", conceptHandle: "skeletal-system" },
          { label: "Digestive System", slug: "digestive-system-practice", conceptHandle: "digestive-system" },
        ],
      },
    ],
  },
  {
    key: "physical-sci",
    label: "Physical Science",
    emoji: "⚡",
    color: "bg-yellow-100 border-yellow-300 text-yellow-800",
    browseUrl: `${CK12_BASE}/assessment/ui/browse/practice/physical-science/?topic=SCI.PSC`,
    collectionHandle: "physical-science",
    topics: [
      {
        label: "Matter",
        topicHandle: "matter",
        concepts: [
          { label: "States of Matter", slug: "states-of-matter-practice", conceptHandle: "states-of-matter" },
          { label: "Physical vs Chemical Changes", slug: "physical-vs-chemical-changes-practice", conceptHandle: "physical-vs-chemical-changes" },
          { label: "Mixtures & Solutions", slug: "mixtures-and-solutions-practice", conceptHandle: "mixtures-and-solutions" },
        ],
      },
      {
        label: "Forces & Motion",
        topicHandle: "forces-and-motion",
        concepts: [
          { label: "Newton's Laws", slug: "newtons-laws-practice", conceptHandle: "newtons-laws-of-motion" },
          { label: "Gravity", slug: "gravity-practice", conceptHandle: "gravity" },
          { label: "Simple Machines", slug: "simple-machines-practice", conceptHandle: "simple-machines" },
        ],
      },
      {
        label: "Energy",
        topicHandle: "energy",
        concepts: [
          { label: "Forms of Energy", slug: "forms-of-energy-practice", conceptHandle: "forms-of-energy" },
          { label: "Heat Transfer", slug: "heat-transfer-practice", conceptHandle: "heat-transfer" },
          { label: "Light & Sound", slug: "light-and-sound-practice", conceptHandle: "light-and-sound" },
        ],
      },
    ],
  },
  {
    key: "spelling",
    label: "Spelling",
    emoji: "🔤",
    color: "bg-pink-100 border-pink-300 text-pink-800",
    browseUrl: `${CK12_BASE}/assessment/ui/browse/practice/spelling/?topic=ELA.SPL`,
    collectionHandle: "spelling",
    topics: [
      {
        label: "Spelling Practice",
        topicHandle: "spelling",
        concepts: [
          { label: "Grade 5 Spelling", slug: "grade-5-spelling-practice", conceptHandle: "grade-5-spelling" },
          { label: "Commonly Misspelled Words", slug: "commonly-misspelled-words-practice", conceptHandle: "commonly-misspelled-words" },
          { label: "Prefixes & Suffixes", slug: "prefixes-and-suffixes-practice", conceptHandle: "prefixes-and-suffixes" },
          { label: "Compound Words", slug: "compound-words-practice", conceptHandle: "compound-words" },
        ],
      },
    ],
  },
];

/* ─── Grade 6 subjects (Summer Prep) ──────────────────────────────────────── */
const SUBJECTS_GRADE6: Subject[] = [
  {
    key: "math6",
    label: "Math — Grade 6",
    emoji: "🔢",
    color: "bg-blue-100 border-blue-300 text-blue-800",
    browseUrl: `${CK12_BASE}/assessment/ui/browse/practice/middle-school-math-grade-6/?topic=MAT.MS6`,
    collectionHandle: "middle-school-math-grade-6",
    topics: [
      {
        label: "Ratios & Proportions",
        topicHandle: "ratios-and-proportions",
        concepts: [
          { label: "Ratios", slug: "ratios-practice", conceptHandle: "ratios" },
          { label: "Unit Rates", slug: "unit-rates-practice", conceptHandle: "unit-rates" },
          { label: "Proportions", slug: "proportions-practice", conceptHandle: "proportions" },
          { label: "Percent Problems", slug: "percent-problems-practice", conceptHandle: "percent-problems" },
        ],
      },
      {
        label: "Integers & Negative Numbers",
        topicHandle: "integers",
        concepts: [
          { label: "Integers on a Number Line", slug: "integers-on-a-number-line-practice", conceptHandle: "integers-on-a-number-line" },
          { label: "Adding Integers", slug: "adding-integers-practice", conceptHandle: "adding-integers" },
          { label: "Subtracting Integers", slug: "subtracting-integers-practice", conceptHandle: "subtracting-integers" },
          { label: "Multiplying & Dividing Integers", slug: "multiplying-and-dividing-integers-practice", conceptHandle: "multiplying-and-dividing-integers" },
        ],
      },
      {
        label: "Expressions & Equations",
        topicHandle: "expressions-and-equations",
        concepts: [
          { label: "Writing Expressions", slug: "writing-expressions-practice", conceptHandle: "writing-expressions" },
          { label: "Evaluating Expressions", slug: "evaluating-expressions-practice", conceptHandle: "evaluating-expressions" },
          { label: "One-Step Equations", slug: "one-step-equations-practice", conceptHandle: "one-step-equations" },
          { label: "Two-Step Equations", slug: "two-step-equations-practice", conceptHandle: "two-step-equations" },
        ],
      },
      {
        label: "Geometry",
        topicHandle: "geometry-6",
        concepts: [
          { label: "Area of Triangles", slug: "area-of-triangles-practice", conceptHandle: "area-of-triangles" },
          { label: "Area of Quadrilaterals", slug: "area-of-quadrilaterals-practice", conceptHandle: "area-of-quadrilaterals" },
          { label: "Surface Area", slug: "surface-area-practice", conceptHandle: "surface-area" },
          { label: "Volume of Prisms", slug: "volume-of-prisms-practice", conceptHandle: "volume-of-prisms" },
        ],
      },
      {
        label: "Statistics",
        topicHandle: "statistics",
        concepts: [
          { label: "Mean, Median, Mode", slug: "mean-median-mode-practice", conceptHandle: "mean-median-and-mode" },
          { label: "Data Displays", slug: "data-displays-practice", conceptHandle: "data-displays" },
          { label: "Box Plots", slug: "box-plots-practice", conceptHandle: "box-plots" },
        ],
      },
    ],
  },
  {
    key: "ela6",
    label: "ELA — Grade 6",
    emoji: "📖",
    color: "bg-green-100 border-green-300 text-green-800",
    browseUrl: `${CK12_BASE}/assessment/ui/browse/practice/middle-school-ela-grade-6/?topic=ELA.MS6`,
    collectionHandle: "middle-school-ela-grade-6",
    topics: [
      {
        label: "Reading Comprehension",
        topicHandle: "reading-comprehension-6",
        concepts: [
          { label: "Main Idea & Details", slug: "main-idea-and-details-practice", conceptHandle: "main-idea-and-details" },
          { label: "Inference", slug: "inference-practice", conceptHandle: "inference" },
          { label: "Author's Purpose", slug: "authors-purpose-practice", conceptHandle: "authors-purpose" },
          { label: "Text Structure", slug: "text-structure-practice", conceptHandle: "text-structure" },
        ],
      },
      {
        label: "Vocabulary",
        topicHandle: "vocabulary-6",
        concepts: [
          { label: "Context Clues", slug: "context-clues-practice", conceptHandle: "context-clues" },
          { label: "Word Roots", slug: "word-roots-practice", conceptHandle: "word-roots" },
          { label: "Figurative Language", slug: "figurative-language-practice", conceptHandle: "figurative-language" },
          { label: "Connotation & Denotation", slug: "connotation-and-denotation-practice", conceptHandle: "connotation-and-denotation" },
        ],
      },
      {
        label: "Grammar",
        topicHandle: "grammar-6",
        concepts: [
          { label: "Nouns & Pronouns", slug: "nouns-and-pronouns-practice", conceptHandle: "nouns-and-pronouns" },
          { label: "Verbs & Tenses", slug: "verbs-and-tenses-practice", conceptHandle: "verbs-and-tenses" },
          { label: "Adjectives & Adverbs", slug: "adjectives-and-adverbs-practice", conceptHandle: "adjectives-and-adverbs" },
          { label: "Sentence Structure", slug: "sentence-structure-practice", conceptHandle: "sentence-structure" },
        ],
      },
    ],
  },
  {
    key: "science6",
    label: "Science — Grade 6",
    emoji: "🔬",
    color: "bg-purple-100 border-purple-300 text-purple-800",
    browseUrl: `${CK12_BASE}/assessment/ui/browse/practice/middle-school-science-grade-6/?topic=SCI.MS6`,
    collectionHandle: "middle-school-science-grade-6",
    topics: [
      {
        label: "Earth Science",
        topicHandle: "earth-science-6",
        concepts: [
          { label: "Plate Tectonics", slug: "plate-tectonics-practice", conceptHandle: "plate-tectonics" },
          { label: "Rock Cycle", slug: "rock-cycle-practice", conceptHandle: "rock-cycle" },
          { label: "Weather & Climate", slug: "weather-and-climate-practice", conceptHandle: "weather-and-climate" },
          { label: "The Solar System", slug: "the-solar-system-practice", conceptHandle: "the-solar-system" },
        ],
      },
      {
        label: "Life Science",
        topicHandle: "life-science-6",
        concepts: [
          { label: "Cell Division", slug: "cell-division-practice", conceptHandle: "cell-division" },
          { label: "Genetics Basics", slug: "genetics-basics-practice", conceptHandle: "genetics-basics" },
          { label: "Classification of Living Things", slug: "classification-of-living-things-practice", conceptHandle: "classification-of-living-things" },
          { label: "Ecosystems & Biodiversity", slug: "ecosystems-and-biodiversity-practice", conceptHandle: "ecosystems-and-biodiversity" },
        ],
      },
      {
        label: "Physical Science",
        topicHandle: "physical-science-6",
        concepts: [
          { label: "Atoms & Elements", slug: "atoms-and-elements-practice", conceptHandle: "atoms-and-elements" },
          { label: "Chemical Reactions", slug: "chemical-reactions-practice", conceptHandle: "chemical-reactions" },
          { label: "Forces & Energy", slug: "forces-and-energy-practice", conceptHandle: "forces-and-energy" },
        ],
      },
    ],
  },
  {
    key: "ss6",
    label: "Social Studies — Grade 6",
    emoji: "🌍",
    color: "bg-orange-100 border-orange-300 text-orange-800",
    browseUrl: `${CK12_BASE}/assessment/ui/browse/practice/middle-school-social-studies/?topic=SS.MS`,
    collectionHandle: "middle-school-social-studies",
    topics: [
      {
        label: "Ancient Civilizations",
        topicHandle: "ancient-civilizations",
        concepts: [
          { label: "Mesopotamia", slug: "mesopotamia-practice", conceptHandle: "mesopotamia" },
          { label: "Ancient Egypt", slug: "ancient-egypt-practice", conceptHandle: "ancient-egypt" },
          { label: "Ancient Greece", slug: "ancient-greece-practice", conceptHandle: "ancient-greece" },
          { label: "Ancient Rome", slug: "ancient-rome-practice", conceptHandle: "ancient-rome" },
        ],
      },
      {
        label: "Geography",
        topicHandle: "geography-6",
        concepts: [
          { label: "Map Skills", slug: "map-skills-practice", conceptHandle: "map-skills" },
          { label: "World Regions", slug: "world-regions-practice", conceptHandle: "world-regions" },
          { label: "Climate Zones", slug: "climate-zones-practice", conceptHandle: "climate-zones" },
        ],
      },
    ],
  },
];

function buildConceptUrl(subject: Subject, topic: Topic, concept: Concept): string {
  const base = `${CK12_BASE}/assessment/ui/?test/detail/practice/${subject.collectionHandle}/${concept.slug}`;
  const params = new URLSearchParams({
    collectionHandle: subject.collectionHandle,
    collectionCreatorID: "3",
    conceptCollectionHandle: `${subject.collectionHandle}-::-${concept.conceptHandle}`,
    mode: "tunnel",
    testType: "practice",
    referrer: "practice_details",
    isPageView: "true",
  });
  return `${base}&${params.toString()}`;
}

function buildTopicUrl(subject: Subject, topic: Topic): string {
  return `${subject.browseUrl}&topicHandle=${topic.topicHandle}`;
}

/* ─── Summer mode hook (mirrors SummerModeBadge logic) ─────────────────────── */
function useIsSummer(): boolean {
  const override = (trpc as any).prefs?.getPublic?.useQuery?.({ key: "summer.override" });
  const autoFlip = (trpc as any).prefs?.getPublic?.useQuery?.({ key: "summer.autoFlipEnabled" });
  const start = (trpc as any).prefs?.getPublic?.useQuery?.({ key: "summer.start" });
  const end = (trpc as any).prefs?.getPublic?.useQuery?.({ key: "summer.end" });
  return useMemo(() => {
    const ov = (override?.data ?? null) as string | null;
    if (ov === "off") return false;
    if (ov === "on") return true;
    const autoOn = (autoFlip?.data ?? "1") !== "0";
    if (!autoOn) return false;
    const d = new Date();
    const mmdd = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const s = (start?.data as string) ?? "06-06";
    const e = (end?.data as string) ?? "08-15";
    return mmdd >= s && mmdd <= e;
  }, [override?.data, autoFlip?.data, start?.data, end?.data]);
}

/* ─── Component ────────────────────────────────────────────────────────────── */
export default function PracticeHub() {
  const isSummer = useIsSummer();
  const [gradeOverride, setGradeOverride] = useState<5 | 6 | null>(null);
  const activeGrade = gradeOverride ?? (isSummer ? 6 : 5);
  const activeSubjects = activeGrade === 6 ? SUBJECTS_GRADE6 : SUBJECTS_GRADE5;

  const [selectedSubjectKey, setSelectedSubjectKey] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [search, setSearch] = useState("");

  const selectedSubject = activeSubjects.find(s => s.key === selectedSubjectKey) ?? activeSubjects[0];
  const displayedTopics = selectedSubject.topics;
  const activeTopic = selectedTopic ?? displayedTopics[0];

  // Filter concepts by search
  const filteredConcepts = search.trim()
    ? displayedTopics
        .flatMap((t) => t.concepts.map((c) => ({ ...c, topicLabel: t.label, topic: t })))
        .filter((c) => c.label.toLowerCase().includes(search.toLowerCase()))
    : activeTopic.concepts.map((c) => ({ ...c, topicLabel: activeTopic.label, topic: activeTopic }));

  function switchGrade(g: 5 | 6) {
    setGradeOverride(g);
    setSelectedSubjectKey(null);
    setSelectedTopic(null);
    setSearch("");
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span>🎯</span> Practice Hub
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Adaptive practice powered by CK-12 — pick a subject, topic, and concept to start.
        </p>
      </div>

      {/* Grade toggle */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-muted-foreground font-medium">Grade:</span>
        <button
          onClick={() => switchGrade(5)}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
            activeGrade === 5
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card border-border text-muted-foreground hover:bg-muted"
          }`}
        >
          Grade 5
        </button>
        <button
          onClick={() => switchGrade(6)}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
            activeGrade === 6
              ? "bg-amber-500 text-white border-amber-500"
              : "bg-card border-border text-muted-foreground hover:bg-muted"
          }`}
        >
          Grade 6 ☀️
        </button>
        {isSummer && gradeOverride === null && (
          <span className="text-xs text-amber-400 italic">Summer prep — showing Grade 6</span>
        )}
      </div>

      {/* Subject tabs */}
      <div className="flex flex-wrap gap-2 mb-5">
        {activeSubjects.map((s) => (
          <button
            key={s.key}
            onClick={() => {
              setSelectedSubjectKey(s.key);
              setSelectedTopic(null);
              setSearch("");
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${
              selectedSubject.key === s.key
                ? s.color + " shadow-sm scale-105"
                : "bg-card border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            <span>{s.emoji}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
        {/* Topic sidebar */}
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold px-2 mb-2">
            Topics
          </div>
          {displayedTopics.map((t) => (
            <button
              key={t.topicHandle}
              onClick={() => {
                setSelectedTopic(t);
                setSearch("");
              }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                activeTopic.topicHandle === t.topicHandle && !search
                  ? "bg-primary text-primary-foreground font-medium"
                  : "hover:bg-muted text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
          <div className="pt-3">
            <a
              href={selectedSubject.browseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-muted transition-colors"
            >
              <span>🔗</span>
              <span>Browse all on CK-12 →</span>
            </a>
          </div>
        </div>

        {/* Concepts panel */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <Input
              placeholder="Search concepts…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs h-8 text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>

          {search && (
            <div className="text-xs text-muted-foreground mb-3">
              Showing results across all topics in {selectedSubject.label}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredConcepts.map((c) => {
              const url = buildConceptUrl(selectedSubject, c.topic, c);
              return (
                <Card
                  key={c.conceptHandle}
                  className="p-4 flex flex-col gap-3 hover:shadow-md transition-shadow border-border"
                >
                  <div className="flex-1">
                    {search && (
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                        {c.topicLabel}
                      </div>
                    )}
                    <div className="font-medium text-sm leading-snug">{c.label}</div>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1"
                    >
                      <Button size="sm" className="w-full text-xs h-7 bg-primary hover:bg-primary/90">
                        Practice →
                      </Button>
                    </a>
                  </div>
                </Card>
              );
            })}

            {filteredConcepts.length === 0 && (
              <div className="col-span-3 text-center py-12 text-muted-foreground text-sm">
                No concepts found for "{search}"
              </div>
            )}
          </div>

          {/* Browse full topic on CK-12 */}
          {!search && (
            <div className="mt-4 pt-4 border-t border-border">
              <a
                href={buildTopicUrl(selectedSubject, activeTopic)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>📖</span>
                <span>See all "{activeTopic.label}" concepts on CK-12 →</span>
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Footer note */}
      <div className="mt-8 text-xs text-muted-foreground text-center">
        Practice powered by{" "}
        <a
          href="https://www.ck12.org"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          CK-12 Foundation
        </a>{" "}
        — free adaptive practice for Grades K–12
      </div>
    </div>
  );
}
