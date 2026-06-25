import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-context";
import { useGetMe } from "@/lib/api";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import ChatPage from "@/pages/chat";
import ProfilePage from "@/pages/profile";
import AssistantsPage from "@/pages/assistants";
import NumbersPage from "@/pages/numbers";
import CallLogsPage from "@/pages/call-logs";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { data: user, isLoading, isError } = useGetMe();

  useEffect(() => {
    if (!isLoading && (!user || isError)) {
      window.location.href = "/login";
    }
  }, [isLoading, user, isError]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Authenticating…
      </div>
    );
  }

  if (!user || isError) return null;

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => {
        window.location.href = "/login";
        return null;
      }} />
      <Route path="/login" component={LoginPage} />
      <Route path="/chat" component={() => <ProtectedRoute component={ChatPage} />} />
      <Route path="/profile" component={() => <ProtectedRoute component={ProfilePage} />} />
      <Route path="/assistants" component={() => <ProtectedRoute component={AssistantsPage} />} />
      <Route path="/numbers" component={() => <ProtectedRoute component={NumbersPage} />} />
      <Route path="/call-logs" component={() => <ProtectedRoute component={CallLogsPage} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
