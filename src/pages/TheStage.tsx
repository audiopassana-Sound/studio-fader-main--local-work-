import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Globe, Linkedin, Mail, Pause, Play } from "lucide-react";
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

type MediaSource =
  | { kind: "youtube"; embedUrl: string; previewUrl: string }
  | { kind: "vimeo"; embedUrl: string }
  | { kind: "video"; src: string };

const parseYouTubeId = (url: string): string | null => {
  const trimmed = url.trim();
  if (!trimmed) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
};

const parseVimeoId = (url: string): string | null => {
  const trimmed = url.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return match?.[1] || null;
};

const TheStage = () => {
  const navigate = useNavigate();
  const { contact, customLinks, activeModules, heroContent, servicesContent, footerContent, mediaRouting } = useSiteContext();
  const [activeTab, setActiveTab] = useState("all");
  const [isPlayingStudioIntro, setIsPlayingStudioIntro] = useState(false);
  const [fadeToBlack, setFadeToBlack] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectRow[] | undefined>([]);
  const [loading, setLoading] = useState(true);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const galleryScrollRef = useRef<HTMLDivElement | null>(null);
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
        .select("id, title, client, category, video_url, description");

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

  const getMediaSource = useCallback((raw: string | null): MediaSource | null => {
    if (!raw) return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;

    const youTubeId = parseYouTubeId(trimmed);
    if (youTubeId) {
      return {
        kind: "youtube",
        embedUrl: `https://www.youtube.com/embed/${youTubeId}?enablejsapi=1&playsinline=1&rel=0`,
        previewUrl: `https://img.youtube.com/vi/${youTubeId}/hqdefault.jpg`,
      };
    }

    const vimeoId = parseVimeoId(trimmed);
    if (vimeoId) {
      return {
        kind: "vimeo",
        embedUrl: `https://player.vimeo.com/video/${vimeoId}?playsinline=1`,
      };
    }

    return { kind: "video", src: trimmed };
  }, []);

  const pauseAllEmbeddedExcept = useCallback((projectId: string) => {
    Object.entries(iframeRefs.current).forEach(([id, frame]) => {
      if (!frame || id === projectId) return;
      frame.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func: "pauseVideo", args: [] }),
        "*"
      );
      frame.contentWindow?.postMessage({ method: "pause" }, "*");
    });
  }, []);

  const [embeddedPlayback, setEmbeddedPlayback] = useState<Record<string, boolean>>({});
  const iframeRefs = useRef<Record<string, HTMLIFrameElement | null>>({});

  const handleDirectVideoToggle = useCallback((projectId: string) => {
    const target = videoRefs.current[projectId];
    if (!target) return;

    Object.entries(videoRefs.current).forEach(([id, video]) => {
      if (!video || id === projectId) return;
      video.pause();
    });
    pauseAllEmbeddedExcept(projectId);
    setEmbeddedPlayback((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (key !== projectId) next[key] = false;
      });
      return next;
    });

    if (target.paused) {
      target.muted = false;
      void target.play().catch(() => {
        // Ignore blocked play attempts; user can click again.
      });
      return;
    }

    target.pause();
  }, [pauseAllEmbeddedExcept]);

  const handleEmbeddedToggle = useCallback((projectId: string, kind: "youtube" | "vimeo") => {
    setEmbeddedPlayback((prev) => {
      const nextIsPlaying = !prev[projectId];
      if (nextIsPlaying) {
        Object.entries(videoRefs.current).forEach(([id, video]) => {
          if (!video || id === projectId) return;
          video.pause();
        });
        pauseAllEmbeddedExcept(projectId);
      }

      const frame = iframeRefs.current[projectId];
      if (frame?.contentWindow) {
        if (kind === "youtube") {
          frame.contentWindow.postMessage(
            JSON.stringify({
              event: "command",
              func: nextIsPlaying ? "playVideo" : "pauseVideo",
              args: [],
            }),
            "*"
          );
          frame.contentWindow.postMessage(
            JSON.stringify({ event: "command", func: "unMute", args: [] }),
            "*"
          );
        } else {
          frame.contentWindow.postMessage({ method: nextIsPlaying ? "play" : "pause" }, "*");
          frame.contentWindow.postMessage({ method: "setVolume", value: 1 }, "*");
        }
      }

      const next: Record<string, boolean> = {};
      Object.keys(prev).forEach((key) => {
        next[key] = key === projectId ? nextIsPlaying : false;
      });
      next[projectId] = nextIsPlaying;
      return next;
    });
  }, [pauseAllEmbeddedExcept]);

  const handleCardToggle = useCallback(
    (projectId: string, mediaSource: MediaSource) => {
      if (mediaSource.kind === "video") {
        handleDirectVideoToggle(projectId);
        return;
      }
      handleEmbeddedToggle(projectId, mediaSource.kind);
    },
    [handleDirectVideoToggle, handleEmbeddedToggle]
  );

  const handleSelectedWorkWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (!e.shiftKey) return;
    e.preventDefault();
    e.currentTarget.scrollLeft += e.deltaY;
  }, []);

  const scrollGallery = useCallback((direction: "left" | "right") => {
    if (!galleryScrollRef.current) return;
    const delta = direction === "left" ? -420 : 420;
    galleryScrollRef.current.scrollBy({ left: delta, behavior: "smooth" });
  }, []);

  const handleScroll = useCallback(() => {
    const container = galleryScrollRef.current;
    if (!container) {
      setCanScrollLeft(false);
      setCanScrollRight(true);
      return;
    }

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
  }, []);

  const tabs = [
    { key: "all", label: activeModules.allWorks.label, enabled: activeModules.allWorks.isEnabled },
    { key: "studio", label: activeModules.studio.label, enabled: activeModules.studio.isEnabled },
    { key: "picture-edit", label: activeModules.pictureEdit.label, enabled: activeModules.pictureEdit.isEnabled },
    { key: "cinematic-view", label: activeModules.cinematic.label, enabled: activeModules.cinematic.isEnabled },
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
  const filteredMedia = (projects ?? [])
    .filter((item) => {
      const manualSelection = mediaRouting?.[item.id]?.showInAllWorks;
      if (typeof manualSelection === "boolean") return manualSelection === true;
      const legacyValue = (item as ProjectRow & { showInAllWorks?: boolean }).showInAllWorks;
      if (typeof legacyValue === "boolean") return legacyValue === true;
      return true;
    })
    .sort((a, b) => {
      const orderA = mediaRouting?.[a.id]?.sortOrder;
      const orderB = mediaRouting?.[b.id]?.sortOrder;
      const hasOrderA = typeof orderA === "number";
      const hasOrderB = typeof orderB === "number";

      if (hasOrderA && hasOrderB) return orderA - orderB;
      if (hasOrderA) return -1;
      if (hasOrderB) return 1;
      return 0;
    });
  const playableMedia = filteredMedia.filter((item) => !!getMediaSource(item.video_url));
  console.log("Current All Works media:", filteredMedia);

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

  useEffect(() => {
    handleScroll();

    const onResize = () => handleScroll();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, [handleScroll, loading, playableMedia.length]);

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
        ) : playableMedia.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">No works added yet.</p>
        ) : (
          <div>
            <p className="mb-2 text-xs text-gray-500">Scroll or use Shift + Wheel</p>
            <div className="relative group">
              {canScrollLeft && (
                <button
                  type="button"
                  onClick={() => scrollGallery("left")}
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-black/50 backdrop-blur text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/65"
                  aria-label="Scroll selected work left"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              {canScrollRight && (
                <button
                  type="button"
                  onClick={() => scrollGallery("right")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-black/50 backdrop-blur text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/65"
                  aria-label="Scroll selected work right"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
            <div
              ref={galleryScrollRef}
              className="flex gap-6 overflow-x-auto pb-8 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              onWheel={handleSelectedWorkWheel}
              onScroll={handleScroll}
            >
              {playableMedia.map((project, i) => {
                const mediaSource = getMediaSource(project.video_url);
                if (!mediaSource) return null;
                const isPlaying = !!embeddedPlayback[project.id];
                const coverImage = mediaRouting?.[project.id]?.coverImage || (mediaSource.kind === "youtube" ? mediaSource.previewUrl : null);

                return (
                  <ScrollReveal key={project.id} delay={i * 120}>
                    <div className="group w-[40vw] min-w-[320px] max-w-[560px] flex-shrink-0">
                      <div className="relative overflow-hidden rounded-lg border border-border/50 bg-card">
                        {mediaSource.kind === "video" ? (
                          <video
                            ref={(el) => {
                              videoRefs.current[project.id] = el;
                            }}
                            src={mediaSource.src}
                            preload="metadata"
                            muted
                            playsInline
                            className="w-full aspect-video object-cover transition duration-200 group-hover:brightness-110"
                            onPlay={() => setEmbeddedPlayback((prev) => ({ ...prev, [project.id]: true }))}
                            onPause={() => setEmbeddedPlayback((prev) => ({ ...prev, [project.id]: false }))}
                          />
                        ) : (
                          <div className="relative w-full aspect-video">
                            <iframe
                              ref={(el) => {
                                iframeRefs.current[project.id] = el;
                              }}
                              src={mediaSource.embedUrl}
                              title={project.title}
                              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                              allowFullScreen
                              className="w-full h-full"
                            />
                          </div>
                        )}
                        {!isPlaying && coverImage && (
                          <img
                            src={coverImage}
                            alt={`${project.title} cover`}
                            className="absolute inset-0 z-10 w-full h-full object-cover pointer-events-none"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => handleCardToggle(project.id, mediaSource)}
                          className="absolute inset-0 z-20 flex items-center justify-center bg-black/20 hover:bg-black/10 transition-colors"
                          aria-label={`Toggle ${project.title} playback`}
                        >
                          <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-black/60 text-white border border-white/20">
                            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                          </span>
                        </button>
                      </div>
                      <div className="p-5">
                        <h3 className="text-lg font-semibold text-foreground">{project.title}</h3>
                        {project.client && <p className="text-xs text-muted-foreground">{project.client}</p>}
                        {project.description && <p className="text-sm text-muted-foreground mt-1">{project.description}</p>}
                      </div>
                    </div>
                  </ScrollReveal>
                );
              })}
            </div>
            </div>
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
