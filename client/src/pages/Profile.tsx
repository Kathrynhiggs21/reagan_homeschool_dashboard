import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Profile() {
  const p = trpc.profile.get.useQuery();
  const badges = trpc.badges.list.useQuery();

  if (p.isLoading) return <div>Loading...</div>;
  const data = p.data;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-display font-semibold">About Me 🪪</h1>
        <p className="text-muted-foreground text-sm mt-1 font-hand text-lg">"{data?.studentName}, the Animal Whisperer"</p>
      </header>

      <Card className="cozy-card p-5 bg-gradient-to-br from-amber-50 to-rose-50 border-amber-200">
        <div className="font-display font-semibold mb-2">My identity</div>
        <p className="font-hand text-lg leading-snug">I am an animal rescuer. I always have been.</p>
        <p className="text-sm text-muted-foreground mt-2">I learn best when I'm caring for someone or something. I'm smart in my own way. I'm safe here. I'm not in trouble.</p>
      </Card>

      {data?.interests && (
        <Card className="cozy-card p-4">
          <div className="font-display font-semibold mb-2">My interests</div>
          <div className="flex flex-wrap gap-1.5">
            {(data.interests as string[]).map((i: string) => <Badge key={i} variant="secondary">{i}</Badge>)}
          </div>
        </Card>
      )}

      {data?.whatWorks && (
        <Card className="cozy-card p-4">
          <div className="font-display font-semibold mb-2">What helps me</div>
          <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
            {(data.whatWorks as string[]).map((w: string) => <li key={w}>{w}</li>)}
          </ul>
        </Card>
      )}

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
