import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { WhisperProvider } from "./contexts/WhisperContext";
import CozyShell from "./components/CozyShell";
import WhisperCompanion from "./components/WhisperCompanion";
import Today from "./pages/Today";
import Week from "./pages/Week";
import Curriculum from "./pages/Curriculum";
import Adventures from "./pages/Adventures";
import RescueJournal from "./pages/RescueJournal";
import Animals from "./pages/Animals";
import Bookshelf from "./pages/Bookshelf";
import Apps from "./pages/Apps";
import Timeline from "./pages/Timeline";
import Profile from "./pages/Profile";
import Analytics from "./pages/Analytics";
import TutorHandoff from "./pages/TutorHandoff";
import Knowledge from "./pages/Knowledge";
import Settings from "./pages/Settings";

function Router() {
  return (
    <CozyShell>
      <Switch>
        <Route path="/" component={Today} />
        <Route path="/today" component={Today} />
        <Route path="/week" component={Week} />
        <Route path="/curriculum" component={Curriculum} />
        <Route path="/adventures" component={Adventures} />
        <Route path="/rescue" component={RescueJournal} />
        <Route path="/animals" component={Animals} />
        <Route path="/bookshelf" component={Bookshelf} />
        <Route path="/apps" component={Apps} />
        <Route path="/timeline" component={Timeline} />
        <Route path="/profile" component={Profile} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/tutor" component={TutorHandoff} />
        <Route path="/knowledge" component={Knowledge} />
        <Route path="/settings" component={Settings} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
      <WhisperCompanion />
    </CozyShell>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <WhisperProvider>
            <Toaster />
            <Router />
          </WhisperProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
