import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import PrintForwardPlan from "@/pages/PrintForwardPlan";
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
import NotebookDrawer from "./components/NotebookDrawer";
import MakeRequestPill from "./components/MakeRequestPill";
import Today from "./pages/Today";
import Curriculum from "./pages/Curriculum";
import Bookshelf from "./pages/Bookshelf";
import Apps from "./pages/Apps";
import Settings from "@/pages/Settings";
import ReportCardFifth from "@/pages/ReportCardFifth";
import ApprovalsPage from "@/pages/Approvals";
import Onboarding from "./pages/Onboarding";
import TakeNotes from "./pages/TakeNotes";
import Schedule from "./pages/Schedule";
import Kiwi from "./pages/Kiwi";
import AgendaEditor from "./pages/AgendaEditor";
import PracticeHub from "./pages/PracticeHub";
import FlashcardMaker from "./pages/FlashcardMaker";
import ReviewQuiz from "./pages/ReviewQuiz";
import Analytics from "./pages/Analytics";
import Placement from "./pages/Placement";
import Classes from "./pages/Classes";
import { trpc } from "@/lib/trpc";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { useKiwi } from "@/contexts/KiwiContext";

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
  const ui = useKiwi();
  return (
    <CozyShell>
      <OnboardingGuard />
      <Switch>
        {/* === KID ROUTES (always reachable) === */}
        <Route path="/welcome" component={Onboarding} />
        <Route path="/" component={Today} />
        <Route path="/today" component={Today} />
        <Route path="/schedule" component={Schedule} />
        <Route path="/kiwi" component={Kiwi} />
        <Route path="/coins" component={Kiwi} />
        <Route path="/practice" component={PracticeHub} />
        <Route path="/flashcards" component={FlashcardMaker} />
        <Route path="/review" component={ReviewQuiz} />
        <Route path="/bookshelf" component={Bookshelf} />
        <Route path="/notes" component={TakeNotes} />
        <Route path="/apps" component={Apps} />
        <Route path="/placement" component={Placement} />
        <Route path="/classes" component={Classes} />

        {/* === ADULT PRINT ROUTE (familyAdmin gate at the procedure level) === */}
        <Route path="/print/forward-plan" component={PrintForwardPlan} />

        {/* === ADULT ROUTES (4 total, all gated) === */}
        <Route path="/curriculum">
          <AdultGate><Curriculum /></AdultGate>
        </Route>
        {/* /agendas (Daily Schedule) page deleted 2026-05-05; tutor day
            notes now live in the global NotebookDrawer (mid-right pill). */}
        <Route path="/agendas"><Redirect to="/agenda-editor" /></Route>
        {/* 2026-05-30 — /calendars 404 fix. The text "Settings → Calendars"
            in Schedule.tsx pointed at `/calendars`, which had no route.
            Settings hosts `CalendarSyncCard`, so we redirect through there. */}
        <Route path="/calendars"><Redirect to="/settings" /></Route>
        <Route path="/library">
          <AdultGate><AssignmentsLibrary /></AdultGate>
        </Route>
        <Route path="/settings">
          <AdultGate><Settings /></AdultGate>
        </Route>
        <Route path="/approvals">
          <AdultGate><ApprovalsPage /></AdultGate>
        </Route>
        <Route path="/report-card/5">
          <AdultGate><ReportCardFifth /></AdultGate>
        </Route>
        <Route path="/agenda-editor">
          <AdultGate><AgendaEditor /></AdultGate>
        </Route>
        <Route path="/analytics">
          <AdultGate><Analytics /></AdultGate>
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
        <Route path="/tutor"><Redirect to="/agenda-editor" /></Route>
        <Route path="/tutor/:id"><Redirect to="/agenda-editor" /></Route>
        <Route path="/knowledge"><Redirect to="/library" /></Route>
        <Route path="/needs-work"><Redirect to="/curriculum" /></Route>
        <Route path="/printables"><Redirect to="/library" /></Route>
        <Route path="/academics"><Redirect to="/curriculum" /></Route>
        <Route path="/report-card"><Redirect to="/curriculum" /></Route>
        <Route path="/whiteboard"><Redirect to="/notes" /></Route>
        <Route path="/review-library"><Redirect to="/library" /></Route>
        <Route path="/upload"><Redirect to="/library" /></Route>
        <Route path="/packet"><Redirect to="/today" /></Route>
        <Route path="/scratch"><Redirect to="/notes" /></Route>

        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
      {ui.showKiwiPerch && <KiwiPerch />}
      <ResourceDock />
      <KiwiCompanion />
      <KiwiQuietListener />
      {ui.showQuickAddFab && <QuickAddFab />}
      {/* Global Notebook drawer — only renders when adult lock is unlocked
          AND the per-object toggle in Settings is on. */}
      {ui.showNotebookDrawer && <NotebookDrawer />}
      {/* Push 54 — global Reagan request pill (kid-only; no mic, no voice). */}
      <MakeRequestPill />
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
