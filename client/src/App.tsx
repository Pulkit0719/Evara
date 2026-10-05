import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { trpc } from "./lib/trpc";
import CalendarPage from "./pages/CalendarPage";
import Cycle from "./pages/Cycle";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
import Insights from "./pages/Insights";
import NotFound from "./pages/NotFound";
import Onboarding from "./pages/Onboarding";
import Reminders from "./pages/Reminders";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Symptoms from "./pages/Symptoms";
import Wellness from "./pages/Wellness";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import { startLogin } from "./const";

function AccessGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth(); const [location, setLocation] = useLocation(); const profile = trpc.profile.get.useQuery(undefined, { enabled: Boolean(user) }); const onboarding = location === "/onboarding";
  useEffect(() => { if (!loading && user && !profile.isLoading && !profile.data && !onboarding) setLocation("/onboarding"); }, [loading, user, profile.isLoading, profile.data, onboarding, setLocation]);
  if (loading || (user && profile.isLoading)) return <div className="auth-loading"><Loader2 className="h-6 w-6 animate-spin" /><span>Opening your private space…</span></div>;
  if (!user) return <div className="auth-loading"><p>This page is private to your Evara account.</p><button className="text-link" onClick={() => startLogin()}>Sign in securely</button></div>;
  if (profile.isError) return <div className="auth-loading"><p>We could not load your private profile.</p><button className="text-link" onClick={() => profile.refetch()}>Try again</button></div>;
  if (!profile.data && !onboarding) return <div className="auth-loading"><Loader2 className="h-6 w-6 animate-spin" /><span>Preparing setup…</span></div>;
  if (onboarding) return <Onboarding />;
  return <DashboardLayout>{children}</DashboardLayout>;
}
function ProtectedDashboard() { return <AccessGate><Dashboard /></AccessGate>; } function ProtectedCycle() { return <AccessGate><Cycle /></AccessGate>; } function ProtectedCalendar() { return <AccessGate><CalendarPage /></AccessGate>; } function ProtectedSymptoms() { return <AccessGate><Symptoms /></AccessGate>; } function ProtectedWellness() { return <AccessGate><Wellness /></AccessGate>; } function ProtectedInsights() { return <AccessGate><Insights /></AccessGate>; } function ProtectedReports() { return <AccessGate><Reports /></AccessGate>; } function ProtectedReminders() { return <AccessGate><Reminders /></AccessGate>; } function ProtectedSettings() { return <AccessGate><Settings /></AccessGate>; } function ProtectedOnboarding() { return <AccessGate><Onboarding /></AccessGate>; }
function Router() { return <Switch><Route path="/" component={Home} /><Route path="/onboarding" component={ProtectedOnboarding} /><Route path="/app" component={ProtectedDashboard} /><Route path="/cycle" component={ProtectedCycle} /><Route path="/calendar" component={ProtectedCalendar} /><Route path="/symptoms" component={ProtectedSymptoms} /><Route path="/wellness" component={ProtectedWellness} /><Route path="/insights" component={ProtectedInsights} /><Route path="/reports" component={ProtectedReports} /><Route path="/reminders" component={ProtectedReminders} /><Route path="/settings" component={ProtectedSettings} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch>; }
export default function App() { return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>; }
