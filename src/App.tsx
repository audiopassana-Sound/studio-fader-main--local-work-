import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import Index from "./pages/Index";
import TheStage from "./pages/TheStage";
import MediaLibrary from "./pages/MediaLibrary";
import Manager from "./pages/Manager";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import TheOffice from "./pages/TheOffice";
import Profile from "./pages/office/Profile";
import ProjectVisibility from "./pages/office/ProjectVisibility";
import SeoSettings from "./pages/office/SeoSettings";
import Analytics from "./pages/office/Analytics";
import { SiteProvider } from "./context/SiteContext";

const queryClient = new QueryClient();

const RequireOfficeAuth = () => {
  const location = useLocation();
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, next) => {
      setSession(next);
      setChecking(false);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (checking) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!session) {
    const redirectTarget = `${location.pathname}${location.search}`;
    return <Navigate to={`/auth?redirect=${encodeURIComponent(redirectTarget)}`} replace />;
  }

  return <Outlet />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <SiteProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<TheStage />} />
            <Route path="/mixer" element={<Index />} />
            <Route path="/portfolio" element={<TheStage />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/admin" element={<Navigate to="/office/media" replace />} />
            <Route path="/office" element={<RequireOfficeAuth />}>
              <Route index element={<TheOffice />} />
              <Route path="manager" element={<Manager />} />
              <Route path="media" element={<MediaLibrary />} />
              <Route path="profile" element={<Profile />} />
              <Route path="projects" element={<ProjectVisibility />} />
              <Route path="seo" element={<SeoSettings />} />
              <Route path="analytics" element={<Analytics />} />
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </SiteProvider>
  </QueryClientProvider>
);

export default App;
