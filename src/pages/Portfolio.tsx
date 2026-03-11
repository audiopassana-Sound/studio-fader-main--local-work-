import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Play, ExternalLink, Mail, Linkedin } from "lucide-react";
import WaveformHero from "@/components/portfolio/WaveformHero";
import ScrollReveal from "@/components/portfolio/ScrollReveal";
import { supabase } from "@/integrations/supabase/client";

interface ProjectRow {
  id: string;
  title: string;
  client: string | null;
  category: string;
  video_url: string | null;
  description: string | null;
}

const SERVICES = [
  { title: "Sound Design", desc: "Crafting immersive sonic worlds for film, TV, and advertising." },
  { title: "Mixing & Mastering", desc: "Precision mixing and mastering for any format." },
  { title: "Foley & SFX", desc: "Custom Foley recording and sound effects creation." },
  { title: "Post Production", desc: "Complete audio post-production pipeline." },
];

function extractYouTubeId(url: string): string | null {
  const m = url.match(/(?:embed\/|v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

const Portfolio = () => {
  const navigate = useNavigate();
  const [entered, setEntered] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    requestAnimationFrame(() => setEntered(true));

    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("projects")
        .select("id, title, client, category, video_url, description")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to load projects:", error);
        setProjects([]);
      } else {
        setProjects(data || []);
      }
      setLoading(false);
    };

    load();
  }, []);

  const handleBack = useCallback(() => {
    setExiting(true);
    setTimeout(() => navigate("/"), 600);
  }, [navigate]);

  return (
    <>
      <div
        className="fixed inset-0 z-[100] pointer-events-none bg-background transition-opacity duration-600 ease-out"
        style={{ opacity: entered && !exiting ? 0 : 1 }}
      />

      <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
        {/* Navigation */}
        <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between bg-background/80 backdrop-blur-md border-b border-border/50">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-300 group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-1" />
            <span className="font-mono-console text-xs tracking-wider uppercase">Back to Studio</span>
          </button>
          <div className="flex items-center gap-3">
            <a href="mailto:contact@yanivpaz.com" className="p-2 rounded-full text-muted-foreground hover:text-foreground transition-colors duration-300">
              <Mail className="w-4 h-4" />
            </a>
            <a href="https://linkedin.com/in/yanivpaz" target="_blank" rel="noopener noreferrer" className="p-2 rounded-full text-muted-foreground hover:text-foreground transition-colors duration-300">
              <Linkedin className="w-4 h-4" />
            </a>
          </div>
        </nav>

        {/* Hero */}
        <section className="relative h-[70vh] min-h-[500px] flex items-center overflow-hidden">
          <WaveformHero />
          <div className="absolute bottom-0 left-0 right-0 h-16" style={{ background: "linear-gradient(180deg, transparent 0%, hsl(180 70% 45%) 100%)" }} />
          <div className="relative z-10 px-8 md:px-16 lg:px-24 max-w-5xl">
            <ScrollReveal>
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-black leading-none tracking-tight" style={{ color: "hsl(180, 100%, 50%)" }}>
                Sound Design
              </h1>
            </ScrollReveal>
            <ScrollReveal delay={150}>
              <p className="text-xl md:text-2xl lg:text-3xl font-semibold text-foreground mt-2 tracking-wide uppercase">YANIV PAZ</p>
            </ScrollReveal>
            <ScrollReveal delay={300}>
              <p className="text-muted-foreground text-sm md:text-base max-w-lg mt-6 leading-relaxed">
                Award-winning sound designer crafting immersive audio experiences for film, television, and advertising.
              </p>
            </ScrollReveal>
            <ScrollReveal delay={450}>
              <div className="flex gap-4 mt-8">
                <a href="#projects" className="px-6 py-3 text-sm font-semibold tracking-wider uppercase rounded transition-all duration-300 hover:scale-105 hover:shadow-lg" style={{ background: "hsl(180, 100%, 50%)", color: "hsl(0, 0%, 0%)" }}>
                  View Work
                </a>
                <a href="mailto:contact@yanivpaz.com" className="px-6 py-3 text-sm font-semibold tracking-wider uppercase rounded border border-foreground/20 text-foreground/80 transition-all duration-300 hover:border-foreground/50 hover:text-foreground hover:scale-105">
                  Get in Touch
                </a>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* Projects */}
        <section id="projects" className="px-6 md:px-16 lg:px-24 py-20">
          <ScrollReveal>
            <h2 className="text-3xl md:text-4xl font-bold mb-2">Selected Work</h2>
            <div className="w-16 h-1 rounded-full mb-12" style={{ background: "hsl(180, 100%, 50%)" }} />
          </ScrollReveal>

          {loading ? (
            <p className="text-muted-foreground text-center py-12">Loading…</p>
          ) : projects.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">No projects yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
              {projects.map((project, i) => {
                const ytId = project.video_url ? extractYouTubeId(project.video_url) : null;
                const thumbnail = ytId ? `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg` : null;

                return (
                  <ScrollReveal key={project.id} delay={i * 120}>
                    <div className="group relative rounded-lg overflow-hidden border border-border/50 bg-card transition-all duration-300 hover:border-border hover:shadow-[0_8px_30px_hsl(0_0%_0%/0.3)] hover:scale-[1.02]">
                      <div className="relative aspect-video overflow-hidden" style={{ background: "hsl(0 0% 8%)" }}>
                        {thumbnail ? (
                          <img src={thumbnail} alt={project.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="w-16 h-16 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center">
                              <Play className="w-6 h-6 text-muted-foreground/50 ml-1" />
                            </div>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                          <div className="w-14 h-14 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110" style={{ background: "hsl(180, 100%, 50%)" }}>
                            <Play className="w-6 h-6 text-background ml-0.5" />
                          </div>
                        </div>
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
            {SERVICES.map((service, i) => (
              <ScrollReveal key={service.title} delay={i * 100}>
                <div className="p-6 rounded-lg border border-border/50 bg-card transition-all duration-300 hover:border-border hover:shadow-[0_4px_20px_hsl(0_0%_0%/0.2)] hover:scale-[1.03]">
                  <h3 className="text-base font-semibold mb-2" style={{ color: "hsl(180, 100%, 50%)" }}>{service.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{service.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="px-6 md:px-16 lg:px-24 py-12 border-t border-border/30 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-mono-console text-sm font-bold tracking-wider uppercase text-foreground">Yaniv Paz</span>
            <span className="text-muted-foreground text-xs">© {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="mailto:contact@yanivpaz.com" className="text-muted-foreground hover:text-foreground transition-colors text-sm flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Email</a>
            <a href="https://linkedin.com/in/yanivpaz" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors text-sm flex items-center gap-1.5"><Linkedin className="w-3.5 h-3.5" /> LinkedIn</a>
            <a href="https://www.imdb.com" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors text-sm flex items-center gap-1.5"><ExternalLink className="w-3.5 h-3.5" /> IMDb</a>
          </div>
        </footer>
      </div>
    </>
  );
};

export default Portfolio;
