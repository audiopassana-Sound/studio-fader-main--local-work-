import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { BarChart3, Eye, Film, LogOut, MessageSquare, Settings, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const officeCards = [
  {
    title: "Communications",
    description: "Manage contact links, overlay actions, and public communication settings.",
    to: "/office/manager",
    icon: MessageSquare,
  },
  {
    title: "Media Library",
    description: "Manage audio/video uploads.",
    to: "/office/media",
    icon: Film,
  },
  {
    title: "Account & Profile",
    description: "Update profile details and account-level preferences.",
    to: "/office/profile",
    icon: Settings,
  },
  {
    title: "Project Visibility",
    description: "Hide/Show works on The Stage.",
    to: "/office/projects",
    icon: Eye,
  },
  {
    title: "SEO & Metadata",
    description: "Google & WhatsApp sharing text.",
    to: "/office/seo",
    icon: ShieldCheck,
  },
  {
    title: "Analytics",
    description: "Visitor hits and link clicks.",
    to: "/office/analytics",
    icon: BarChart3,
  },
];

const TheOffice = () => {
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await supabase.auth.signOut();
      window.localStorage.removeItem("isAuthenticated");
      toast.success("Logged out");
      navigate("/", { replace: true });
    } catch {
      toast.error("Failed to log out");
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-10 md:px-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-cyan-300">The Office</h1>
            <p className="mt-2 text-sm text-slate-400">Centralized admin suite for communications, media, and system settings.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-800"
            >
              Back to The Stage
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="inline-flex items-center gap-2 rounded-md border border-red-400/50 px-4 py-2 text-sm text-red-300 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <LogOut className="h-4 w-4" />
              {isLoggingOut ? "Logging out..." : "Logout"}
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {officeCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.to}
                to={card.to}
                className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 transition-all duration-200 hover:border-cyan-500/40 hover:bg-slate-900/80"
              >
                <div className="mb-4 inline-flex rounded-lg border border-cyan-500/40 bg-cyan-500/10 p-2 text-cyan-300">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-semibold text-slate-100">{card.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{card.description}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TheOffice;
