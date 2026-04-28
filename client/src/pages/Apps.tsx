import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";

type App = { id: number; name: string; url: string; category: string | null; emoji?: string | null };

const CATEGORY_ORDER: { key: string; label: string; subtitle?: string }[] = [
  { key: "school", label: "School", subtitle: "Your daily drivers" },
  { key: "google", label: "Google", subtitle: "Classroom, Docs, Drive, Gmail" },
  { key: "reading", label: "Reading", subtitle: "Books & passages" },
  { key: "video", label: "Videos", subtitle: "Learning channels" },
  { key: "nature", label: "Nature", subtitle: "Birds, plants, space" },
  { key: "creativity", label: "Create", subtitle: "Design & make" },
  { key: "learning", label: "More", subtitle: "Everything else" },
];

const CAT_COLOR: Record<string, string> = {
  school: "chip-cyan",
  google: "chip-violet",
  reading: "chip-pink",
  video: "chip-coral",
  nature: "chip-lime",
  creativity: "chip-orange",
  learning: "chip-yellow",
};

export default function Apps() {
  const apps = trpc.appLinks.list.useQuery();
  const list = (apps.data ?? []) as App[];

  const grouped: Record<string, App[]> = {};
  for (const a of list) {
    const k = (a.category || "learning").toLowerCase();
    (grouped[k] ||= []).push(a);
  }
  // Preserve groups in declared order, plus any extras at the end
  const orderedKeys = [
    ...CATEGORY_ORDER.map(c => c.key).filter(k => grouped[k]?.length),
    ...Object.keys(grouped).filter(k => !CATEGORY_ORDER.some(c => c.key === k)),
  ];

  return (
    <div className="space-y-8">
      <header>
        <div className="font-chalk-hand text-xl leading-none chalk-yellow">Everything you need</div>
        <h1 className="font-display text-4xl md:text-5xl mt-1 chalk-white">Apps &amp; Tools</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Tap a tile to open it in a new tab.
        </p>
      </header>

      {apps.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}

      {orderedKeys.map((key) => {
        const meta = CATEGORY_ORDER.find(c => c.key === key);
        const items = grouped[key];
        return (
          <section key={key} className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-xl font-semibold chalk-white">{meta?.label || key}</h2>
              {meta?.subtitle && (
                <span className="text-xs text-muted-foreground">{meta.subtitle}</span>
              )}
            </div>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {items.map((a) => (
                <a
                  key={a.id}
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group"
                >
                  <Card className="classroom-card p-4 h-full hover:-translate-y-0.5 hover:shadow-md transition-all">
                    <div className="flex items-center gap-3">
                      <span className={`time-chip ${CAT_COLOR[key] || "chip-yellow"} !w-12 !h-12 !text-2xl !rounded-xl shrink-0`}>
                        {a.emoji || "✨"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-display font-semibold text-[15px] leading-tight truncate">
                          {a.name}
                        </div>
                        <div className="text-[11px] text-neutral-500 truncate">
                          {new URL(a.url).hostname.replace(/^www\./, "")}
                        </div>
                      </div>
                    </div>
                  </Card>
                </a>
              ))}
            </div>
          </section>
        );
      })}

      {!apps.isLoading && list.length === 0 && (
        <Card className="classroom-card p-6 text-center">
          <p className="font-display">No apps yet.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Adults can add apps from Settings.
          </p>
        </Card>
      )}
    </div>
  );
}
