import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { KiwiProvider } from "./contexts/KiwiContext";
import { AdultLockProvider } from "./contexts/AdultLockContext";
import AdultGate from "./components/AdultGate";
import CozyShell from "./components/CozyShell";
import KiwiCompanion from "./components/KiwiCompanion";
import KiwiPerch from "./components/KiwiPerch";
import QuickAddFab from "./components/QuickAddFab";
import Today from "./pages/Today";
import Week from "./pages/Week";
import Curriculum from "./pages/Curriculum";
import Adventures from "./pages/Adventures";
import Journal from "./pages/Journal";
import Bookshelf from "./pages/Bookshelf";
import Apps from "./pages/Apps";
import Timeline from "./pages/Timeline";
import Profile from "./pages/Profile";
import Analytics from "./pages/Analytics";
import TutorHandoff from "./pages/TutorHandoff";
import Knowledge from "./pages/Knowledge";
import Settings from "@/pages/Settings";
import Onboarding from "./pages/Onboarding";
import NeedsWork from "./pages/NeedsWork";
import Printables from "./pages/Printables";
import TakeNotes from "./pages/TakeNotes";
import Stickers from "./pages/Stickers";
import Prizes from "./pages/Prizes";
import Academics from "./pages/Academics";
import ReportCard from "./pages/ReportCard";
import Whiteboard from "./pages/Whiteboard";
import Scratch from "./pages/Scratch";
import { trpc } from "@/lib/trpc";
import { useEffect } from "react";
import { useLocation } from "wouter";

function OnboardingGuard() {
  const profile = trpc.profile.get.useQuery();
  const [loc, navigate] = useLocation();
  useEffect(() => {
    if (!profile.data) return;
    const done = (profile.data as any).onboardingCompleted;
    const onWelcome = loc === "/welcome";
    if (!done && !onWelcome) navigate("/welcome");
  }, [profile.data, loc, navigate]);
  return null;
}

function Router() {
  return (
    <CozyShell>
      <OnboardingGuard />
      <Switch>
        <Route path="/welcome" component={Onboarding} />
        <Route path="/" component={Today} />
        <Route path="/today" component={Today} />
        <Route path="/week" component={Week} />
        <Route path="/adventures" component={Adventures} />
        <Route path="/journal" component={Journal} />
        <Route path="/bookshelf" component={Bookshelf} />
        <Route path="/apps" component={Apps} />
        <Route path="/timeline" component={Timeline} />
        <Route path="/profile" component={Profile} />
        {/* Adult-only pages: each wrapped in AdultGate so they prompt for the 3918 passcode */}
        <Route path="/curriculum">
          <AdultGate><Curriculum /></AdultGate>
        </Route>
        <Route path="/analytics">
          <AdultGate><Analytics /></AdultGate>
        </Route>
        <Route path="/tutor">
          <AdultGate><TutorHandoff /></AdultGate>
        </Route>
        <Route path="/knowledge">
          <AdultGate><Knowledge /></AdultGate>
        </Route>
        <Route path="/settings">
          <AdultGate><Settings /></AdultGate>
        </Route>
        <Route path="/needs-work">
          <AdultGate><NeedsWork /></AdultGate>
        </Route>
        <Route path="/printables">
          <AdultGate><Printables /></AdultGate>
        </Route>
        <Route path="/academics">
          <AdultGate><Academics /></AdultGate>
        </Route>
        <Route path="/report-card">
          <AdultGate><ReportCard /></AdultGate>
        </Route>
        <Route path="/whiteboard">
          <AdultGate><Whiteboard /></AdultGate>
        </Route>
        <Route path="/stickers" component={Stickers} />
        <Route path="/prizes" component={Prizes} />
        <Route path="/notes" component={TakeNotes} />
        <Route path="/scratch" component={Scratch} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
      <KiwiPerch />
      <KiwiCompanion />
      <QuickAddFab />
    </CozyShell>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <KiwiProvider>
            <AdultLockProvider>
              <Toaster />
              <Router />
            </AdultLockProvider>
          </KiwiProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
