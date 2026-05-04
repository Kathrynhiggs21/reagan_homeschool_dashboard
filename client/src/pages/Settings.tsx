import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAdultLock } from "@/contexts/AdultLockContext";
import RewardsManagerCard from "@/components/RewardsManagerCard";
import TutorsManager from "@/components/TutorsManager";
import CalendarSyncCard from "@/components/CalendarSyncCard";
import AppointmentsCardLite from "@/components/AppointmentsCardLite";

/**
 * Settings — slim version (locked May 4 2026).
 *
 * Five tabs, one short card per concern, no duplication, anyone can use cold:
 *   People        — Reagan basics + tutor list (name + day + time)
 *   Prizes        — the ~10 prize tiles + add prize
 *   Requests      — Reagan's pending requests, approve/decline
 *   Calendar      — Mom's iCal URL + recurring appointments + IH calendar toggle
 *   Notifications — recipient emails + 8 PM agenda toggle
 */
export default function Settings() {
  return (
    <div className="container max-w-4xl py-6 space-y-4">
      <header>
        <h1 className="font-display text-3xl">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Everything that controls how the dashboard runs.
        </p>
      </header>

      <Tabs defaultValue="people" className="w-full">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="prizes">Prizes</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="notifications">Email</TabsTrigger>
        </TabsList>

        <TabsContent value="people" className="space-y-4">
          <ReaganBasicsCard />
          <TutorsManager />
          <AdultPasscodeCard />
        </TabsContent>

        <TabsContent value="prizes">
          <RewardsManagerCard />
        </TabsContent>

        <TabsContent value="requests">
          <RequestsInboxCard />
        </TabsContent>

        <TabsContent value="calendar" className="space-y-4">
          <CalendarSyncCard />
          <AppointmentsCardLite />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationsCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* --------------------------------- Cards --------------------------------- */

function ReaganBasicsCard() {
  const profile = trpc.profile.get.useQuery();
  const utils = trpc.useUtils();
  const update = trpc.profile.update.useMutation({
    onSuccess: () => {
      toast.success("Saved.");
      utils.profile.get.invalidate();
    },
  });

  const [name, setName] = useState("Reagan");
  const [grade, setGrade] = useState("5th Grade");
  const [iep, setIep] = useState("");

  useEffect(() => {
    if (!profile.data) return;
    setName(profile.data.studentName || "Reagan");
    setGrade(profile.data.gradeLevel || "5th Grade");
    setIep(((profile.data as any).iepNote || "") as string);
  }, [profile.data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reagan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Grade</Label>
            <Input value={grade} onChange={(e) => setGrade(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>IEP note (one line)</Label>
          <Input
            value={iep}
            onChange={(e) => setIep(e.target.value)}
            placeholder="e.g. Math goals, 504 accommodations…"
          />
        </div>
        <Button
          onClick={() =>
            update.mutate({
              studentName: name,
              gradeLevel: grade,
              iepNote: iep,
            } as any)
          }
        >
          Save
        </Button>
      </CardContent>
    </Card>
  );
}

function AdultPasscodeCard() {
  const { setPasscode } = useAdultLock();
  const [next, setNext] = useState("");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Adult passcode</CardTitle>
      </CardHeader>
      <CardContent className="flex gap-2 items-end">
        <div className="flex-1">
          <Label>Change passcode (default 3918)</Label>
          <Input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="New passcode"
          />
        </div>
        <Button
          onClick={() => {
            if (next.trim().length < 4) {
              toast.error("At least 4 digits.");
              return;
            }
            setPasscode(next.trim());
            setNext("");
            toast.success("Passcode updated.");
          }}
        >
          Update
        </Button>
      </CardContent>
    </Card>
  );
}

function RequestsInboxCard() {
  // The studentRequests router may not be wired yet; render gracefully.
  const list = (trpc as any).studentRequests?.listPending?.useQuery
    ? (trpc as any).studentRequests.listPending.useQuery()
    : { data: [], isLoading: false };
  const utils = trpc.useUtils();
  const decide = (trpc as any).studentRequests?.decide?.useMutation
    ? (trpc as any).studentRequests.decide.useMutation({
        onSuccess: () => {
          toast.success("Done.");
          (utils as any).studentRequests?.listPending?.invalidate?.();
        },
      })
    : { mutate: (_: any) => toast.info("Requests inbox coming online.") };

  const items: Array<{ id: number; kind: string; payload: string; createdAt: number }> = list.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reagan's requests</CardTitle>
      </CardHeader>
      <CardContent>
        {list.isLoading ? (
          <div className="text-muted-foreground text-sm py-6 text-center">Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-muted-foreground text-sm py-6 text-center">
            No requests right now.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((r) => (
              <div key={r.id} className="border rounded-lg p-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <Badge variant="outline" className="mb-1 capitalize">
                    {r.kind.replace(/_/g, " ")}
                  </Badge>
                  <div className="text-sm">{r.payload}</div>
                </div>
                <div className="flex flex-col gap-1">
                  <Button
                    size="sm"
                    onClick={() => (decide as any).mutate({ id: r.id, decision: "approved" })}
                  >
                    Yes
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => (decide as any).mutate({ id: r.id, decision: "declined" })}
                  >
                    No
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NotificationsCard() {
  const recipients = (trpc as any).recipients?.list?.useQuery?.() ?? { data: [] };
  const utils = trpc.useUtils();
  const add = (trpc as any).recipients?.add?.useMutation?.({
    onSuccess: () => (utils as any).recipients?.list?.invalidate?.(),
  });
  const remove = (trpc as any).recipients?.remove?.useMutation?.({
    onSuccess: () => (utils as any).recipients?.list?.invalidate?.(),
  });

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  // Settings kv toggle for nightly email
  const sendNightlyKey = "notifications.sendNightlyAgenda";
  const sendNightly = (trpc as any).appSettings?.get?.useQuery?.({ key: sendNightlyKey }) ?? {
    data: { value: "true" },
  };
  const setSetting = (trpc as any).appSettings?.set?.useMutation?.({
    onSuccess: () =>
      (utils as any).appSettings?.get?.invalidate?.({ key: sendNightlyKey }),
  });
  const nightlyOn = (sendNightly.data?.value ?? "true") !== "false";

  const list: Array<{ id: number; name: string | null; email: string }> = recipients.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email & agenda</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between border rounded-lg p-3">
          <div>
            <div className="font-medium text-sm">Send nightly agenda email at 8 PM</div>
            <div className="text-xs text-muted-foreground">
              PDF agenda for the next school day. Resends if the plan changes before school starts.
            </div>
          </div>
          <Switch
            checked={nightlyOn}
            onCheckedChange={(v) =>
              (setSetting as any)?.mutate?.({ key: sendNightlyKey, value: v ? "true" : "false" })
            }
          />
        </div>

        <div>
          <Label>Recipients</Label>
          <div className="space-y-1 mt-1">
            {list.length === 0 ? (
              <div className="text-xs text-muted-foreground">No one yet.</div>
            ) : (
              list.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between border rounded-lg px-3 py-2"
                >
                  <div className="text-sm">
                    {r.name ? (
                      <span className="font-medium mr-2">{r.name}</span>
                    ) : null}
                    <span className="text-muted-foreground">{r.email}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => (remove as any)?.mutate?.({ id: r.id })}
                  >
                    Remove
                  </Button>
                </div>
              ))
            )}
          </div>

          <div className="flex gap-2 mt-2">
            <Input
              placeholder="Name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-40"
            />
            <Input
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button
              onClick={() => {
                if (!email.includes("@")) {
                  toast.error("Add a real email.");
                  return;
                }
                (add as any)?.mutate?.({ name: name || null, email });
                setEmail("");
                setName("");
              }}
            >
              Add
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
