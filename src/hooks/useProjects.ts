import { useState, useCallback, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSiteContext } from "@/context/SiteContext";

export type Category = "recordings" | "post";

export interface Project {
  id: string;
  name: string;
  category: Category;
  videoUrl?: string;
  audioMixUrl?: string;
  stems: { name?: string; url: string }[];
  client?: string;
  description?: string;
}

export function useProjects() {
  const { getMediaRoutingConfig } = useSiteContext();
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [category, setCategory] = useState<Category>("post");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Fetch projects from database
  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*");

      if (error) {
        console.error("Failed to fetch projects:", error);
        return;
      }

      const mapped: Project[] = (data || []).map((row) => {
        const dynamicStemsRaw = Array.isArray((row as any).stems) ? (row as any).stems : [];
        const dynamicStems = dynamicStemsRaw
          .map((s: any) => ({
            name: typeof s?.name === "string" ? s.name : undefined,
            url: typeof s?.url === "string" ? s.url : "",
          }))
          .filter((s: { url: string }) => !!s.url);

        const legacyStems = [
          { name: (row as any).stem_1_name || undefined, url: row.stem_1_url || "" },
          { name: (row as any).stem_2_name || undefined, url: row.stem_2_url || "" },
          { name: (row as any).stem_3_name || undefined, url: row.stem_3_url || "" },
          { name: (row as any).stem_4_name || undefined, url: row.stem_4_url || "" },
        ].filter((s) => !!s.url);

        return {
        // DB may store either "post"/"recordings" or "post-production"/"recording".
        // Normalize into the app's internal Category union.
        id: row.id,
        name: row.title,
        category:
          row.category === "post-production" || row.category === "post"
            ? "post"
            : "recordings",
        videoUrl: row.video_url || undefined,
        audioMixUrl: row.audio_mix_url || undefined,
        stems: dynamicStems.length > 0 ? dynamicStems : legacyStems,
        client: row.client || undefined,
        description: row.description || undefined,
      };
      });

      setAllProjects(mapped);
    };

    load();
  }, []);

  const filtered = useMemo(
    () =>
      allProjects
        .filter((p) => getMediaRoutingConfig(p.id).showInStudio && p.category === category)
        .sort((a, b) => {
          const orderA = getMediaRoutingConfig(a.id).sortOrder;
          const orderB = getMediaRoutingConfig(b.id).sortOrder;
          const hasOrderA = typeof orderA === "number";
          const hasOrderB = typeof orderB === "number";

          if (hasOrderA && hasOrderB) return orderA - orderB;
          if (hasOrderA) return -1;
          if (hasOrderB) return 1;
          return 0;
        }),
    [allProjects, category, getMediaRoutingConfig]
  );

  const currentProject = filtered[currentIndex] ?? filtered[0] ?? null;

  const switchCategory = useCallback((cat: Category) => {
    setCategory(cat);
    setCurrentIndex(0);
    setIsPlaying(false);
  }, []);

  const goNext = useCallback(() => {
    setCurrentIndex((i) => (filtered.length > 0 ? (i + 1) % filtered.length : 0));
  }, [filtered.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => (filtered.length > 0 ? (i - 1 + filtered.length) % filtered.length : 0));
  }, [filtered.length]);

  const togglePlay = useCallback(() => setIsPlaying((p) => !p), []);
  const stopPlay = useCallback(() => setIsPlaying(false), []);
  const startPlay = useCallback(() => setIsPlaying(true), []);

  return useMemo(
    () => ({
      category,
      switchCategory,
      currentProject,
      currentIndex,
      projectCount: filtered.length,
      isPlaying,
      togglePlay,
      stopPlay,
      startPlay,
      goNext,
      goPrev,
    }),
    [
      category,
      switchCategory,
      currentProject,
      currentIndex,
      filtered.length,
      isPlaying,
      togglePlay,
      stopPlay,
      startPlay,
      goNext,
      goPrev,
    ]
  );
}
