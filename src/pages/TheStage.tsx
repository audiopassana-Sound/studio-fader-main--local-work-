import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Globe, Linkedin, Mail } from "lucide-react";
import { FaFacebook, FaImdb, FaInstagram, FaXTwitter, FaYoutube } from "react-icons/fa6";
import WaveformHero from "@/components/portfolio/WaveformHero";
import ScrollReveal from "@/components/portfolio/ScrollReveal";
import ContactOverlay from "@/components/ContactOverlay";
import { supabase } from "@/integrations/supabase/client";
import { ensureHttpsUrl, useSiteContext } from "@/context/SiteContext";

interface ProjectRow {
  id: string;
  title: string;
  client: string | null;
  category: string;
  video_url: string | null;
  description: string | null;
}

const SAMPLE_VIDEO_URL = "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

const TheStage = () => {
  const navigate = useNavigate();
  const { contact, customLinks, activeModules, heroContent, servicesContent, footerContent } = useSiteContext();
  const [activeTab, setActiveTab] = useState("all");
  const [isPlayingStudioIntro, setIsPlayingStudioIntro] = useState(false);
  const [fadeToBlack, setFadeToBlack] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const studioCutTriggeredRef = useRef(false);
  const studioNavigateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    document.title = "The Stage | Yaniv Paz";
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("projects")
        .select("id, title, client, category, video_url, description")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to load projects:", error);
        if (!cancelled) setProjects([]);
      } else {
        if (!cancelled) setProjects(data || []);
      }
      if (!cancelled) setLoading(false);
    };

    load();

    return () => {
      cancelled = true;
      if (studioNavigateTimeoutRef.current) {
        clearTimeout(studioNavigateTimeoutRef.current);
        studioNavigateTimeoutRef.current = null;
      }
    };
  }, []);

  const getVideoUrl = useCallback((raw: string | null): string => {
    if (!raw) return SAMPLE_VIDEO_URL;
    const trimmed = raw.trim();
    if (!trimmed) return SAMPLE_VIDEO_URL;
    const isDirectVideo = /\.(mp4|webm|ogg)(\?.*)?$/i.test(trimmed) || /\/storage\/v1\/object\/public\//i.test(trimmed);
    return isDirectVideo ? trimmed : SAMPLE_VIDEO_URL;
  }, []);

  const handleSeekAndPlay = useCallback((projectId: string, e: React.MouseEvent<HTMLVideoElement>) => {
    const target = e.currentTarget;
    const percentage = e.nativeEvent.offsetX / target.clientWidth;

    Object.entries(videoRefs.current).forEach(([id, video]) => {
      if (!video || id === projectId) return;
      video.pause();
    });

    if (Number.isFinite(target.duration) && target.duration > 0) {
      target.currentTime = Math.max(0, Math.min(1, percentage)) * target.duration;
    }

    void target.play().catch(() => {
      // Ignore blocked play attempts; user can click again.
    });
  }, []);

  const handleSelectedWorkWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (!e.shiftKey) return;
    e.preventDefault();
    e.currentTarget.scrollLeft += e.deltaY;
  }, []);

  const tabs = [
    { key: "all", label: "All Works", enabled: activeModules.allWorks },
    { key: "studio", label: "The Studio", enabled: activeModules.studio },
    { key: "picture-edit", label: "Picture & Edit", enabled: activeModules.pictureEdit },
    { key: "cinematic-view", label: "Cinematic View", enabled: activeModules.cinematic },
  ] as const;
  const visibleTabs = tabs.filter((tab) => tab.enabled);

  const socialLinks = [
    { key: "email", href: contact.email.trim() ? `mailto:${contact.email.trim()}` : "", icon: Mail, label: "Email" },
    { key: "linkedin", href: ensureHttpsUrl(contact.linkedin), icon: Linkedin, label: "LinkedIn" },
    { key: "instagram", href: ensureHttpsUrl(contact.instagram), icon: FaInstagram, label: "Instagram" },
    { key: "facebook", href: ensureHttpsUrl(contact.facebook), icon: FaFacebook, label: "Facebook" },
    { key: "x", href: ensureHttpsUrl(contact.x), icon: FaXTwitter, label: "X" },
    { key: "youtube", href: ensureHttpsUrl(contact.youtube), icon: FaYoutube, label: "YouTube" },
    { key: "imdb", href: ensureHttpsUrl(contact.imdb), icon: FaImdb, label: "IMDb" },
    { key: "website", href: ensureHttpsUrl(contact.website), icon: Globe, label: "Website" },
  ].filter((item) => item.href);

  const visibleCustomLinks = customLinks
    .map((link) => ({ label: link.label.trim(), href: ensureHttpsUrl(link.url) }))
    .filter((link) => link.label && link.href);

  useEffect(() => {
    const currentTabVisible = visibleTabs.some((tab) => tab.key === activeTab);
    if (!currentTabVisible) {
      setActiveTab(visibleTabs[0]?.key || "all");
    }
  }, [activeTab, visibleTabs]);

  const triggerStudioDipToBlack = useCallback(() => {
    if (studioCutTriggeredRef.current) return;
    studioCutTriggeredRef.current = true;
    setFadeToBlack(true);
  }, []);

  useEffect(() => {
    if (!fadeToBlack) return;
    studioNavigateTimeoutRef.current = setTimeout(() => {
      navigate("/mixer");
    }, 700);
    return () => {
      if (studioNavigateTimeoutRef.current) {
        clearTimeout(studioNavigateTimeoutRef.current);
        studioNavigateTimeoutRef.current = null;
      }
    };
  }, [fadeToBlack, navigate]);

  const handleStudioTimeUpdate = useCallback(
    (event: React.SyntheticEvent<HTMLVideoElement>) => {
      const video = event.currentTarget;
      const currentTime = video.currentTime;
      const duration = video.duration;
      if (studioCutTriggeredRef.current) return;
      if (
        Number.isFinite(currentTime) &&
        Number.isFinite(duration) &&
        duration > 0 &&
        currentTime >= Math.max(0, duration - 0.8)
      ) {
        triggerStudioDipToBlack();
      }
    },
    [triggerStudioDipToBlack]
  );

  const handleTabClick = useCallback(
    (tabKey: (typeof tabs)[number]["key"]) => {
      if (tabKey === "studio") {
        if (!isPlayingStudioIntro) {
          studioCutTriggeredRef.current = false;
          setFadeToBlack(false);
          setIsPlayingStudioIntro(true);
        }
        return;
      }
      setActiveTab(tabKey);
    },
    [isPlayingStudioIntro]
  );

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-end bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center gap-3">
          {socialLinks.map((link) => {
            const Icon = link.icon;
            const isEmail = link.href.startsWith("mailto:");
            return (
              <a
                key={link.key}
                href={link.href}
                target={isEmail ? undefined : "_blank"}
                rel={isEmail ? undefined : "noopener noreferrer"}
                aria-label={link.label}
                className="p-2 rounded-full text-muted-foreground hover:text-foreground transition-colors duration-300"
              >
                <Icon className="w-4 h-4" />
              </a>
            );
          })}
        </div>
      </nav>

      {/* Hero */}
      <section className="relative h-[70vh] min-h-[500px] flex items-center overflow-hidden">
        <WaveformHero />
        <div className="absolute bottom-0 left-0 right-0 h-16" style={{ background: "linear-gradient(180deg, transparent 0%, hsl(180 70% 45%) 100%)" }} />
        <div className="relative z-10 px-8 md:px-16 lg:px-24 max-w-5xl">
          <ScrollReveal>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black leading-none tracking-tight" style={{ color: "hsl(180, 100%, 50%)" }}>
              {heroContent.title}
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={150}>
            <p className="text-xl md:text-2xl lg:text-3xl font-semibold text-foreground mt-2 tracking-wide uppercase">
              {heroContent.subtitle}
            </p>
          </ScrollReveal>
          <div className="mt-48 md:mt-56 lg:mt-64">
            <div>
              <ScrollReveal delay={300}>
                <p className="text-muted-foreground text-sm md:text-base max-w-lg leading-relaxed">
                  {heroContent.description}
                </p>
              </ScrollReveal>
              <ScrollReveal delay={450}>
                <div className="flex gap-4 mt-8">
                  <a href="#projects" className="px-6 py-3 text-sm font-semibold tracking-wider uppercase rounded transition-all duration-300 hover:scale-105 hover:shadow-lg" style={{ background: "hsl(180, 100%, 50%)", color: "hsl(0, 0%, 0%)" }}>
                    View Work
                  </a>
                  <button
                    type="button"
                    onClick={() => setIsContactOpen(true)}
                    className="px-6 py-3 text-sm font-semibold tracking-wider uppercase rounded border border-foreground/20 text-foreground/80 transition-all duration-300 hover:border-foreground/50 hover:text-foreground hover:scale-105"
                  >
                    Get in Touch
                  </button>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </div>
      </section>

      {/* Projects */}
      <section id="projects" className="px-6 md:px-16 lg:px-24 py-20">
        <ScrollReveal>
          <h2 className="text-3xl md:text-4xl font-bold mb-2">Selected Work</h2>
          <div className="flex flex-wrap items-center gap-4 mb-8">
            {visibleTabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => handleTabClick(tab.key)}
                  className={`rounded-full px-7 py-2.5 text-base font-medium transition-all duration-300 border ${
                    isActive
                      ? "text-cyan-400 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)] bg-gray-900/50"
                      : "bg-gray-900/50 border-gray-800 text-gray-400 hover:text-white hover:border-cyan-500/35 hover:shadow-[0_0_12px_rgba(6,182,212,0.1)]"
                  }`}
                  aria-pressed={isActive}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          <div className="w-16 h-1 rounded-full mb-12" style={{ background: "hsl(180, 100%, 50%)" }} />
        </ScrollReveal>

        {loading ? (
          <p className="text-muted-foreground text-center py-12">Loading…</p>
        ) : projects.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">No projects yet.</p>
        ) : (
          <div
            className="flex gap-6 overflow-x-auto pb-8 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            onWheel={handleSelectedWorkWheel}
          >
            {projects.map((project, i) => {
              const videoUrl = getVideoUrl(project.video_url);

              return (
                <ScrollReveal key={project.id} delay={i * 120}>
                  <div className="group w-[40vw] min-w-[320px] max-w-[560px] flex-shrink-0">
                    <div className="relative overflow-hidden rounded-lg border border-border/50 bg-card">
                      <video
                        ref={(el) => {
                          videoRefs.current[project.id] = el;
                        }}
                        src={videoUrl}
                        preload="metadata"
                        muted
                        playsInline
                        className="w-full aspect-video object-cover cursor-pointer transition duration-200 group-hover:brightness-110"
                        onClick={(e) => handleSeekAndPlay(project.id, e)}
                      />
                    </div>
                    <div className="p-5">
                      <span className="text-xs font-mono-console tracking-wider uppercase text-muted-foreground">
                        {project.category === "post" ? "Post Production" : "Recordings & Mixes"}
                      </span>
                      <h3 className="text-lg font-semibold mt-1 text-foreground">{project.title}</h3>
                      {project.client && <p className="text-xs text-muted-foreground">{project.client}</p>}
                      {project.description && <p className="text-sm text-muted-foreground mt-1">{project.description}</p>}
                    </div>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        )}
      </section>

      {/* Services */}
      <section className="px-6 md:px-16 lg:px-24 py-20 border-t border-border/30">
        <ScrollReveal>
          <h2 className="text-3xl md:text-4xl font-bold mb-2">Services</h2>
          <div className="w-16 h-1 rounded-full mb-12" style={{ background: "hsl(180, 100%, 50%)" }} />
        </ScrollReveal>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {servicesContent.map((service, i) => (
            <ScrollReveal key={service.title} delay={i * 100}>
              <div className="p-6 rounded-lg border border-border/50 bg-card transition-all duration-300 hover:border-border hover:shadow-[0_4px_20px_hsl(0_0%_0%/0.2)] hover:scale-[1.03]">
                <h3 className="text-base font-semibold mb-2" style={{ color: "hsl(180, 100%, 50%)" }}>{service.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{service.description}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 md:px-16 lg:px-24 py-12 border-t border-border/30 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="font-mono-console text-sm font-bold tracking-wider uppercase text-foreground">
            {footerContent.copyrightName}
          </span>
          <span className="text-muted-foreground text-xs">© {new Date().getFullYear()}</span>
        </div>
        <div className="flex items-center gap-4">
          {socialLinks.map((link) => {
            const Icon = link.icon;
            const isEmail = link.href.startsWith("mailto:");
            return (
              <a
                key={`footer-${link.key}`}
                href={link.href}
                target={isEmail ? undefined : "_blank"}
                rel={isEmail ? undefined : "noopener noreferrer"}
                className="text-muted-foreground hover:text-foreground transition-colors text-sm flex items-center gap-1.5"
              >
                <Icon className="w-3.5 h-3.5" /> {link.label}
              </a>
            );
          })}
          {visibleCustomLinks.map((link) => (
            <a
              key={`footer-custom-${link.label}-${link.href}`}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors text-sm"
            >
              {link.label}
            </a>
          ))}
        </div>
      </footer>

      <div
        className={`fixed inset-0 bg-black z-[100] transition-opacity duration-700 pointer-events-none ${
          fadeToBlack ? "opacity-100" : "opacity-0"
        }`}
      />

      {isPlayingStudioIntro && (
        <div className="fixed inset-0 z-[90] bg-black">
          <video
            src="/studio-door.mp4"
            autoPlay
            muted
            playsInline
            className="fixed inset-0 w-full h-full object-cover z-50 bg-black"
            onTimeUpdate={handleStudioTimeUpdate}
            onEnded={triggerStudioDipToBlack}
          />
        </div>
      )}

      <ContactOverlay open={isContactOpen} onClose={() => setIsContactOpen(false)} />
    </div>
  );
};

export default TheStage;
