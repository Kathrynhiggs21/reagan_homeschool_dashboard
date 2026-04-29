import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { REAGAN_PHOTOS } from "@/lib/reaganPhotos";

function Pills({ items, color = "secondary" }: { items?: string[] | null; color?: "secondary" | "outline" }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((s) => (
        <Badge key={s} variant={color}>{s}</Badge>
      ))}
    </div>
  );
}

function Section({ title, emoji, children, hideIfEmpty }: { title: string; emoji: string; children: React.ReactNode; hideIfEmpty?: boolean }) {
  // Hide if children is null/false/empty
  if (hideIfEmpty && !children) return null;
  return (
    <Card className="cozy-card p-4">
      <div className="font-display font-semibold mb-2 flex items-center gap-2">
        <span>{emoji}</span>
        <span>{title}</span>
      </div>
      {children}
    </Card>
  );
}

export default function Profile() {
  const p = trpc.profile.get.useQuery();
  const badges = trpc.badges.list.useQuery();

  if (p.isLoading) return <div>Loading...</div>;
  const data = (p.data as any) || {};

  const pets = (data.pets || []) as Array<{ name: string; species: string; role?: string }>;
  const schoolHistory = (data.schoolHistory || []) as Array<{ school: string; district: string; years: string; transferDate?: string }>;
  const family = (data.family || {}) as Record<string, any>;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-display font-semibold">About Me 🪪</h1>
        <p className="text-muted-foreground text-sm mt-1 font-hand text-lg">"{data.studentName || "Reagan"}, the Animal Rescuer"</p>
        {data.birthday && (
          <p className="text-xs text-muted-foreground mt-1">
            Born {data.birthday} · {data.pronouns || "she/her"}
          </p>
        )}
      </header>

      {/* Identity statement */}
      <Card className="cozy-card p-5 bg-gradient-to-br from-amber-50 to-rose-50 border-amber-200">
        <div className="font-display font-semibold mb-2">My identity</div>
        <p className="font-hand text-lg leading-snug">
          {data.selfStatement || "I am an animal rescuer. I always have been."}
        </p>
        {data.selfAdvocacyStatement && (
          <p className="text-sm text-muted-foreground mt-3 italic">{data.selfAdvocacyStatement}</p>
        )}
      </Card>

      {/* Pets */}
      {pets.length > 0 && (
        <Section title="My pets" emoji="🐾">
          <div className="grid sm:grid-cols-2 gap-2">
            {pets.map((pet) => (
              <div key={`${pet.name}-${pet.species}`} className="p-3 rounded-md border bg-white/40">
                <div className="font-semibold">{pet.name}</div>
                <div className="text-xs text-muted-foreground">{pet.species}</div>
                {pet.role && <div className="text-xs mt-1 italic">{pet.role}</div>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Family */}
      {Object.keys(family).length > 0 && (
        <Section title="My family" emoji="👨‍👩‍👧">
          <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
            {Object.entries(family).map(([role, val]) => (
              <li key={role}>
                <span className="font-medium text-foreground capitalize">{role.replace(/_/g, " ")}:</span>{" "}
                {typeof val === "string" ? val : JSON.stringify(val)}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* School history */}
      {schoolHistory.length > 0 && (
        <Section title="My school history" emoji="🎒">
          <ol className="text-sm space-y-2">
            {schoolHistory.map((s, i) => (
              <li key={`${s.school}-${i}`} className="p-2 rounded-md border bg-white/40">
                <div className="font-semibold">{s.school}</div>
                <div className="text-xs text-muted-foreground">{s.district} · {s.years}{s.transferDate ? ` · transferred ${s.transferDate}` : ""}</div>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {/* Diagnoses + Supports (parent-facing, calm) */}
      {(data.diagnoses?.length > 0 || data.currentSupports?.length > 0) && (
        <Section title="What I have & what helps" emoji="💛">
          {data.diagnoses?.length > 0 && (
            <div className="mb-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Diagnoses on file</div>
              <Pills items={data.diagnoses} />
            </div>
          )}
          {data.currentSupports?.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Current supports</div>
              <Pills items={data.currentSupports} color="outline" />
            </div>
          )}
        </Section>
      )}

      {/* Sensory */}
      {(data.sensoryLoves?.length > 0 || data.sensoryAvoids?.length > 0) && (
        <Section title="Sensory" emoji="🌈">
          {data.sensoryLoves?.length > 0 && (
            <div className="mb-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">I love</div>
              <Pills items={data.sensoryLoves} />
            </div>
          )}
          {data.sensoryAvoids?.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">I avoid</div>
              <Pills items={data.sensoryAvoids} color="outline" />
            </div>
          )}
        </Section>
      )}

      {/* Favorites */}
      {(data.favoriteFoods?.length > 0 || data.favoriteShows?.length > 0 || data.favoriteBooks?.length > 0) && (
        <Section title="My favorites" emoji="⭐">
          <div className="space-y-3">
            {data.favoriteFoods?.length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Foods</div>
                <Pills items={data.favoriteFoods} />
              </div>
            )}
            {data.favoriteShows?.length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Shows & videos</div>
                <Pills items={data.favoriteShows} />
              </div>
            )}
            {data.favoriteBooks?.length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Books</div>
                <Pills items={data.favoriteBooks} />
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Existing interests + what helps me */}
      {data.interests && (
        <Section title="My interests" emoji="✨">
          <Pills items={data.interests as string[]} />
        </Section>
      )}

      {data.whatWorks && (
        <Section title="What helps me" emoji="🤍">
          <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
            {(data.whatWorks as string[]).map((w: string) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Section>
      )}

      {data.whatHarms && (data.whatHarms as string[]).length > 0 && (
        <Section title="What doesn't help" emoji="🛑">
          <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
            {(data.whatHarms as string[]).map((w: string) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Section>
      )}

      {/* Photos */}
      <Card className="cozy-card p-4">
        <div className="font-display font-semibold mb-3">My photos 📸</div>
        <p className="text-sm text-muted-foreground mb-3">Pictures of you being you.</p>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          {REAGAN_PHOTOS.map((src, i) => (
            <div key={src} className="aspect-square rounded-xl overflow-hidden border border-amber-200/60 bg-amber-50">
              <img src={src} alt={`Reagan ${i + 1}`} loading="lazy" className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
            </div>
          ))}
        </div>
      </Card>

      {/* Badges */}
      <Card className="cozy-card p-4">
        <div className="font-display font-semibold mb-3">Badges</div>
        <div className="grid sm:grid-cols-2 gap-2">
          {badges.data?.map((b: any) => (
            <div key={b.id} className={`p-3 rounded-xl border ${b.earned ? "bg-amber-50 border-amber-300" : "bg-muted/40 border-muted opacity-70"}`}>
              <div className="text-2xl">{b.emoji}</div>
              <div className="font-medium text-sm mt-1">{b.name}</div>
              <div className="text-xs text-muted-foreground">{b.description}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
