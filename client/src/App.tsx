import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { KiwiProvider } from "./contexts/KiwiContext";
import { AdultLockProvider } from "./contexts/AdultLockContext";
import { CustomBackgroundProvider } from "./contexts/CustomBackgroundContext";
import AdultGate from "./components/AdultGate";
import AssignmentsLibrary from "./pages/AssignmentsLibrary";
import CozyShell from "./components/CozyShell";
import KiwiCompanion from "./components/KiwiCompanion";
import KiwiPerch from "./components/KiwiPerch";
import KiwiQuietListener from "./components/KiwiQuietListener";
import ResourceDock from "./components/ResourceDock";
import QuickAddFab from "./components/QuickAddFab";
import Today from "./pages/Today";
import Curriculum from "./pages/Curriculum";
import Bookshelf from "./pages/Bookshelf";
import Apps from "./pages/Apps";
import Settings from "@/pages/Settings";
import Onboarding from "./pages/Onboarding";
import TakeNotes from "./pages/TakeNotes";
import DailyAgendas from "./pages/DailyAgendas";
import Schedule from "./pages/Schedule";
import KiwiCoins from "./pages/KiwiCoins";
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
        {/* === KID ROUTES (always reachable) === */}
        <Route path="/welcome" component={Onboarding} />
        <Route path="/" component={Today} />
        <Route path="/today" component={Today} />
        <Route path="/schedule" component={Schedule} />
        <Route path="/coins" component={KiwiCoins} />
        <Route path="/bookshelf" component={Bookshelf} />
        <Route path="/notes" component={TakeNotes} />
        <Route path="/apps" component={Apps} />

        {/* === ADULT ROUTES (4 total, all gated) === */}
        <Route path="/curriculum">
          <AdultGate><Curriculum /></AdultGate>
        </Route>
        <Route path="/agendas">
          <AdultGate><DailyAgendas /></AdultGate>
        </Route>
        <Route path="/library">
          <AdultGate><AssignmentsLibrary /></AdultGate>
        </Route>
        <Route path="/settings">
          <AdultGate><Settings /></AdultGate>
        </Route>

        {/* === LEGACY REDIRECTS (deleted pages → closest live page) === */}
        <Route path="/week"><Redirect to="/schedule" /></Route>
        <Route path="/levels"><Redirect to="/coins" /></Route>
        <Route path="/proud"><Redirect to="/coins" /></Route>
        <Route path="/rewards"><Redirect to="/coins" /></Route>
        <Route path="/prizes"><Redirect to="/coins" /></Route>
        <Route path="/stickers"><Redirect to="/coins" /></Route>
        <Route path="/journal"><Redirect to="/notes" /></Route>
        <Route path="/adventures"><Redirect to="/today" /></Route>
        <Route path="/profile"><Redirect to="/settings" /></Route>
        <Route path="/timeline"><Redirect to="/schedule" /></Route>
        <Route path="/family"><Redirect to="/today" /></Route>
        <Route path="/analytics"><Redirect to="/curriculum" /></Route>
        <Route path="/tutor"><Redirect to="/agendas" /></Route>
        <Route path="/tutor/:id"><Redirect to="/agendas" /></Route>
        <Route path="/knowledge"><Redirect to="/library" /></Route>
        <Route path="/needs-work"><Redirect to="/curriculum" /></Route>
        <Route path="/printables"><Redirect to="/library" /></Route>
        <Route path="/academics"><Redirect to="/curriculum" /></Route>
        <Route path="/report-card"><Redirect to="/curriculum" /></Route>
        <Route path="/whiteboard"><Redirect to="/notes" /></Route>
        <Route path="/review-library"><Redirect to="/library" /></Route>
        <Route path="/placement"><Redirect to="/curriculum" /></Route>
        <Route path="/upload"><Redirect to="/library" /></Route>
        <Route path="/packet"><Redirect to="/agendas" /></Route>
        <Route path="/scratch"><Redirect to="/notes" /></Route>

        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
      <KiwiPerch />
      <ResourceDock />
      <KiwiCompanion />
      <KiwiQuietListener />
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
              <CustomBackgroundProvider>
                <Toaster />
                <Router />
              </CustomBackgroundProvider>
            </AdultLockProvider>
          </KiwiProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
