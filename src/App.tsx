import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/contexts/I18nContext";
import { BottomNav } from "@/components/BottomNav";
import { NearestHotspot } from "@/components/NearestHotspot";
import { LangToggle } from "@/components/LangToggle";
import TodayScreen from "@/pages/TodayScreen";
import DriveScreen from "@/pages/DriveScreen";
import PlanningScreen from "@/pages/PlanningScreen";
import ZonesScreen from "@/pages/ZonesScreen";
import AdminScreen from "@/pages/AdminScreen";
import EventsScreen from "@/pages/EventsScreen";
import NotFound from "./pages/NotFound.tsx";
import { Component, ErrorInfo, ReactNode } from "react";

const queryClient = new QueryClient();

type ErrorBoundaryProps = { children: ReactNode };
type ErrorBoundaryState = { hasError: boolean };

class AppErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("App crashed:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4">
          <div className="max-w-sm text-center space-y-3">
            <h1 className="text-xl font-display font-bold">Un problème est survenu</h1>
            <p className="text-sm text-muted-foreground">
              L&apos;application a rencontré une erreur inattendue. Relance la page pour continuer ton shift.
            </p>
            <button
              className="mt-2 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              onClick={() => window.location.reload()}
            >
              Recharger
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const location = useLocation();
  // Hide NearestHotspot on Today screen since hero card already shows best zone + distance
  const showNearestHotspot = location.pathname !== '/';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LangToggle />
      <Routes>
        <Route path="/" element={<TodayScreen />} />
        <Route path="/drive" element={<DriveScreen />} />
        <Route path="/planning" element={<PlanningScreen />} />
        <Route path="/zones" element={<ZonesScreen />} />
        <Route path="/events" element={<EventsScreen />} />
        <Route path="/admin" element={<AdminScreen />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      {showNearestHotspot && <NearestHotspot />}
      <BottomNav />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <I18nProvider>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter>
          <AppErrorBoundary>
            <AppContent />
          </AppErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </I18nProvider>
  </QueryClientProvider>
);

export default App;
